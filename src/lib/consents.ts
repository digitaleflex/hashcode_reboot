import { z } from "zod";

/**
 * HASHCODE REBOOT — Consentements RGPD (#210, phase 2).
 *
 * Convention maison (cf. schéma Consent) : pas d'enum Prisma — purpose /
 * choice sont des String validées ici par unions Zod. Historique append-only :
 * on ne fait que des create, la lecture du consentement courant = dernière
 * ligne (createdAt max) pour (email, purpose).
 */

/** Finalités reconnues (#212 : "handoff" = accord d'export vers l'écosystème). */
export const CONSENT_PURPOSES = ["cookies", "contact", "profiling", "handoff"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Choix exprimés. */
export const CONSENT_CHOICES = ["granted", "withdrawn"] as const;
export type ConsentChoice = (typeof CONSENT_CHOICES)[number];

/**
 * Marqueur stocké quand le choix est exprimé sans email.
 * Le bandeau cookies et la modale privacy (déjà en prod) postent sans email :
 * l'email est donc OPTIONNEL côté API, jamais côté DB (colonne non nulle).
 */
export const ANONYMOUS_CONSENT_EMAIL = "anonymous";

/** Normalise l'email d'un consentement (vide/absent → marqueur anonyme). */
export function normalizeConsentEmail(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v || ANONYMOUS_CONSENT_EMAIL;
}

/**
 * Bornes anti-abus de `proof` (audit v2 HIGH : JSON libre → borné comme
 * `draft`). La route garde aussi `bodyLimit` (100 Ko) : ces bornes portent
 * sur le contenu décodé, pas sur l'enveloppe HTTP.
 */
export const CONSENT_PROOF_MAX_KEYS = 20;
export const CONSENT_PROOF_KEY_MAX_LEN = 128;
export const CONSENT_PROOF_VALUE_MAX_BYTES = 2048;

/**
 * Garde pure de `proof` (miroir testé dans tests/account-rgpd.test.cjs) :
 * objet plat ≤ 20 clés, clés non vides ≤ 128 caractères, chaque valeur
 * ≤ 2 Ko une fois sérialisée (chaîne brute ou JSON).
 */
export function isConsentProofValid(proof: unknown): boolean {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return false;
  const entries = Object.entries(proof as Record<string, unknown>);
  if (entries.length > CONSENT_PROOF_MAX_KEYS) return false;
  const encoder = new TextEncoder();
  for (const [k, v] of entries) {
    if (!k || k.length > CONSENT_PROOF_KEY_MAX_LEN) return false;
    const serialized = typeof v === "string" ? v : (JSON.stringify(v) ?? "");
    if (encoder.encode(serialized).length > CONSENT_PROOF_VALUE_MAX_BYTES) {
      return false;
    }
  }
  return true;
}

export const consentBodySchema = z.object({
  // Optionnel : bandeau cookies + modale privacy postent sans email.
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  purpose: z.enum(CONSENT_PURPOSES, {
    error: "Finalité inconnue (cookies, contact, profiling, handoff).",
  }),
  choice: z.enum(CONSENT_CHOICES, {
    error: "Choix inconnu (granted, withdrawn).",
  }),
  textVersion: z.string().trim().min(1).max(60),
  proof: z
    .record(z.string(), z.unknown())
    .refine(
      isConsentProofValid,
      "Preuve de consentement invalide (20 clés max, 2 Ko par valeur).",
    )
    .optional(),
  memberId: z.string().trim().max(40).optional(),
});

export type ConsentBody = z.infer<typeof consentBodySchema>;

export const consentQuerySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  purpose: z.enum(CONSENT_PURPOSES).optional(),
});

export type ConsentQuery = z.infer<typeof consentQuerySchema>;

/** Forme minimale d'une ligne Consent pour la sélection de la dernière. */
export interface ConsentLite {
  email: string;
  purpose: string;
  createdAt: Date | string;
}

/**
 * Dernière ligne d'un historique append-only (max createdAt).
 * Miroir DB : GET /api/consents fait l'équivalent via
 * findFirst orderBy { createdAt: "desc" } — même règle, côté pur/testable.
 */
export function pickLatestConsent<T extends ConsentLite>(rows: T[]): T | null {
  let latest: T | null = null;
  for (const r of rows) {
    if (
      !latest ||
      new Date(r.createdAt).getTime() > new Date(latest.createdAt).getTime()
    ) {
      latest = r;
    }
  }
  return latest;
}
