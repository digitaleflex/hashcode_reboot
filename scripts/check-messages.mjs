import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const frPath = path.join(dir, "..", "messages", "fr.json");
const enPath = path.join(dir, "..", "messages", "en.json");

/* ------------------------------------------------------------------ */
/* #214 — garde anti-régression i18n : fail sur clés orphelines.        */
/* Périmètre volontairement restreint aux namespaces assainis par #214  */
/* (landing.*, profiling.welcome.*) : le reste de fr.json porte une     */
/* dette connue (doublons dashboard.*, clés validation.* divergentes,   */
/* resumePrompt.* en double, etc.) suivie hors de ce script.            */
/* Ne pas élargir sans purger d'abord.                                  */
/* ------------------------------------------------------------------ */
const ORPHAN_SCOPES = ["landing", "profiling.welcome"];

/**
 * Sous-arbres consommés dynamiquement (t(variable)) : invisibles à
 * l'analyse statique, donc exemptés explicitement.
 * - landing.activity.types / .levels : badges d'événements (typeLabel /
 *   levelLabel dans landing/activity.tsx, avec repli sur la valeur brute).
 */
const DYNAMIC_SUBTREES = ["landing.activity.types", "landing.activity.levels"];

/**
 * Fichiers recevant `t` en paramètre (aucun useTranslations/getTranslations
 * dans le fichier) : namespace d'attribution explicite (= celui des
 * appelants, vérifié par grep des appels validateAnswer / getReasonLabels).
 */
const EXTRA_FILE_NAMESPACES = {
  "src/lib/profiling/validate.ts": ["profiling"],
  "src/lib/profiling/engine.ts": ["profiling"],
  "src/lib/profiling/auto-controls.ts": ["profiling"],
};

// FR-only temporaire 2026-10-07 (réversible) : si en.json est archivé,
// le contrôle de parité fr/en est sans objet — on valide fr seul.
if (!fs.existsSync(enPath)) {
  const archived = fs
    .readdirSync(path.join(dir, "..", "messages"))
    .filter((f) => f.startsWith("en.json.archived-"));
  if (archived.length > 0) {
    const frOnly = JSON.parse(fs.readFileSync(frPath, "utf8"));
    const frOnlyMap = flatten(frOnly);
    const countOnly = (m) =>
      [...m.values()].filter((v) => typeof v === "string").length;
    console.info(
      `FR-only temporaire (${archived.join(", ")}) — parité fr/en ignorée, fr strings: ${countOnly(frOnlyMap)}.`
    );
    // #214 : fail sur clés orphelines (périmètre ORPHAN_SCOPES).
    const orphans = findOrphanKeys(frOnly);
    for (const o of orphans) console.error(`ORPHAN (clé i18n inutilisée): ${o}`);
    if (orphans.length > 0) {
      console.error(
        `${orphans.length} clé(s) orpheline(s) — supprime ou câble (cf. #214).`
      );
      process.exit(1);
    }
    console.info("OK — fr seul cohérent, zéro clé orpheline (périmètre #214).");
    process.exit(0);
  }
  console.error(`MISSING messages/en.json et aucune archive trouvée.`);
  process.exit(1);
}

const fr = JSON.parse(fs.readFileSync(frPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));

/** Flatten nested messages to dot-paths. Arrays indexed numerically. */
function flatten(obj, prefix = "", out = new Map()) {
  if (typeof obj === "string") {
    out.set(prefix, obj);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

/** Extract ICU {placeholders} from a string (ignores {{escaped}}). */
function placeholders(s) {
  const found = new Set();
  const re = /(?<!\{)\{([a-zA-Z0-9_]+)\}(?!\})/g;
  let m;
  while ((m = re.exec(s)) !== null) found.add(m[1]);
  return found;
}

const frMap = flatten(fr);
const enMap = flatten(en);

let errors = 0;

for (const key of frMap.keys()) {
  if (!enMap.has(key)) {
    console.error(`MISSING in en.json: ${key}`);
    errors++;
  }
}
for (const key of enMap.keys()) {
  if (!frMap.has(key)) {
    console.error(`EXTRA in en.json (absent fr): ${key}`);
    errors++;
  }
}
for (const [key, frStr] of frMap) {
  const enStr = enMap.get(key);
  if (typeof enStr !== "string") continue;
  const f = placeholders(frStr);
  const e = placeholders(enStr);
  const missing = [...f].filter((p) => !e.has(p));
  const extra = [...e].filter((p) => !f.has(p));
  if (missing.length > 0 || extra.length > 0) {
    console.error(
      `PLACEHOLDERS ${key}: fr={${[...f].join(",")}} en={${[...e].join(",")}}`
    );
    errors++;
  }
}

const count = (m) => [...m.values()].filter((v) => typeof v === "string").length;
console.info(`fr strings: ${count(frMap)} · en strings: ${count(enMap)}`);
if (errors === 0) {
  console.info("OK — parité fr/en complète, placeholders cohérents.");
} else {
  console.error(`${errors} problème(s) détecté(s).`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* #214 — détection de clés orphelines (mode FR-only).                  */
/*                                                                      */
/* Heuristique par fichier : chaque `t("K")` / `t.raw("K")` littéral    */
/* résolu contre chaque `useTranslations("NS")` / `getTranslations`     */
/* du MÊME fichier couvre la feuille `NS.K` et tout son sous-arbre     */
/* (t.raw("columns") couvre columns[0].links[1].t, etc.). Les appels    */
/* dynamiques t(variable) ne sont pas détectables : voir DYNAMIC_.       */
/* Un `t` nommé autrement ou un template t(`…`) est ignoré — le         */
/* codebase n'en utilise aucun pour des clés i18n (vérifié par grep).  */
/* ------------------------------------------------------------------ */

function listSrcFiles(root) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) out.push(p);
    }
  };
  walk(root);
  return out;
}

function findOrphanKeys(fr) {
  const leaves = [...flatten(fr).entries()]
    .filter(([, v]) => typeof v === "string")
    .map(([k]) => k);
  const inScope = leaves.filter((p) =>
    ORPHAN_SCOPES.some((s) => p === s || p.startsWith(`${s}.`)),
  );
  const repoRoot = path.join(dir, "..");
  const files = listSrcFiles(path.join(repoRoot, "src"));
  const used = new Set();
  const nsRe =
    /useTranslations\(\s*["']([^"']+)["']\s*\)|getTranslations\(\s*["']([^"']+)["']\s*\)|namespace\s*:\s*["']([^"']+)["']\s*/g;
  const keyRe =
    /(?:^|[^A-Za-z0-9_$.])t\.raw\(\s*["']([^"']+)["']\s*\)|(?:^|[^A-Za-z0-9_$.])t\(\s*["']([^"']+)["']\s*[,)]/g;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const nss = new Set();
    let m;
    nsRe.lastIndex = 0;
    while ((m = nsRe.exec(src)) !== null) nss.add(m[1] ?? m[2] ?? m[3]);
    const rel = path.relative(repoRoot, f).replace(/\\/g, "/");
    for (const extra of EXTRA_FILE_NAMESPACES[rel] ?? []) nss.add(extra);
    if (nss.size === 0) continue;
    const keys = new Set();
    keyRe.lastIndex = 0;
    while ((m = keyRe.exec(src)) !== null) keys.add(m[1] ?? m[2]);
    if (keys.size === 0) continue;
    for (const ns of nss) for (const k of keys) used.add(`${ns}.${k}`);
    // Clés absolues éventuelles (helpers) : testées telles quelles.
    for (const k of keys) used.add(k);
  }
  return inScope
    .filter((p) => {
      if (
        DYNAMIC_SUBTREES.some(
          (d) => p === d || p.startsWith(`${d}.`) || p.startsWith(`${d}[`),
        )
      )
        return false; // consommé dynamiquement : pas orphelin
      for (const u of used) {
        if (p === u || p.startsWith(`${u}.`) || p.startsWith(`${u}[`)) return false; // utilisé : pas orphelin
      }
      return true; // orphelin : aucune consommation détectée
    })
    .sort();
}
