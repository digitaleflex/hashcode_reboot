/**
 * HASHCODE REBOOT — Matching profil → activité (V1).
 *
 * Associe un profil aux activités réellement disponibles dans l'écosystème
 * HashCode. Fonctions pures, déterministes, explicables.
 *
 * RÈGLES :
 *  - on ne matche que des activités `published` ;
 *  - chaque score de match est décomposé en raisons stables ;
 *  - l'archétype dominant module la pertinence par type d'activité ;
 *  - "pas de match" est un résultat valide (score < seuil).
 */

import type { ProfileAnswers } from "@/lib/profiling/types";
import type { ActivityType, Scores } from "./types";
import type { AvailableActivity } from "./features";
import { getPublishedActivities, getActivityCatalogue, type ActivityCatalogue } from "./catalogue";
import { computeScores, dominantArchetype } from "./scoring";

/** Résultat de matching pour une activité donnée. */
export interface ActivityMatch {
  activity: AvailableActivity;
  /** Pertinence 0-1. */
  score: number;
  /** Codes de raison stables (ex. "domain-match"). */
  reasons: string[];
}

/** Affinité d'un archétype dominant pour un type d'activité. */
const ARCHETYPE_AFFINITY: Record<keyof Scores, Partial<Record<ActivityType, number>>> = {
  builder: { challenge: 0.2, workshop: 0.15, project: 0.2, learning_path: 0.1 },
  strategist: { learning_path: 0.2, content: 0.2, workshop: 0.1 },
  creator: { project: 0.2, challenge: 0.15, workshop: 0.1 },
  catalyst: { community: 0.2, mentoring: 0.2, event: 0.15 },
};

/** Pondérations du matching (documentées, versionnables). */
export const MATCH_WEIGHTS = {
  domain: 0.4,
  level: 0.25,
  goal: 0.2,
  learningStyle: 0.15,
  availability: 0.1,
  archetypeAffinityMax: 0.2,
} as const;

/** Vérifie qu'au moins un critère d'une liste correspond (liste vide = ouvert). */
function compatible<T>(wanted: T | undefined, allowed: T[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true; // activité ouverte à tous
  if (wanted === undefined) return false;
  return allowed.includes(wanted);
}

/**
 * Score de pertinence d'une activité pour un profil + scores déjà calculés.
 * Retourne un score borné [0,1] et ses raisons.
 */
export function scoreActivity(
  a: ProfileAnswers,
  scores: Scores,
  activity: AvailableActivity,
): ActivityMatch {
  const reasons: string[] = [];
  let score = 0;

  // Domaine (critère fort).
  if (compatible(a.primaryDomain, activity.domains)) {
    if (a.primaryDomain && activity.domains?.includes(a.primaryDomain)) {
      score += MATCH_WEIGHTS.domain;
      reasons.push("domain-match");
    }
  }

  // Niveau.
  if (compatible(a.level, activity.levels)) {
    if (a.level && activity.levels?.includes(a.level)) {
      score += MATCH_WEIGHTS.level;
      reasons.push("level-match");
    }
  }

  // Objectif.
  if (compatible(a.goal, activity.goals)) {
    if (a.goal && activity.goals?.includes(a.goal)) {
      score += MATCH_WEIGHTS.goal;
      reasons.push("goal-match");
    }
  }

  // Style d'apprentissage.
  if (compatible(a.learningStyle, activity.learningStyles)) {
    if (a.learningStyle && activity.learningStyles?.includes(a.learningStyle)) {
      score += MATCH_WEIGHTS.learningStyle;
      reasons.push("learning-style-match");
    }
  }

  // Disponibilité (comparaison de charge hebdo, souple).
  if (a.availability && activity.timeCommitment) {
    if (availabilityFits(a.availability, activity.timeCommitment)) {
      score += MATCH_WEIGHTS.availability;
      reasons.push("availability-match");
    }
  }

  // Affinité d'archétype.
  const archetype = dominantArchetype(scores);
  const affinity = ARCHETYPE_AFFINITY[archetype]?.[activity.type] ?? 0;
  if (affinity > 0) {
    score += affinity;
    reasons.push(`${archetype}-activity-fit`);
  }

  return { activity, score: Math.max(0, Math.min(1, Number(score.toFixed(4)))), reasons };
}

/** Heures/semaine indicatives par palier de disponibilité. */
const AVAILABILITY_HOURS: Record<string, number> = {
  "<2h": 1,
  "2-5h": 3,
  "5-10h": 7,
  "10-15h": 12,
  "15h+": 18,
};

/** Vérifie qu'un palier de disponibilité peut absorber la charge d'une activité. */
function availabilityFits(availability: string, timeCommitment: string): boolean {
  // Extraction naïve du maximum d'heures/semaine de la charge activité.
  const commitment = timeCommitment.toLowerCase();
  // Formats supportés : "2-5h", "5-10h", "<2h", "10-15h".
  const upper = commitment.includes("+")
    ? 20
    : Number(commitment.split("-")[1]?.replace("h", "") ?? commitment.replace("h", "")) || 0;
  const capacity = AVAILABILITY_HOURS[availability] ?? 0;
  if (upper === 0) return true; // charge inconnue → pas de pénalité
  return capacity >= upper;
}

/** Matche toutes les activités publiées, triées par pertinence décroissante. */
export function matchActivities(
  a: ProfileAnswers,
  catalogue: ActivityCatalogue = getActivityCatalogue(),
): ActivityMatch[] {
  return matchActivityList(a, getPublishedActivities(catalogue));
}

/** Matche une liste d'activités injectée (catalogue DB ou seed). */
export function matchActivityList(
  a: ProfileAnswers,
  activities: AvailableActivity[],
): ActivityMatch[] {
  const scores = computeScores(a);
  return activities
    .filter((activity) => activity.status === "published")
    .map((activity) => scoreActivity(a, scores, activity))
    .sort((x, y) => y.score - x.score);
}

/** Sens inverse : classe des profils pour UNE activité (activity → members). */
export function rankMembersForActivity(
  activity: AvailableActivity,
  profiles: { id: string; answers: ProfileAnswers }[],
  limit = 10,
): { id: string; score: number; reasons: string[] }[] {
  if (activity.status !== "published") return [];
  return profiles
    .map((p) => {
      const m = scoreActivity(p.answers, computeScores(p.answers), activity);
      return { id: p.id, score: m.score, reasons: m.reasons };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, Math.max(1, limit));
}

/** Retourne le top N des matches (par défaut 5). */
export function topMatches(
  a: ProfileAnswers,
  limit = 5,
  catalogue: ActivityCatalogue = getActivityCatalogue(),
): ActivityMatch[] {
  return matchActivities(a, catalogue).slice(0, Math.max(1, limit));
}
