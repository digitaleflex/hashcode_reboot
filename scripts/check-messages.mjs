import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fr = JSON.parse(fs.readFileSync(path.join(dir, "..", "messages", "fr.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(dir, "..", "messages", "en.json"), "utf8"));

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
