/**
 * D22 — Plan de purge, genere a partir de scripts/analyze-i18n.mjs.
 *
 * Ne supprime QUE des sous-arbres 100 % morts ET non lies dans le code.
 * Regle de securite : si `useTranslations(ns)` / `getTranslations(ns)` existe,
 * le contenu est considere vivant meme si les cles ne resolvent pas (bug de
 * nommage != contenu obsolete). La purge ne porte donc jamais sur un namespace
 * lie, meme partiellement.
 *
 * Usage : node scripts/purge-i18n.mjs            -> rapport (dry-run)
 *         node scripts/purge-i18n.mjs --write    -> ecrit messages/{fr,en}.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

const frPath = path.join(ROOT, "messages", "fr.json");
const enPath = path.join(ROOT, "messages", "en.json");
const fr = JSON.parse(fs.readFileSync(frPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));

const flat = (o, p = "", m = new Map()) => {
  if (typeof o === "string") m.set(p, o);
  else if (Array.isArray(o)) o.forEach((v, i) => flat(v, `${p}[${i}]`, m));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, m);
  return m;
};

const report = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts", ".i18n-report.json"), "utf8"),
).report;

/** Namespaces explicitement lies dans le code source. */
const linked = new Set(report.namespacesDeclared.map((n) => n.namespace).filter(Boolean));
/** Le rapport ne contient que les cles mortes : tout le reste est vivant. */
const dead = new Set(report.deadKeys);
const allFr = [...flat(fr).keys()];

/** Un namespace est lie si un namespace declare le couvre (lui-meme ou prefixe). */
const isLinked = (ns) => {
  for (const l of linked) if (ns === l || ns.startsWith(l + ".")) return l;
  return null;
};

/* --------- Regroupement des cles mortes par racine puis profondeur 2 --------- */

const groups = new Map();
for (const k of allFr) {
  const seg = k.split(/[.\[]/).slice(0, 2).join(".");
  if (!groups.has(seg)) groups.set(seg, []);
  groups.get(seg).push(k);
}

/** Cibles : profondeur 2 entierement morte et non liee. */
const targets = [];
const kept = [];

for (const [ns, keys] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  const deadCount = keys.filter((k) => dead.has(k)).length;
  if (deadCount === 0) continue;
  if (deadCount !== keys.length) {
    kept.push({ ns, total: keys.length, dead: deadCount, why: "partiellement vivant" });
    continue;
  }
  const l = isLinked(ns);
  if (l) {
    kept.push({ ns, total: keys.length, dead: deadCount, why: `namespace lié par "${l}"` });
    continue;
  }
  targets.push({ ns, keys });
}

// Racines de profondeur 1 (legalPending.*, common.*, error.*) : regroupees.
function groupRoot(root) {
  const keys = allFr.filter((k) => k === root || k.startsWith(root + ".") || k.startsWith(root + "["));
  if (!keys.length) return null;
  const deadCount = keys.filter((k) => dead.has(k)).length;
  if (deadCount === 0) return { ns: root, keys: [], dead: 0, live: keys.length };
  if (isLinked(root)) return { ns: root, keys, dead: deadCount, live: keys.length - deadCount, kept: true };
  if (deadCount === keys.length) return { ns: root, keys, dead: deadCount, live: 0 };
  return { ns: root, keys, dead: deadCount, live: keys.length - deadCount, kept: true };
}

/* --------- Application --------- */

const purgeRoots = new Set();
const purgeSubtrees = [];

for (const t of targets) {
  if (t.ns.includes(".")) purgeSubtrees.push(t.ns);
  else purgeRoots.add(t.ns);
}

// Racines monolithes traitees a part (legalPending, common, error).
for (const root of ["legalPending", "common", "error"]) {
  const g = groupRoot(root);
  if (g && g.live === 0 && g.dead > 0) {
    purgeRoots.add(root);
  } else if (g) {
    kept.push({ ns: root, total: g.keys.length, dead: g.dead, why: "racine partiellement vivante" });
  }
}

const purgeKeyPrefixes = [...purgeRoots].map((r) => r + ".").concat([...purgeRoots]);
const doomed = new Set();
for (const k of allFr) {
  for (const p of purgeKeyPrefixes) {
    if (k === p || k.startsWith(p) || (p.endsWith(".") && k.startsWith(p))) {
      doomed.add(k);
      break;
    }
  }
  for (const ns of purgeSubtrees) {
    if (k === ns || k.startsWith(ns + ".")) {
      doomed.add(k);
      break;
    }
  }
}

/** Supprime les sous-arbres nommes, puis retire les objets devenus vides. */
function prune(obj, prefixes) {
  for (const p of prefixes) {
    const segs = p.split(".");
    let cur = obj;
    let ok = true;
    for (let i = 0; i < segs.length - 1; i++) {
      if (cur == null || typeof cur !== "object" || !(segs[i] in cur)) {
        ok = false;
        break;
      }
      cur = cur[segs[i]];
    }
    if (!ok || cur == null || typeof cur !== "object") continue;
    delete cur[segs[segs.length - 1]];
  }
  const clean = (o) => {
    if (!o || typeof o !== "object") return o;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        clean(v);
        if (Object.keys(v).length === 0) delete o[k];
      }
    }
    return o;
  };
  return clean(obj);
}

const prefixesToPrune = [...purgeRoots, ...purgeSubtrees].sort((a, b) => b.length - a.length);

/* --------------------------- Rapport --------------------------- */

const removedByNs = new Map();
for (const k of doomed) {
  const seg = k.split(/[.\[]/).slice(0, 2).join(".");
  removedByNs.set(seg, (removedByNs.get(seg) ?? 0) + 1);
}

console.log("=== PURGE (dry-run) ===");
console.log(`sous-arbres supprimes : ${prefixesToPrune.length}`);
console.log(`cles a supprimer      : ${doomed.size} / ${allFr.length}\n`);
for (const [ns, n] of [...removedByNs].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${ns}`);

console.log("\n=== CONSERVE (raison) ===");
for (const k of kept.sort((a, b) => b.dead - a.dead)) console.log(`  ${k.ns.padEnd(30)} ${k.dead}/${k.total}  ${k.why}`);

if (WRITE) {
  for (const [locale, p] of [["fr", frPath], ["en", enPath]]) {
    const before = fs.readFileSync(p, "utf8");
    const data = prune(JSON.parse(before), prefixesToPrune);
    const after = JSON.stringify(data, null, 2) + "\n";
    fs.writeFileSync(p, after, "utf8");
    console.log(
      `\n${locale}.json : ${before.length} -> ${after.length} octets (${before.length - after.length} gagnes, ${((100 * (before.length - after.length)) / before.length).toFixed(1)} %)`,
    );
  }
  console.log(`\n${doomed.size} cles supprimees par locale.`);
} else {
  console.log("\n(dry-run : --write pour ecrire)");
}
