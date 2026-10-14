#!/usr/bin/env node
/**
 * DS-FOUNDATIONS — vérification de contraste WCAG 2.2 des tokens live.
 *
 * Lit les valeurs de `src/app/globals.css` (`:root`), résout les `var()`,
 * puis calcule le ratio de contraste WCAG des paires sémantiques du design
 * system. Échoue (exit 1) si une paire de texte descend sous son seuil.
 *
 * Aucune dépendance : le fichier CSS est la source unique de vérité, donc
 * changer un token met à jour cette vérification automatiquement.
 *
 * Usage : node scripts/check-contrast.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(dir, "..", "src", "app", "globals.css"), "utf8");

/* ------------------------------------------------------------------ */
/* Parsing des tokens                                                  */
/* ------------------------------------------------------------------ */

/** Premier bloc `:root { ... }` (tokens de base). */
function parseRootTokens(source) {
  const start = source.indexOf(":root");
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  const block = source.slice(open + 1, close);
  const tokens = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (m) tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const TOKENS = parseRootTokens(css);

function resolveToken(name, seen = new Set()) {
  if (seen.has(name)) return undefined;
  seen.add(name);
  const raw = TOKENS[name];
  if (raw === undefined) return undefined;
  const varMatch = raw.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (varMatch) return resolveToken(varMatch[1], seen);
  return raw;
}

/* ------------------------------------------------------------------ */
/* Conversions couleur -> sRGB [0..1]                                  */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** OKLCH -> sRGB linéaire -> sRGB gamma. Algorithme Björn Ottosson. */
function oklchToRgb(str) {
  const m = str.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = parseFloat(m[2]);
  const h = (parseFloat(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const gamma = (c) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return lin.map((v) => Math.max(0, Math.min(1, gamma(v))));
}

function toRgb(value) {
  if (!value) return null;
  if (value.startsWith("#")) return hexToRgb(value);
  if (value.startsWith("oklch")) return oklchToRgb(value);
  if (value.startsWith("rgb")) {
    const nums = value.match(/[\d.]+/g)?.map(Number) ?? [];
    return nums.slice(0, 3).map((v) => (v > 1 ? v / 255 : v));
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Contraste WCAG                                                      */
/* ------------------------------------------------------------------ */

const linearize = (c) =>
  c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const luminance = ([r, g, b]) =>
  0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

function contrast(fgToken, bgToken) {
  const fg = toRgb(resolveToken(fgToken));
  const bg = toRgb(resolveToken(bgToken));
  if (!fg || !bg) return null;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ */
/* Paires attendues                                                    */
/* ------------------------------------------------------------------ */

// [fgToken, bgToken, seuil, label, enforce] — enforce=false => informatif.
// seuil : 4.5 = texte normal (AA), 3 = grand texte / UI non textuelle (AA).
const PAIRS = [
  ["--foreground", "--background", 4.5, "texte principal / page", true],
  ["--foreground", "--card", 4.5, "texte principal / carte", true],
  ["--foreground", "--secondary", 4.5, "texte principal / surface élevée", true],
  ["--muted-foreground", "--background", 4.5, "texte secondaire / page", true],
  ["--muted-foreground", "--card", 4.5, "texte secondaire / carte", true],
  ["--primary", "--background", 4.5, "accent lime (texte) / page", true],
  ["--primary", "--card", 4.5, "accent lime (texte) / carte", true],
  ["--primary-foreground", "--primary", 4.5, "libellé sur CTA lime", true],
  ["--destructive", "--background", 3, "erreur (texte grand/UI) / page", true],
  ["--input", "--background", 3, "bordure de champ / page (UI)", true],
  ["--input", "--card", 3, "bordure de champ / carte (UI)", true],
  // Hairlines décoratives : valeur mesurée documentée, non bloquante (la
  // séparation des surfaces n'est pas le seul vecteur d'information).
  ["--border", "--background", 3, "hairline / page (décoratif)", false],
  ["--border", "--card", 3, "hairline / carte (décoratif)", false],
];

let failures = 0;
console.log("# Contraste WCAG 2.2 — tokens live (src/app/globals.css)\n");
console.log(
  "paire".padEnd(46) +
    "ratio".padStart(8) +
    "seuil".padStart(8) +
    "  résultat",
);
console.log("-".repeat(80));

for (const [fg, bg, min, label, enforce] of PAIRS) {
  const ratio = contrast(fg, bg);
  const name = `${label}`;
  if (ratio === null) {
    console.log(name.padEnd(46) + "n/a".padStart(8) + String(min).padStart(8) + "  ⚠ ignoré");
    continue;
  }
  const ok = ratio >= min;
  if (!ok && enforce) failures++;
  const verdict = ok ? "✓" : enforce ? "✗ ÉCHEC" : "• info (décoratif)";
  console.log(
    name.padEnd(46) +
      ratio.toFixed(2).padStart(8) +
      String(min).padStart(8) +
      "  " +
      verdict,
  );
}

console.log("-".repeat(80));
if (failures > 0) {
  console.error(`\n${failures} paire(s) sous le seuil.`);
  process.exit(1);
}
console.log("\nToutes les paires respectent leur seuil WCAG AA.");
