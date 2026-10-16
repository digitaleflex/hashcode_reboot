/**
 * Déduplication des leads (#103) — fonctions pures + exécuteur injectable.
 *
 * Règles :
 *   - email normalisé identique → EXACT (fusionnable sans réserve) ;
 *   - téléphone normalisé identique (emails différents) → AMBIGU (contrôle
 *     humain : `acknowledgeAmbiguous` exigé) ;
 *   - tout le reste (homonymes, etc.) → JAMAIS fusionné automatiquement.
 *   - Gmail/Googlemail : points ignorés, sous-adresses (+) retirées (règles
 *     documentées du fournisseur). Autres domaines : points conservés.
 *   - Blacklist jamais touchée ; comptes d'auth Better Auth hors périmètre
 *     (le login par email du perdant tombe en 401 après soft-delete).
 */

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  const at = trimmed.lastIndexOf("@");
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.split("+")[0]!.replace(/\./g, "");
  }
  const out = `${local}@${domain}`;
  return out.length > 0 && out.length <= 320 ? out : null;
}

/** Digits + `+` initial éventuel, séparateurs retirés. `""`/absent → null. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (!stripped) return null;
  const out = stripped.startsWith("+") ? "+" + stripped.slice(1).replace(/\D/g, "") : stripped.replace(/\D/g, "");
  return out.length >= 7 && out.length <= 20 ? out : null;
}

export type DuplicateKind = "EXACT" | "AMBIGUOUS";

export interface DuplicateCandidate {
  memberIds: string[];
  kind: DuplicateKind;
  reason: string;
}

/** EXACT si même email normalisé, sinon AMBIGU si même téléphone normalisé. */
export function classifyPair(
  a: { email: string; phone?: string | null },
  b: { email: string; phone?: string | null },
): DuplicateKind | null {
  const ea = normalizeEmail(a.email);
  const eb = normalizeEmail(b.email);
  if (ea && eb && ea === eb) return "EXACT";
  const pa = normalizePhone(a.phone);
  const pb = normalizePhone(b.phone);
  if (pa && pb && pa === pb) return "AMBIGUOUS";
  return null;
}

/** Champs scalaires copiés du perdant UNIQUEMENT si vides chez le gagnant. */
export const MERGE_FILL_FIELDS = [
  "lastName",
  "phone",
  "city",
  "secondaryDomains",
  "domainSpecialty",
  "goalProjectStage",
  "goalSituation",
  "availabilityTimes",
  "mentoringMaybeReason",
  "mentoringTypes",
  "mentoringFrequency",
  "mentoringDomain",
  "budgetWillingness",
  "budgetRange",
  "threeMonthGoal",
] as const;

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== "string") return false;
  const t = v.trim();
  return t === "" || t === "[]";
}

/** Valeurs à copier : { champ: valeurPerdant } pour les trous du gagnant. */
export function mergeFillValues(
  winner: Record<string, unknown>,
  loser: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of MERGE_FILL_FIELDS) {
    if (isEmptyValue(winner[f]) && !isEmptyValue(loser[f])) {
      out[f] = loser[f];
    }
  }
  return out;
}
