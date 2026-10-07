/**
 * HASHCODE REBOOT — Orientation Engine V1.
 *
 * API publique du moteur d'orientation :
 *
 *   orientationEngine.evaluate(profile) → OrientationResult
 *
 * Le moteur est :
 *  - déterministe (règles pures, aucun LLM/ML) ;
 *  - explicable (chaque recommandation porte ses raisons) ;
 *  - testable (fonctions pures, sans I/O) ;
 *  - versionné (chaque résultat porte `engineVersion`) ;
 *  - reproductible (même entrée → même sortie).
 *
 * Il est indépendant de React, des pages et de Prisma.
 */

import type { ProfileAnswers } from "@/lib/profiling/types";
import type { OrientationResult, Scores } from "./types";
import { computeScores, dominantArchetype, rankedArchetypes } from "./scoring";
import { computeConfidence, missingFields } from "./confidence";
import { matchActivities, topMatches, type ActivityMatch } from "./matching";
import { generateRecommendations } from "./recommendationEngine";

/** Version courante du moteur (à incrémenter lors d'un changement de règles). */
export const ORIENTATION_ENGINE_VERSION = "1.0.0";

/** API métier du moteur d'orientation. */
export const orientationEngine = {
  /** Évalue un profil et produit le résultat d'orientation complet. */
  evaluate(profile: ProfileAnswers): OrientationResult {
    const matches = matchActivities(profile);
    const result = generateRecommendations(profile, matches);
    return { ...result, engineVersion: ORIENTATION_ENGINE_VERSION };
  },

  /** Scores d'archétype seuls (0-1). */
  computeScores(profile: ProfileAnswers): Scores {
    return computeScores(profile);
  },

  /** Confiance seule (0-1, distincte des scores). */
  computeConfidence(profile: ProfileAnswers): number {
    return computeConfidence(profile);
  },

  /** Archétype dominant, selon les scores calculés. */
  dominantArchetype(profile: ProfileAnswers): keyof Scores {
    return dominantArchetype(computeScores(profile));
  },

  /** Archétypes classés par score décroissant. */
  rankedArchetypes(profile: ProfileAnswers): (keyof Scores)[] {
    return rankedArchetypes(computeScores(profile));
  },

  /** Matches bruts profil → activités. */
  matchActivities(profile: ProfileAnswers): ActivityMatch[] {
    return matchActivities(profile);
  },

  /** Top N des matches. */
  topMatches(profile: ProfileAnswers, limit = 5): ActivityMatch[] {
    return topMatches(profile, limit);
  },

  /** Champs structurants manquants (diagnostic). */
  missingFields(profile: ProfileAnswers): string[] {
    return missingFields(profile);
  },

  /** Version courante du moteur. */
  version: ORIENTATION_ENGINE_VERSION,
} as const;

export type { ProfileAnswers, OrientationResult, Scores, ActivityMatch };
