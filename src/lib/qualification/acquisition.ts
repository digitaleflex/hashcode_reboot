/**
 * HASHCODE REBOOT — Qualification acquisition V1 (#211, bornée C1).
 *
 * Fonction PURE, zéro I/O : qualifyLead(answers) → { score, status, reasons,
 * ruleVersion }. Complète la décision existante runAutoControls (lane
 * immédiate vs revue humaine) sans la remplacer : ici on fige un snapshot de
 * qualification d'entrée sur la ligne Qualification (append-only, jamais
 * recalculé), là-bas on branche l'accès.
 *
 * Frontière (docs/architecture/reboot-joinhashcode-boundary.md) :
 * - AUCUN archétype / spécialisation / parcours / recommandation produit ici.
 * - Dépendances restreintes aux types de profilage, aux validateurs, à la
 *   normalisation de source et aux constantes email recopiées ci-dessous.
 *   Sont exclus : tout ce qui calcule une orientation, génère un profil,
 *   apparie des membres ou expose des couches et vues dynamiques de profil.
 *   EMAIL_RE / DISPOSABLE_DOMAINS sont recopiés ci-dessous (copie figée,
 *   PAS d'import du moteur).
 *
 * TABLE DE POIDS PUBLIÉE (somme max = 100) :
 * | signal              | poids | règle                                              |
 * |---------------------|-------|----------------------------------------------------|
 * | CORE_COMPLETE       |  +30   | email valide + firstName + primaryDomain + goal    |
 * |                     |       |   + level + availability (même gate que les       |
 * |                     |       |   auto-controls) → "core-complete" / "missing-core"|
 * | EMAIL_QUALITY       |  +20   | email valide ET domaine non jetable                |
 * |                     |       |   → "email-verified" / "disposable-email" /       |
 * |                     |       |   "invalid-email"                                  |
 * | GOAL_RICHNESS       |  +20   | threeMonthGoal ≥ 20 car. → +20 "goal-rich" ;       |
 * |                     |       |   ≥ 4 car. (miroir validate.ts) → +10              |
 * |                     |       |   "goal-present" ; sinon 0 "low-signal-goal"       |
 * | AVAILABILITY        |  +10   | disponibilité renseignée : "<2h" → +5              |
 * |                     |       |   "low-availability", autre → +10                  |
 * |                     |       |   "availability-given", absente → 0                |
 * |                     |       |   "missing-availability"                           |
 * | MENTORING_INTENT    |  +10   | mentoring "yes" + budget réel → +10                |
 * |                     |       |   "mentoring-budget-ready" ; "yes" sans budget → +6|
 * |                     |       |   "mentoring-interest-no-budget" ; "maybe" → +5    |
 * |                     |       |   "mentoring-maybe" ; sinon 0 "no-mentoring-signal"|
 * | SOURCE_ATTRIBUTED   |  +10   | source normalisée ≠ "direct" → +10                 |
 * |                     |       |   "source-attributed" ; "direct" → +4              |
 * |                     |       |   "source-direct"                                  |
 *
 * STATUTS :
 * - noyau incomplet → INSUFFICIENT_DATA (le score reste calculé à titre
 *   indicatif, la ligne dit "données insuffisantes") ;
 * - email invalide ou jetable → DISQUALIFIED (canal de contact non fiable) ;
 * - sinon score ≥ QUALIFIED_THRESHOLD (75) → QUALIFIED, sinon DISQUALIFIED.
 *
 * Déterministe : même entrée + même ruleVersion = même résultat
 * (aucun Date.now / random / I/O).
 */

import type { ProfileAnswers } from "../profiling/types";
import { normalizeSource } from "../acquisition";

/** Version de règle tracée sur chaque ligne acquisition (préfixe acq- OBLIGATOIRE). */
export const ACQUISITION_QUALIFICATION_RULE_VERSION = "acq-qualif-1.0.0";

/** Poids publiés (recopiés dans docs/acquisition-contracts.md et les tests). */
export const RULE_WEIGHTS = {
  CORE_COMPLETE: 30,
  EMAIL_QUALITY: 20,
  GOAL_RICHNESS: 20,
  AVAILABILITY: 10,
  MENTORING_INTENT: 10,
  SOURCE_ATTRIBUTED: 10,
} as const;

/** Seuil de qualification (score ≥ seuil → QUALIFIED). */
export const QUALIFIED_THRESHOLD = 75;

export type AcquisitionStatus =
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "INSUFFICIENT_DATA";

export interface AcquisitionQualification {
  score: number;
  status: AcquisitionStatus;
  reasons: string[];
  ruleVersion: string;
}

// ── Constantes email recopiées à l'identique du moteur de profilage ───────
// ── (copie figée — ne JAMAIS importer le moteur ici, voir en-tête) ────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "sharklasers.com",
  "dispostable.com",
]);

export interface AcquisitionQualification {
  score: number;
  status: AcquisitionStatus;
  reasons: string[];
  ruleVersion: string;
}

/**
 * Score un lead d'acquisition. Pur et total : n'échoue jamais, ne lit
 * ni n'écrit rien hors de ses arguments.
 *
 * `source` n'appartient pas à ProfileAnswers (elle vit sur Member via
 * normalizeSource) : elle est lue en option quand l'appelant la fournit
 * (ex. payload Zod validé de POST /api/members, qui inclut `source`).
 */
export function qualifyLead(
  answers: ProfileAnswers & { source?: unknown },
): AcquisitionQualification {
  const reasons: string[] = [];
  let score = 0;

  // 1. Complétude noyau (même gate que runAutoControls).
  const email = (answers.email ?? "").trim().toLowerCase();
  const emailValid = EMAIL_RE.test(email);
  const coreComplete =
    emailValid &&
    (answers.firstName ?? "").trim().length >= 1 &&
    !!answers.primaryDomain &&
    !!answers.goal &&
    !!answers.level &&
    !!answers.availability;
  if (coreComplete) {
    score += RULE_WEIGHTS.CORE_COMPLETE;
    reasons.push("core-complete");
  } else {
    reasons.push("missing-core");
  }

  // 2. Qualité email.
  const domain = email.split("@")[1] ?? "";
  if (!emailValid) {
    reasons.push("invalid-email");
  } else if (DISPOSABLE_DOMAINS.has(domain)) {
    reasons.push("disposable-email");
  } else {
    score += RULE_WEIGHTS.EMAIL_QUALITY;
    reasons.push("email-verified");
  }

  // 3. Richesse de l'objectif 3 mois (seuil 4 car. = miroir validate.ts).
  const goalLen = (answers.threeMonthGoal ?? "").trim().length;
  if (goalLen >= 20) {
    score += RULE_WEIGHTS.GOAL_RICHNESS;
    reasons.push("goal-rich");
  } else if (goalLen >= 4) {
    score += 10;
    reasons.push("goal-present");
  } else {
    reasons.push("low-signal-goal");
  }

  // 4. Disponibilité.
  if (!answers.availability) {
    reasons.push("missing-availability");
  } else if (answers.availability === "<2h") {
    score += 5;
    reasons.push("low-availability");
  } else {
    score += RULE_WEIGHTS.AVAILABILITY;
    reasons.push("availability-given");
  }

  // 5. Intention mentorat / budget.
  const budget = answers.budgetRange;
  const hasRealBudget =
    budget !== undefined && budget !== "unknown" && budget !== "not_now";
  if (answers.mentoringInterest === "yes" && hasRealBudget) {
    score += RULE_WEIGHTS.MENTORING_INTENT;
    reasons.push("mentoring-budget-ready");
  } else if (answers.mentoringInterest === "yes") {
    score += 6;
    reasons.push("mentoring-interest-no-budget");
  } else if (answers.mentoringInterest === "maybe") {
    score += 5;
    reasons.push("mentoring-maybe");
  } else {
    reasons.push("no-mentoring-signal");
  }

  // 6. Source normalisée (même normalisation que Member.source).
  const source = normalizeSource(answers.source);
  if (source !== "direct") {
    score += RULE_WEIGHTS.SOURCE_ATTRIBUTED;
    reasons.push("source-attributed");
  } else {
    score += 4;
    reasons.push("source-direct");
  }

  // Statut : noyau d'abord, canal ensuite, seuil enfin.
  let status: AcquisitionStatus;
  if (!coreComplete) {
    status = "INSUFFICIENT_DATA";
  } else if (!emailValid || DISPOSABLE_DOMAINS.has(domain)) {
    status = "DISQUALIFIED";
  } else {
    status = score >= QUALIFIED_THRESHOLD ? "QUALIFIED" : "DISQUALIFIED";
  }

  return {
    score,
    status,
    reasons,
    ruleVersion: ACQUISITION_QUALIFICATION_RULE_VERSION,
  };
}
