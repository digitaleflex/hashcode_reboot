/**
 * HASHCODE REBOOT — Recommendation Engine (V1).
 *
 * Transforme les matches profil → activité en :
 *   - une liste de recommandations pondérées et explicables ;
 *   - une Next Best Action unique et actionnable ;
 *   - un statut explicite (OK / INSUFFICIENT_DATA / NO_MATCH).
 *
 * Déterministe : aucun LLM. Chaque recommandation porte ses raisons.
 */

import type { ProfileAnswers } from "@/lib/profiling/types";
import type { OrientationResult, ActivityRecommendation } from "./types";
import type { ActivityMatch } from "./matching";
import { computeScores, dominantArchetype } from "./scoring";
import { computeConfidence, missingFields } from "./confidence";

/** Seuil minimal de pertinence pour retenir une recommandation. */
export const RECOMMENDATION_MIN_SCORE = 0.3;

/**
 * Seuil minimal de confiance pour proposer une Next Best Action.
 *
 * Le plancher de confiance est de 0.5 dès que les champs structurants sont
 * complets. Un seuil à 0.4 rendrait donc l’état `OK` sans action impossible.
 * 0.6 conserve une action immédiate pour les profils solides tout en laissant
 * exister un état intermédiaire exploitable par l’UX.
 */
export const NEXT_ACTION_CONFIDENCE_THRESHOLD = 0.6;

/** Nombre maximal de recommandations retournées. */
export const MAX_RECOMMENDATIONS = 5;

/** Libellés lisibles des raisons de matching. */
const REASON_LABELS: Record<string, string> = {
  "domain-match": "domaine correspondant",
  "level-match": "niveau correspondant",
  "goal-match": "objectif correspondant",
  "learning-style-match": "style d'apprentissage compatible",
  "availability-match": "disponibilité compatible",
  "builder-activity-fit": "activité idéale pour un profil Builder",
  "strategist-activity-fit": "activité idéale pour un profil Strategist",
  "creator-activity-fit": "activité idéale pour un profil Creator",
  "catalyst-activity-fit": "activité idéale pour un profil Catalyst",
};

/** Construit l'explication lisible de la Next Best Action. */
function buildReason(
  a: ProfileAnswers,
  archetype: string,
  top: ActivityRecommendation,
): string {
  const parts: string[] = [];
  parts.push(`Profil ${archetype} dominant`);
  if (a.primaryDomain) parts.push(`domaine ${a.primaryDomain}`);
  if (a.level) parts.push(`niveau ${a.level}`);
  if (a.goal) parts.push(`objectif « ${a.goal} »`);
  const labels = top.reasons
    .map((r) => REASON_LABELS[r] ?? r)
    .filter(Boolean);
  if (labels.length > 0) parts.push(`correspondances : ${labels.join(", ")}`);
  return parts.join(" • ");
}

/**
 * Produit le résultat d'orientation complet à partir du profil et des matches.
 * Fonction pure : aucune I/O, aucune dépendance UI.
 */
export function generateRecommendations(
  a: ProfileAnswers,
  matches: ActivityMatch[],
): OrientationResult {
  const engineVersion = "1.0.0";
  const scores = computeScores(a);
  const confidence = computeConfidence(a);
  const archetype = dominantArchetype(scores);

  const domains = a.primaryDomain
    ? [a.primaryDomain, ...(a.secondaryDomains ?? [])]
    : a.secondaryDomains ?? [];

  const base = {
    engineVersion,
    domain: a.primaryDomain,
    secondaryDomains: a.secondaryDomains,
    level: a.level,
    goal: a.goal,
    scores,
    confidence,
    domains,
  };

  // 1. Données insuffisantes → pas de recommandation forcée.
  const missing = missingFields(a);
  if (missing.length > 0) {
    return {
      ...base,
      status: "INSUFFICIENT_DATA",
      recommendations: [],
      nextBestAction: null,
      missing,
    };
  }

  // 2. Recommandations au-dessus du seuil.
  const recommendations: ActivityRecommendation[] = matches
    .filter((m) => m.score >= RECOMMENDATION_MIN_SCORE)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((m) => ({
      type: m.activity.type,
      id: m.activity.id,
      score: m.score,
      reasons: m.reasons,
    }));

  // 3. Aucun match pertinent → NO_MATCH (résultat valide, non inventé).
  if (recommendations.length === 0) {
    return {
      ...base,
      status: "NO_MATCH",
      recommendations: [],
      nextBestAction: null,
    };
  }

  // 4. Next Best Action : uniquement si la confiance est suffisante.
  const top = recommendations[0];
  const nextBestAction =
    confidence >= NEXT_ACTION_CONFIDENCE_THRESHOLD
      ? { type: top.type, id: top.id, reason: buildReason(a, archetype, top) }
      : null;

  return {
    ...base,
    status: "OK",
    recommendations,
    nextBestAction,
  };
}
