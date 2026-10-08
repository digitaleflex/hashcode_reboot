/**
 * HASHCODE REBOOT — Normalisation de la source d'acquisition (#210, phase 2).
 *
 * Member.source porte l'utm_source/medium/campaign (ou "direct"). Les valeurs
 * arrivent avec casses, espaces et alias variés ("", "unknown", "(direct)",
 * …) : on normalise à la création pour garder l'index source exploitable.
 * Fonction pure → testée dans tests/profiling.test.cjs (miroir).
 */

/** Alias normalisés vers "direct" (tout le reste est conservé tel quel). */
const SOURCE_ALIASES: Record<string, string> = {
  "": "direct",
  "(direct)": "direct",
  "(none)": "direct",
  "n/a": "direct",
  "na": "direct",
  "none": "direct",
  "null": "direct",
  "undefined": "direct",
  "unknown": "direct",
};

/** Lowercase + trim + alias → "direct". Non-string → "direct". */
export function normalizeSource(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return "direct";
  return SOURCE_ALIASES[v] ?? v;
}
