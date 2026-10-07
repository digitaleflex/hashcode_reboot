/**
 * HASHCODE REBOOT — Calcul de confiance du moteur d'orientation.
 *
 * RÈGLE FONDAMENTALE : score ≠ confiance.
 *
 * Un score élevé ("Builder = 0.82") dit quelles règles ont réagi, pas si le
 * système en sait assez. La confiance mesure la QUALITÉ et la SOLIDITÉ des
 * données utilisées (complétude, cohérence, qualité email, richesse du but).
 *
 * La confiance est volontairement indépendante des valeurs de scores.
 */

import type { ProfileAnswers } from "@/lib/profiling/types";
import { EMAIL_RE, DISPOSABLE_DOMAINS } from "@/lib/profiling/engine";

/** Champs considérés comme structurants pour une orientation fiable. */
const REQUIRED_FIELDS: (keyof ProfileAnswers)[] = [
  "firstName",
  "lastName",
  "email",
  "primaryDomain",
  "level",
  "goal",
  "availability",
];

/** Un champ est-il renseigné et informatif ? */
function isFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") {
    const s = v.trim();
    return s !== "" && s !== "unknown" && s !== "not_now";
  }
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Calcule la confiance 0-1.
 *
 * Facteurs :
 *  - complétude des champs structurants (poids fort) ;
 *  - validité de l'email (poids moyen — un email jetable n'est pas fiable) ;
 *  - richesse de l'objectif à 3 mois (signal de sérieux) ;
 *  - présence de signaux secondaires (spécialité, style, mentorat).
 */
export function computeConfidence(a: ProfileAnswers): number {
  const parts: { value: number; weight: number }[] = [];

  // 1. Complétude
  const filled = REQUIRED_FIELDS.filter((k) => isFilled(a[k])).length;
  const completion = REQUIRED_FIELDS.length > 0 ? filled / REQUIRED_FIELDS.length : 0;
  parts.push({ value: completion, weight: 0.5 });

  // 2. Qualité de l'email
  const email = (a.email ?? "").trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  let emailQuality = 0;
  if (EMAIL_RE.test(email)) {
    emailQuality = DISPOSABLE_DOMAINS.has(domain) ? 0.3 : 1;
  }
  parts.push({ value: emailQuality, weight: 0.25 });

  // 3. Richessse du but à 3 mois
  const goalLen = (a.threeMonthGoal ?? "").trim().length;
  const goalSignal = goalLen >= 40 ? 1 : goalLen >= 12 ? 0.6 : goalLen > 0 ? 0.3 : 0;
  parts.push({ value: goalSignal, weight: 0.15 });

  // 4. Signaux secondaires
  let secondary = 0;
  if (a.domainSpecialty && a.domainSpecialty.length > 0) secondary += 0.4;
  if (a.learningStyle) secondary += 0.3;
  if (a.mentoringInterest) secondary += 0.3;
  parts.push({ value: Math.min(secondary, 1), weight: 0.1 });

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const weighted = parts.reduce((s, p) => s + p.value * p.weight, 0);
  const confidence = totalWeight > 0 ? weighted / totalWeight : 0;

  return Math.max(0, Math.min(1, Number(confidence.toFixed(4))));
}

/** Liste les champs structurants manquants (pour le statut INSUFFICIENT_DATA). */
export function missingFields(a: ProfileAnswers): string[] {
  return REQUIRED_FIELDS.filter((k) => !isFilled(a[k])).map(String);
}
