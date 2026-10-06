/**
 * D22 — Analyse d'accessibilite i18n (AST via l'API TypeScript, pas grep).
 *
 * But : repondre a "quelle cle de messages/*.json est utilisee, et par qui ?"
 * en tenant compte des ACCES DYNAMIQUES qu'un grep du nom de la cle ne voit pas :
 *
 *   t(`profiling.${field}`)          cle construite (template literal)
 *   t(config.labelKey)               cle portee par une donnee (map / enum / tableau)
 *   t.raw('steps')                   retour d'une structure (tableau d'objets)
 *   await getTranslations(`legal.${doc}`)   namespace CONSTRUIT + await
 *   useTranslations('ns')            portee de namespace, par scope
 *   { t } en prop de composant       namespace fourni par l'appelant (cross-file)
 *   t(key) ou t est un parametre     translator opaque (ex: lib/legal-content, lib/profiling)
 *
 * La resolution des bindings est **par scope lexical** (declaration -> fonction
 * englobante -> ... -> fichier), parce qu'un meme fichier peut binder `t` sur
 * deux namespaces differents (ex: DashboardSidebar : "…sidebar.nav" et "…sidebar").
 *
 * Sortie : rapport lisible, ou JSON complet avec --json.
 * Le script ne modifie AUCUN fichier de messages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src", "tests", "scripts"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TRANSLATOR_METHODS = new Set(["raw", "has", "rich", "markup", "exists"]);
const NAMESPACE_FNS = new Set(["useTranslations", "getTranslations"]);

/* ------------------------------------------------------------------ utils */

function walkDir(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      walkDir(full, out);
    } else if (EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

function flattenMessages(obj, prefix = "", out = new Map()) {
  if (typeof obj === "string") out.set(prefix, obj);
  else if (Array.isArray(obj)) obj.forEach((v, i) => flattenMessages(v, `${prefix}[${i}]`, out));
  else if (obj && typeof obj === "object")
    for (const [k, v] of Object.entries(obj))
      flattenMessages(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** Resout un chemin "a.b[0].c" dans un objet. */
function resolveIn(obj, dotted) {
  const segs = String(dotted)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur = obj;
  for (const s of segs) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[s];
  }
  return cur;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
const srcOf = (sf, n) => n.getText(sf).replace(/\s+/g, " ").slice(0, 200);
const isTName = (name) => name === "t" || /^t[A-Z]/.test(name) || /^t_/.test(name);

/** Retire await / parentheses / as / non-null d'une expression. */
function unwrap(node) {
  let cur = node;
  for (;;) {
    if (
      ts.isAwaitExpression(cur) ||
      ts.isParenthesizedExpression(cur) ||
      ts.isAsExpression(cur) ||
      ts.isNonNullExpression(cur) ||
      ts.isSatisfiesExpression(cur) ||
      ts.isTypeAssertionExpression(cur)
    )
      cur = cur.expression;
    else return cur;
  }
}

/** Portee lexicale d'une declaration : la fonction englobante, sinon le fichier. */
function scopeOf(node) {
  let cur = node.parent;
  while (cur) {
    if (
      ts.isFunctionDeclaration(cur) ||
      ts.isFunctionExpression(cur) ||
      ts.isArrowFunction(cur) ||
      ts.isMethodDeclaration(cur) ||
      ts.isGetAccessor(cur) ||
      ts.isSetAccessor(cur) ||
      ts.isSourceFile(cur)
    )
      return cur;
    cur = cur.parent;
  }
  return null;
}

/* ----------------------------------------------------------------- corpus */

const fr = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", "fr.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", "en.json"), "utf8"));
const frKeys = flattenMessages(fr);
const enKeys = flattenMessages(en);

const parsedFiles = SCAN_DIRS.flatMap((d) => walkDir(path.join(ROOT, d))).map((abs) => ({
  abs,
  file: rel(abs),
  text: fs.readFileSync(abs, "utf8"),
}));
for (const pf of parsedFiles)
  pf.sf = ts.createSourceFile(pf.abs, pf.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function parseNamespaceArg(call, sf) {
  if (!call.arguments?.length) return { ns: null, dynamic: false };
  const a0 = unwrap(call.arguments[0]);
  if (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0))
    return { ns: a0.text, dynamic: false };
  if (ts.isObjectLiteralExpression(a0)) {
    for (const p of a0.properties) {
      if (
        ts.isPropertyAssignment(p) &&
        ((ts.isIdentifier(p.name) && p.name.text === "namespace") ||
          (ts.isStringLiteral(p.name) && p.name.text === "namespace"))
      ) {
        const v = unwrap(p.initializer);
        if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v))
          return { ns: v.text, dynamic: false };
        return { ns: null, dynamic: true, text: srcOf(sf, v) };
      }
    }
  }
  return { ns: null, dynamic: true, text: srcOf(sf, a0) };
}

/* ============================== PASSE 1 : portee ============================== */

/** scope -> Map(nom -> {ns} | {dynamic, text}) */
const scopeBindings = new Map(); // par fichier
/** fichier -> {props:Set, components:Set} */
const propReceivers = new Map();
/** {file, component, calleeName, ns, line} : <X t={t} /> */
const jsxTProps = [];
/** useTranslations/getTranslations vus dans le code */
const nsDeclarations = [];
/** namespaces construits dynamiquement */
const dynamicNamespaces = [];
/** fonctions locales de type translator */
const customTranslators = [];
/**
 * Fonctions dont un parametre est un translator (non destructure) :
 * {file, fnName, index, paramName}. Sert a resoudre t(config.labelKey) dans
 * stateDot(state, t) : le namespace vient de l'appelant.
 */
const tParamFns = [];
/** Appels de ces fonctions : {file, fnName, argBinding, line} */
const tParamCalls = [];

const perFile = new Map();

for (const pf of parsedFiles) {
  const { sf, file } = pf;
  const bindings = new Map();
  const props = new Set();
  const components = new Set();
  perFile.set(file, { bindings, props, components });

  const addBinding = (scope, name, value) => {
    if (!scope) return;
    if (!bindings.has(scope)) bindings.set(scope, new Map());
    bindings.get(scope).set(name, value);
  };

  const visitDecl = (node) => {
    /* --- declaration de namespace, eventuellement await --- */
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const init = node.initializer && unwrap(node.initializer);
      if (init && ts.isCallExpression(init) && ts.isIdentifier(init.expression) && NAMESPACE_FNS.has(init.expression.text)) {
        const parsed = parseNamespaceArg(init, sf);
        const value = parsed.dynamic ? { dynamic: true, text: parsed.text } : { ns: parsed.ns };
        addBinding(scopeOf(node), node.name.text, value);
        nsDeclarations.push({
          file,
          line: lineOf(sf, init),
          fn: init.expression.text,
          namespace: parsed.ns,
          dynamic: parsed.dynamic,
          dynamicText: parsed.text ?? null,
          boundTo: node.name.text,
        });
        if (parsed.dynamic)
          dynamicNamespaces.push({ file, line: lineOf(sf, init), expr: parsed.text, boundTo: node.name.text });
      }
      /* --- alias : const tt = t --- */
      if (init && ts.isIdentifier(init) && isTName(init.text)) {
        addBinding(scopeOf(node), node.name.text, { aliasOf: init.text });
      }
    }

    /* --- parametres de type translator ({ t }, t: ValidationTFunction) --- */
    if (ts.isParameter(node) && node.name) {
      let propName = null;
      if (ts.isObjectBindingPattern(node.name)) {
        for (const el of node.name.elements) {
          const nm = (el.propertyName ?? el.name).text;
          if (el.name && ts.isIdentifier(el.name) && isTName(nm)) propName = nm;
        }
      } else if (ts.isIdentifier(node.name) && isTName(node.name.text)) {
        // `t: ValidationTFunction` (translateur maison) ou
        // `t: ReturnType<typeof useTranslations>` (prop de composant Next).
        const ty = node.type?.getText(sf) ?? "";
        if (ty.includes("ValidationTFunction") || ty.includes("useTranslations")) propName = node.name.text;
      }
      if (propName) {
        if (ts.isIdentifier(node.name)) {
          /* parametre simple : function stateDot(state, t) { ... } */
          const fnNode = node.parent;
          tParamFns.push({
            file,
            fnName: fnNode?.name?.text ?? null,
            index: fnNode?.parameters?.indexOf(node) ?? -1,
            paramName: node.name.text,
            exported: Boolean(fnNode?.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)),
          });
          addBinding(scopeOf(node), propName, { tParam: true, fnName: fnNode?.name?.text ?? null });
        } else {
          props.add(propName);
          addBinding(scopeOf(node), propName, { prop: true });
        }
      }
    }

    /* --- signature de fonction : memorise les composants concernes --- */
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)) &&
      node.name?.text
    )
      components.add(node.name.text);

    /* --- type de translator personnalise --- */
    if (
      ts.isFunctionDeclaration(node) &&
      node.parameters.some((p) => p.type?.getText(sf).includes("ValidationTFunction"))
    )
      customTranslators.push({ file, name: node.name?.text ?? "(anonymous)" });

    /* --- JSX <X t={t} /> --- */
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(sf);
      for (const a of node.attributes?.properties ?? []) {
        if (
          ts.isJsxAttribute(a) &&
          a.name.getText(sf) === "t" &&
          a.initializer &&
          ts.isJsxExpression(a.initializer) &&
          a.initializer.expression &&
          ts.isIdentifier(a.initializer.expression) &&
          isTName(a.initializer.expression.text)
        )
          jsxTProps.push({
            file,
            component: tag,
            calleeName: a.initializer.expression.text,
            line: lineOf(sf, node),
            scope: scopeOf(a.initializer.expression),
          });
      }
    }

    node.forEachChild(visitDecl);
  };
  visitDecl(sf);

  if (props.size) propReceivers.set(file, { props: [...props], components });
}

/** Fichier courant pendant la resolution : necessaire pour suivre les props. */
let curFile = "";

/* =============== PASSE 2 : resolution des props `t` transmises =============== */

/**
 * Pour un composant qui recoit `t` en prop, on cherche le namespace chez
 * l'appelant. On ne peut pas le faire exactement sans le type-checker ; on
 * collecte donc tous les namespaces possibles et on ne retient que les
 * namespaces uniques — si c'est ambigu, on le signale.
 */
const propNamespaces = new Map(); // fichier -> Map(propName -> ns | {ambiguous:[..]})
/** fnName -> {namespace} : namespaces recus par un `t` passe en argument */
const tParamNamespaces = new Map(); // fnName -> {ns} | {ambiguous}

for (const pf of parsedFiles) {
  const bindings = perFile.get(pf.file).bindings;
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const def = tParamFns.find((d) => d.fnName === node.expression.text);
      if (def && def.index >= 0) {
        const arg = node.arguments[def.index];
        if (arg && ts.isIdentifier(arg)) {
          const r = resolveNamespaceIn(bindings, scopeOf(arg), arg.text, new Set());
          if (r && !r.dynamic && !r.ambiguous && !r.prop && r.ns != null) {
            const prev = tParamNamespaces.get(node.expression.text);
            if (!prev) tParamNamespaces.set(node.expression.text, { ns: r.ns, from: `${pf.file}:${lineOf(pf.sf, node)}` });
            else if (prev.ns !== r.ns)
              tParamNamespaces.set(node.expression.text, { ambiguous: [prev.ns, r.ns], from: prev.from });
          }
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(pf.sf);
}

for (const [file, recv] of propReceivers) {
  const found = new Map();
  for (const jsx of jsxTProps) {
    if (!recv.components.has(jsx.component)) continue;
    const ns = resolveNamespaceIn(perFile.get(jsx.file).bindings, jsx.scope, jsx.calleeName, new Set());
    if (!ns) continue;
    if (ns.ambiguous) continue;
    if (!found.has(jsx.calleeName)) found.set(jsx.calleeName, { ns: ns.ns, from: `${jsx.file}:${jsx.line}` });
    else if (found.get(jsx.calleeName).ns !== ns.ns)
      found.set(jsx.calleeName, { ambiguous: [found.get(jsx.calleeName).ns, ns.ns], from: found.get(jsx.calleeName).from });
  }
  propNamespaces.set(file, found);
}

/** Resolution lexicale d'un binding par nom, en remontant les scopes. */
function resolveNamespaceIn(bindings, fromScope, name, seen) {
  let scope = fromScope;
  while (scope) {
    const m = bindings.get(scope);
    if (m?.has(name)) {
      const v = m.get(name);
      if (v.dynamic) return { dynamic: true, text: v.text };
      if (v.prop) {
        const r = propNamespaces.get(curFile)?.get(name);
        if (!r) return { prop: true };
        if (r.ambiguous) return { ambiguous: true, names: r.ambiguous, from: r.from };
        return { ns: r.ns, inherited: true, from: r.from };
      }
      if (v.aliasOf && !seen.has(name)) {
        seen.add(name);
        return resolveNamespaceIn(bindings, scope, v.aliasOf, seen);
      }
      if (v.tParam && v.fnName) {
        const r = tParamNamespaces.get(v.fnName);
        if (!r) return { tParam: true, fnName: v.fnName };
        if (r.ambiguous) return { ambiguous: true, names: r.ambiguous, from: r.from };
        return { ns: r.ns, inherited: true, from: r.from };
      }
      return { ns: v.ns };
    }
    scope = scope.parent;
  }
  return null;
}

/* ====================== PASSE 3 : collecte finale des sites ====================== */

const staticSites = [];
const dynamicSites = [];

for (const pf of parsedFiles) {
  curFile = pf.file;
  const { sf, file } = pf;
  const bindings = perFile.get(file).bindings;

  const nsOf = (name) => {
    let scope = null;
    const visit = (node) => {
      if (scope) return;
      if (ts.isCallExpression(node)) {
        let callee = null;
        let method = "call";
        if (ts.isIdentifier(node.expression)) callee = node.expression.text;
        else if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          TRANSLATOR_METHODS.has(node.expression.name.text)
        ) {
          callee = node.expression.expression.text;
          method = node.expression.name.text;
        }
        if (callee && isTName(callee)) {
          const a0 = node.arguments?.[0];
          const b = resolveNamespaceIn(bindings, scopeOf(node), callee, new Set());
          const literal = a0 && (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0));
          const site = {
            file,
            line: lineOf(sf, node),
            fn: `t.${method}`,
            callee,
            how: literal ? a0.text : a0 ? srcOf(sf, a0) : "(aucun argument)",
            literal: Boolean(literal),
            namespace: b?.ns ?? null,
            bindingKnown: Boolean(b && b.ns !== undefined && !b.dynamic && !b.ambiguous),
            propInherited: Boolean(b?.inherited),
            dynamicNamespaceText: b?.dynamic ? b.text : null,
            ambiguousNamespaces: b?.ambiguous ? (b.names ?? []).map((x) => x).flat().filter((x) => typeof x === "string") : null,
          };
          if (literal) staticSites.push(site);
          else
            dynamicSites.push({
              ...site,
              reason: b?.dynamic
                ? `namespace construit dynamiquement (${b.text})`
                : b?.ambiguous
                  ? "prop `t` : namespace ambigu chez l'appelant"
                  : b?.prop
                    ? "prop `t` : namespace non resolu chez l'appelant"
                    : b?.tParam
                      ? `parametre \`${b.fnName}(…, t)\` : namespace non resolu chez l'appelant`
                      : b?.ns !== undefined
                      ? "cle construite dynamiquement"
                      : "translator recu en param / alias non resolu",
            });
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);
  };
  nsOf();
}

/* ============================ CLASSIFICATION ============================ */

const live = new Map();
const touch = (k) => {
  if (!live.has(k)) live.set(k, { static: [], dynamic: [] });
  return live.get(k);
};
const missing = [];

for (const s of staticSites) {
  // `t.raw("x")` / `t.markup(...)` renvoie une STRUCTURE : toutes les feuilles
  // en dessous sont vivantes, pas seulement `x`. Sans cela, un tableau de
  // 10 objets serait declare mort alors qu'il est rendu.
  const nsOk = s.namespace ? resolveIn(fr, s.namespace) !== undefined : true;
  const full = s.namespace ? `${s.namespace}.${s.how}` : s.how;
  const base = resolveIn(fr, full) ?? (resolveIn(fr, s.how) !== undefined ? resolveIn(fr, s.how) : undefined);

  if (base === undefined) {
    if (!nsOk) missing.push(`${s.file}:${s.line} namespace "${s.namespace}" introuvable`);
    else if (s.namespace && resolveIn(fr, s.how) === undefined)
      missing.push(`${s.file}:${s.line} "${full}" introuvable`);
    else missing.push(`${s.file}:${s.line} "${s.how}" introuvable (racine)`);
    continue;
  }

  if (typeof base === "string") {
    touch(full).static.push(`${s.file}:${s.line} ${s.fn}("${full}")`);
    continue;
  }
  // structure : on marque toutes les feuilles.
  const leaves = flattenMessages(base, full);
  if (leaves.size === 0) {
    touch(full).static.push(`${s.file}:${s.line} ${s.fn}("${full}") (structure vide)`);
    continue;
  }
  for (const k of leaves.keys()) touch(k).static.push(`${s.file}:${s.line} ${s.fn}("${full}") → structure`);
}

const riskPrefixes = [];
const riskNamespaces = [];
const riskUnknown = [];

for (const d of dynamicSites) {
  if (d.bindingKnown && d.namespace) {
    riskNamespaces.push({ ns: d.namespace, site: d });
    continue;
  }
  // `t` herite d'un namespace CONSTRUIT (`legal.${doc}`) : on rejoue le prefixe
  // litteral, sinon la zone serait declaree non bornee alors qu'elle l'est.
  if (d.dynamicNamespaceText) {
    const pm = String(d.dynamicNamespaceText).match(/^`([A-Za-z0-9_.\-]*)\$\{/);
    if (pm && pm[1]) {
      riskPrefixes.push({ prefix: pm[1], site: d });
      continue;
    }
  }
  // prop `t` ambigu : plusieurs namespaces possibles chez les appelants, on les
  // couvre TOUS plutot que d'en choisir un.
  if (d.ambiguousNamespaces?.length) {
    for (const ns of d.ambiguousNamespaces) riskNamespaces.push({ ns, site: d });
    continue;
  }
  const m = d.how.match(/^`([A-Za-z0-9_.\-]*)\$\{/);
  if (m && m[1]) {
    riskPrefixes.push({ prefix: m[1], site: d });
    continue;
  }
  const m2 = d.how.match(/^["']([A-Za-z0-9_.\-]*)["']\s*\+/);
  if (m2 && m2[1]) {
    riskPrefixes.push({ prefix: m2[1], site: d });
    continue;
  }
  riskUnknown.push(d);
}

for (const dn of dynamicNamespaces) {
  const m = String(dn.expr ?? "").match(/^`([A-Za-z0-9_.\-]*)\$\{/);
  if (m && m[1])
    riskPrefixes.push({
      prefix: m[1],
      site: { file: dn.file, line: dn.line, fn: "getTranslations", how: dn.expr },
    });
  else
    riskUnknown.push({
      file: dn.file,
      line: dn.line,
      fn: "getTranslations",
      how: dn.expr,
      namespace: null,
      reason: "namespace construit dynamiquement, prefixe non litteral",
    });
}

for (const { ns, site } of riskNamespaces) {
  const node = resolveIn(fr, ns);
  if (node === undefined || typeof node === "string") {
    missing.push(`${site.file}:${site.line} namespace "${ns}" introuvable`);
    continue;
  }
  for (const k of flattenMessages(node, ns).keys())
    touch(k).dynamic.push(`${site.file}:${site.line} ${site.fn}(${site.how}) [ns "${ns}"]`);
}

for (const { prefix, site } of riskPrefixes) {
  let n = 0;
  for (const k of frKeys.keys())
    if (k === prefix || k.startsWith(prefix)) {
      touch(k).dynamic.push(`${site.file}:${site.line} ${site.fn}(${site.how}) [prefixe "${prefix}"]`);
      n++;
    }
  if (!n) missing.push(`${site.file}:${site.line} prefixe "${prefix}" ne couvre aucune cle`);
}

const deadKeys = [...frKeys.keys()].filter((k) => !live.has(k));

/* --------------------------------- rapport --------------------------------- */

const byRoot = (keys) => {
  const m = new Map();
  for (const k of keys) {
    const r = k.split(/[.\[]/)[0];
    if (!m.has(r)) m.set(r, []);
    m.get(r).push(k);
  }
  return m;
};
const liveByRoot = byRoot([...live.keys()]);
const deadByRoot = byRoot(deadKeys);

const report = {
  totals: {
    fr: frKeys.size,
    en: enKeys.size,
    live: live.size,
    dead: deadKeys.length,
    staticSites: staticSites.length,
    dynamicSites: dynamicSites.length,
    riskPrefixes: riskPrefixes.length,
    riskNamespaces: riskNamespaces.length,
    riskUnknown: riskUnknown.length,
    filesScanned: parsedFiles.length,
  },
  dynamicSites,
  dynamicNamespaces,
  risk: {
    prefixes: riskPrefixes.map((r) => ({ prefix: r.prefix, site: `${r.site.file}:${r.site.line} ${r.site.fn}(${r.site.how})` })),
    namespaces: riskNamespaces.map((r) => ({ ns: r.ns, site: `${r.site.file}:${r.site.line} ${r.site.fn}(${r.site.how})` })),
    unresolved: riskUnknown.map((d) => `${d.file}:${d.line} ${d.fn}(${d.how}) — ${d.reason}`),
  },
  propTranslators: [...propReceivers.entries()].map(([f, r]) => ({
    file: f,
    props: r.props,
    resolved: [...(propNamespaces.get(f)?.entries() ?? [])].map(
      ([p, v]) => `${p} -> ${v.ambiguous ? "AMBIGU" : v.ns ?? "racine"} (${v.from ?? "?"})`,
    ),
  })),
  customTranslators,
  namespacesDeclared: nsDeclarations,
  missing,
  liveByRoot: Object.fromEntries([...liveByRoot].map(([k, v]) => [k, v.length])),
  deadByRoot: Object.fromEntries([...deadByRoot].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => [k, v.length])),
  deadKeys,
  dynamicOnly: [...live.entries()].filter(([, v]) => v.static.length === 0).map(([k, v]) => ({ key: k, sites: v.dynamic })),
};

if (process.argv.includes("--json")) {
  // Ecrit aussi le rapport pour scripts/purge-i18n.mjs (jamais dans le depot).
  const out = path.join(ROOT, "scripts", ".i18n-report.json");
  fs.writeFileSync(out, JSON.stringify({ report }, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
} else {
  const t = report.totals;
  console.log("=== TOTAUX ===");
  console.log(`fichiers analyses: ${t.filesScanned}`);
  console.log(`cles: fr=${t.fr} en=${t.en} | vivantes=${t.live} | mortes=${t.dead}`);
  console.log(`sites: statiques=${t.staticSites} dynamiques=${t.dynamicSites} (namespaces=${t.riskNamespaces}, prefixes=${t.riskPrefixes}, non resolus=${t.riskUnknown})`);

  console.log("\n=== 1. ACCES DYNAMIQUES ===");
  for (const d of dynamicSites)
    console.log(`  ${d.file}:${d.line}  ${d.fn}(${d.how})  ns=${d.namespace ?? "?"}  [${d.reason}]`);

  console.log("\n=== 2. NAMESPACES CONSTRUITS ===");
  for (const n of dynamicNamespaces) console.log(`  ${n.file}:${n.line}  getTranslations(${n.expr}) -> ${n.boundTo}`);
  if (!dynamicNamespaces.length) console.log("  (aucun)");

  console.log("\n=== 3. ZONES A RISQUE COUVERTES ===");
  for (const r of report.risk.namespaces) console.log(`  namespace "${r.ns}" <- ${r.site}`);
  for (const r of report.risk.prefixes) console.log(`  prefixe "${r.prefix}" <- ${r.site}`);

  console.log("\n=== 4. ACCES DYNAMIQUES NON BORNES ===");
  for (const r of report.risk.unresolved) console.log(`  ${r}`);
  if (!report.risk.unresolved.length) console.log("  (aucun)");

  console.log("\n=== 5. CLES VIVANTES UNIQUEMENT VIA ACCES DYNAMIQUE ===");
  for (const d of report.dynamicOnly) console.log(`  ${d.key}  <- ${d.sites[0]}`);
  if (!report.dynamicOnly.length) console.log("  (aucune)");

  console.log("\n=== 6. CLES INTROUVABLES (cle demandee, absente du fichier) ===");
  for (const m of missing) console.log(`  ${m}`);
  if (!missing.length) console.log("  (aucune)");

  console.log("\n=== 7. TRANSLATORS RECUS EN PROP ===");
  for (const p of report.propTranslators) console.log(`  ${p.file}  props=${p.props}  ${p.resolved.join(" ; ") || "NON RESOLU"}`);
  if (!report.propTranslators.length) console.log("  (aucun)");

  console.log("\n=== 8. VIVANTES / MORTES PAR RACINE ===");
  const roots = new Set([...Object.keys(liveByRoot), ...Object.keys(deadByRoot)]);
  for (const r of [...roots].sort())
    console.log(`  ${r.padEnd(14)} vivantes=${String((liveByRoot.get(r) ?? []).length).padStart(5)}  mortes=${String((deadByRoot.get(r) ?? []).length).padStart(5)}`);
}
