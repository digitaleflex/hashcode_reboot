/**
 * HASHCODE REBOOT — normalisation des champs d'import CSV.
 *
 * Module pur (aucune I/O, aucune dépendance) partagé par :
 * - POST /api/members/import (csvText OU rows)
 * - POST /api/admin/import-invite
 * - PATCH /api/members/[id] (accessLane uniquement)
 *
 * Toutes les fonctions acceptent `unknown`, ne throw jamais et renvoient
 * soit la valeur canonique lowercase, soit `null` quand la valeur est
 * inconnue (c'est le schéma Zod appelant qui émet le message FR).
 */

import type { AccessLane, Domain, Level } from "@/lib/profiling/types";

export const CANONICAL_ACCESS_LANES: readonly AccessLane[] = [
  "immediate",
  "pending",
] as const;

export const CANONICAL_LEVELS: readonly Level[] = [
  "beginner",
  "practicing",
  "autonomous",
  "advanced",
] as const;

export const CANONICAL_DOMAINS: readonly Domain[] = [
  "web",
  "cybersecurity",
  "ai",
] as const;

/** Minuscules + trim + suppression des diacritiques (immédiate → immediate). */
function fold(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalise une voie d'accès vers "immediate" | "pending".
 * Alias FR : immédiate/immédiat → immediate, en traitement → pending.
 * Renvoie `null` si inconnu (dont chaîne vide — le schéma décide du requis).
 */
export function normalizeAccessLane(raw: unknown): AccessLane | null {
  const s = fold(raw);
  if (!s) return null;
  if (
    s === "immediate" ||
    s === "immediat" ||
    s === "immediatee" ||
    s === "immediat(e)" ||
    s === "immediate-access" ||
    s === "acces-immediat" ||
    s === "acces immediat"
  )
    return "immediate";
  if (
    s === "pending" ||
    s === "en traitement" ||
    s === "en-traitement" ||
    s === "en_traitement" ||
    s === "en attente" ||
    s === "en-attente" ||
    s === "attente"
  )
    return "pending";
  return null;
}

/**
 * Normalise un niveau vers beginner|practicing|autonomous|advanced.
 * Alias FR (miroir du mapping historique de import-invite) :
 * débutant → beginner, inter* → practicing, autonome → autonomous,
 * avancé/avance/expert → advanced. `null` si inconnu.
 */
export function normalizeLevel(raw: unknown): Level | null {
  const s = fold(raw);
  if (!s) return null;
  if (s === "beginner" || s === "debutant" || s === "debutante")
    return "beginner";
  if (
    s === "practicing" ||
    s.startsWith("inter") ||
    s === "intermediaire" ||
    s === "pratiquant" ||
    s === "pratique"
  )
    return "practicing";
  if (s === "autonomous" || s === "autonome") return "autonomous";
  if (
    s === "advanced" ||
    s.startsWith("avanc") ||
    s === "avance" ||
    s === "avancee" ||
    s === "expert"
  )
    return "advanced";
  return null;
}

/**
 * Normalise un domaine vers web|cybersecurity|ai.
 * Alias FR : cyber, securite → cybersecurity, ia → ai, dev → web.
 * `null` si inconnu.
 */
export function normalizeDomain(raw: unknown): Domain | null {
  const s = fold(raw);
  if (!s) return null;
  if (s === "web" || s.startsWith("dev") || s === "developpement")
    return "web";
  if (
    s === "cybersecurity" ||
    s === "cyber" ||
    s === "cybersecurite" ||
    s === "securite" ||
    s === "security"
  )
    return "cybersecurity";
  if (s === "ai" || s === "ia" || s === "intelligence artificielle")
    return "ai";
  return null;
}

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "cote d'ivoire": "CI",
  ivoire: "CI",
  senegal: "SN",
  benin: "BJ",
  cameroun: "CM",
  mali: "ML",
  niger: "NE",
  "burkina faso": "BF",
  burkina: "BF",
  togo: "TG",
  congo: "CG",
  "republique du congo": "CG",
  rdc: "CD",
  "republique democratique du congo": "CD",
  tunisie: "TN",
  maroc: "MA",
  algerie: "DZ",
  gabon: "GA",
  guinee: "GN",
  france: "FR",
  belgique: "BE",
  suisse: "CH",
  canada: "CA",
  luxembourg: "LU",
};

/**
 * Normalise un pays vers un code ISO 3166-1 alpha-2 (majuscules).
 * - 2 lettres → uppercase direct ("fr" → "FR").
 * - Nom FR connu → code (miroir du mapping historique de import-invite).
 * - Chaîne vide / "autres pays du monde" → "" (inconnu, pas d'erreur).
 * - Nom inconnu → "" (best-effort : on ne bloque jamais l'import sur ça).
 */
export function normalizeCountry(raw: unknown): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const s = fold(trimmed);
  if (!s || s === "autres pays du monde" || s === "autre") return "";
  return COUNTRY_NAME_TO_ISO[s] ?? "";
}
