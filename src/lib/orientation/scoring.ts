/**
 * HASHCODE REBOOT — Moteur de scoring d'orientation (V1).
 *
 * Règles pures, déterministes et explicables. Aucun LLM, aucun ML.
 *
 * Principe :
 *   1. On dérive un ensemble de "features" booléennes depuis ProfileAnswers.
 *   2. Chaque archétype possède une table de poids sur ces features.
 *   3. Score = (Σ poids des features présentes) / (Σ poids positifs) → 0-1.
 *
 * Chaque score est donc reproductible et auditable : on peut expliquer
 * exactement quelles réponses ont contribué au score d'un archétype.
 */

import type { ProfileAnswers } from "@/lib/profiling/types";
import type { Scores } from "./types";

/** Feature booléenne dérivée des réponses. */
export type FeatureKey =
  | "goal:project"
  | "goal:employment"
  | "goal:freelance"
  | "goal:business"
  | "goal:upskill"
  | "goal:career"
  | "level:beginner"
  | "level:practicing"
  | "level:autonomous"
  | "level:advanced"
  | "style:practice"
  | "style:path"
  | "style:group"
  | "style:mentor"
  | "style:project"
  | "avail:low"
  | "avail:mid"
  | "avail:high"
  | "mentoring:yes"
  | "mentoring:maybe"
  | "domain:web"
  | "domain:ai"
  | "domain:cybersecurity";

/** Extrait les features présentes pour un profil donné. */
export function extractFeatures(a: ProfileAnswers): Set<FeatureKey> {
  const f = new Set<FeatureKey>();

  if (a.goal) f.add(`goal:${a.goal}` as FeatureKey);
  if (a.level) f.add(`level:${a.level}` as FeatureKey);
  if (a.learningStyle) f.add(`style:${a.learningStyle}` as FeatureKey);

  switch (a.availability) {
    case "<2h":
      f.add("avail:low");
      break;
    case "2-5h":
    case "5-10h":
      f.add("avail:mid");
      break;
    case "10-15h":
    case "15h+":
      f.add("avail:high");
      break;
  }

  if (a.mentoringInterest === "yes") f.add("mentoring:yes");
  if (a.mentoringInterest === "maybe") f.add("mentoring:maybe");

  if (a.primaryDomain) f.add(`domain:${a.primaryDomain}` as FeatureKey);

  return f;
}

/**
 * Tables de poids par archétype.
 * Toutes les clés sont optionnelles : l'absence = poids nul.
 */
type WeightTable = Partial<Record<FeatureKey, number>>;

const WEIGHTS: Record<keyof Scores, WeightTable> = {
  // Builder : construire, pratiquer, exécuter des projets.
  builder: {
    "goal:project": 0.5,
    "goal:employment": 0.2,
    "goal:freelance": 0.15,
    "level:practicing": 0.4,
    "level:autonomous": 0.6,
    "level:advanced": 0.8,
    "style:practice": 0.4,
    "style:project": 0.4,
    "style:mentor": 0.2,
    "avail:high": 0.3,
    "mentoring:yes": 0.25,
    "domain:web": 0.2,
  },

  // Strategist : vision, structure, planification, montée en compétence.
  strategist: {
    "goal:business": 0.6,
    "goal:career": 0.5,
    "goal:upskill": 0.4,
    "goal:employment": 0.3,
    "level:autonomous": 0.5,
    "level:advanced": 0.7,
    "style:path": 0.6,
    "avail:high": 0.25,
    "mentoring:maybe": 0.2,
  },

  // Creator : créer, designer, inventer, mener un projet de bout en bout.
  creator: {
    "goal:project": 0.7,
    "goal:freelance": 0.4,
    "goal:business": 0.4,
    "level:autonomous": 0.4,
    "level:advanced": 0.5,
    "style:path": 0.4,
    "style:project": 0.5,
    "avail:high": 0.3,
  },

  // Catalyst : relier, collaborer, faciliter, faire grandir les autres.
  catalyst: {
    "goal:employment": 0.5,
    "goal:freelance": 0.4,
    "goal:project": 0.2,
    "style:group": 0.7,
    "style:mentor": 0.6,
    "avail:high": 0.2,
    "mentoring:yes": 0.5,
    "mentoring:maybe": 0.25,
    "domain:cybersecurity": 0.1,
    "domain:ai": 0.1,
  },
};

/** Score brut 0-1 pour un archétype : poids présents / poids positifs totaux. */
function scoreArchetype(features: Set<FeatureKey>, table: WeightTable): number {
  let gained = 0;
  let possible = 0;
  for (const key of Object.keys(table) as FeatureKey[]) {
    const w = table[key] ?? 0;
    if (w <= 0) continue;
    possible += w;
    if (features.has(key)) gained += w;
  }
  if (possible === 0) return 0;
  return gained / possible;
}

/** Calcule les quatre scores d'archétype (0-1). */
export function computeScores(a: ProfileAnswers): Scores {
  const features = extractFeatures(a);
  return {
    builder: scoreArchetype(features, WEIGHTS.builder),
    strategist: scoreArchetype(features, WEIGHTS.strategist),
    creator: scoreArchetype(features, WEIGHTS.creator),
    catalyst: scoreArchetype(features, WEIGHTS.catalyst),
  };
}

/** Archétype dominant (à égalité : ordre stable builder → catalyst). */
export function dominantArchetype(scores: Scores): keyof Scores {
  const order: (keyof Scores)[] = ["builder", "strategist", "creator", "catalyst"];
  return order.reduce((best, key) => (scores[key] > scores[best] ? key : best), order[0]);
}

/** Trie les archétypes par score décroissant (ordre stable). */
export function rankedArchetypes(scores: Scores): (keyof Scores)[] {
  const order: (keyof Scores)[] = ["builder", "strategist", "creator", "catalyst"];
  return [...order].sort((a, b) => scores[b] - scores[a]);
}
