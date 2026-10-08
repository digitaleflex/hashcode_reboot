/**
 * HASHCODE REBOOT — wrapper PapaParse partagé pour les imports CSV.
 *
 * Remplace les parseurs maison (parseCsvLine / detectSeparator / split /
 * stripQuotes) par un vrai parseur RFC 4180 : guillemets, multilignes et
 * séparateurs ,/;/tab gérés nativement.
 *
 * - header:true, skipEmptyLines:"greedy" (lignes vides ignorées).
 * - Séparateur auto-détecté parmi ,/;/tab sur les 5 premières lignes.
 * - Garde-fou taille : 2 Mo max (aligné sur le garde-fou client).
 */

import Papa from "papaparse";

/** Taille max d'un CSV importé (texte) — 2 Mo, comme côté client. */
export const CSV_MAX_BYTES = 2_000_000;

export class CsvTooLargeError extends Error {
  constructor() {
    super("Fichier trop volumineux (2 Mo max). Découpe-le en plusieurs imports.");
    this.name = "CsvTooLargeError";
  }
}

/** Détecte le séparateur dominant (virgule, point-virgule ou tabulation). */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  for (const line of lines) {
    commas += (line.match(/,/g) || []).length;
    semis += (line.match(/;/g) || []).length;
    tabs += (line.match(/\t/g) || []).length;
  }
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis > commas) return ";";
  return ",";
}

/** Normalise un nom d'en-tête pour le mapping colonnes (lowercase + trim). */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

export interface ParsedCsvTable {
  /** Lignes brutes (sans hypothèse d'en-tête), cellules trimmées. */
  rows: string[][];
  delimiter: "," | ";" | "\t";
}

export interface ParsedCsvRecords {
  /** En-têtes normalisés (lowercase + trim). */
  headers: string[];
  /** Enregistrements : clés = en-têtes normalisés, valeurs trimmées. */
  records: Array<Record<string, string>>;
  delimiter: "," | ";" | "\t";
  /** Vrai si la première ligne ressemble à un en-tête (contient "email"). */
  hasHeader: boolean;
}

function assertSize(text: string): void {
  if (text.length > CSV_MAX_BYTES) throw new CsvTooLargeError();
}

/**
 * Parse un CSV en tableau brut (aucune hypothèse d'en-tête).
 * Utilisé quand l'appelant gère lui-même la détection d'en-tête et le
 * mapping positionnel (fallback sans en-tête).
 */
export function parseCsvTable(csvText: string): ParsedCsvTable {
  assertSize(csvText);
  const delimiter = detectDelimiter(csvText);
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    delimiter,
    skipEmptyLines: "greedy",
  });
  const rows = (parsed.data as string[][])
    .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : []))
    .filter((r) => r.length > 0 && r.some((c) => c !== ""));
  return { rows, delimiter };
}

/**
 * Parse un CSV avec en-tête (header:true).
 * Si la première ligne ne ressemble pas à un en-tête (aucune colonne
 * "email"), `hasHeader` vaut false et `records` est vide — l'appelant
 * bascule alors sur parseCsvTable + mapping positionnel.
 */
export function parseCsvRecords(csvText: string): ParsedCsvRecords {
  assertSize(csvText);
  const delimiter = detectDelimiter(csvText);
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (h) => normalizeHeader(h),
    transform: (v) => String(v ?? "").trim(),
  });
  const rawHeaders = (parsed.meta.fields ?? []).map(normalizeHeader);
  const hasHeader = rawHeaders.some(
    (h) => h.includes("email") || h.includes("e-mail") || h.includes("adresse"),
  );
  if (!hasHeader) {
    return { headers: [], records: [], delimiter, hasHeader: false };
  }
  const records = (parsed.data as Array<Record<string, string>>)
    .map((row) => {
      const out: Record<string, string> = {};
      for (const h of rawHeaders) {
        out[h] = String(row[h] ?? "").trim();
      }
      return out;
    })
    // Ignore les lignes entièrement vides résiduelles.
    .filter((r) => Object.values(r).some((v) => v !== ""));
  return { headers: rawHeaders, records, delimiter, hasHeader: true };
}

/**
 * Retrouve la colonne d'un enregistrement par alias d'en-tête.
 * Ex : pickField(rec, ["email", "e-mail", "adresse"]) — premier alias
 * présent (inclusion) gagne, "" sinon.
 */
export function pickField(
  record: Record<string, string>,
  aliases: string[],
): string {
  const keys = Object.keys(record);
  for (const alias of aliases) {
    const hit = keys.find((k) => k.includes(alias));
    if (hit) return record[hit] ?? "";
  }
  return "";
}
