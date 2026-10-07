/**
 * HASHCODE REBOOT — Orientation Engine Types.
 *
 * Moteur d'orientation V1 : transforme le profil brut en scores,
 * confiance, recommandations et Next Best Action.
 *
 * Types purs, partagés client/serveur, indépendants de React et de Prisma.
 */

import type { Domain } from "@/lib/profiling/types";

/** Clés des quatre archétypes HashCode. */
export type ArchetypeKey = "builder" | "strategist" | "creator" | "catalyst";

/** Types d'activités HashCode vers lesquelles le moteur peut orienter. */
export type ActivityType =
  | "challenge"
  | "workshop"
  | "project"
  | "community"
  | "mentoring"
  | "learning_path"
  | "event"
  | "content";

/** Scores continus 0-1 par archétype (jamais un archétype unique). */
export interface Scores {
  builder: number;
  strategist: number;
  creator: number;
  catalyst: number;
}

/** Recommandation d'activité, explicable et pondérée. */
export interface ActivityRecommendation {
  type: ActivityType;
  id: string;
  /** Pertinence 0-1 pour ce profil. */
  score: number;
  /** Raisons lisibles (codes stables côté moteur). */
  reasons: string[];
}

/** Action unique et actionnable. `null` si le moteur manque de données. */
export interface NextBestAction {
  type: ActivityType;
  id: string;
  /** Explication en langage naturel. */
  reason: string;
}

/** Statut global du résultat d'orientation. */
export type OrientationStatus = "OK" | "INSUFFICIENT_DATA" | "NO_MATCH";

/** Résultat complet produit par `orientationEngine.evaluate()`. */
export interface OrientationResult {
  /** Version du moteur qui a produit ce résultat (traçabilité). */
  engineVersion: string;

  /** Statut : décision explicite, y compris l'absence de recommandation. */
  status: OrientationStatus;

  /** Codes d'entrée repris du profil (jamais de données sensibles ici). */
  domain?: Domain;
  secondaryDomains?: Domain[];
  level?: string;
  goal?: string;

  /** Scores d'archétype 0-1. */
  scores: Scores;

  /** Confiance du résultat 0-1 — mesure DISTINCTE des scores. */
  confidence: number;

  /** Domaines retenus pour l'orientation. */
  domains: Domain[];

  /** Recommandations triées par pertinence décroissante. */
  recommendations: ActivityRecommendation[];

  /** Action unique à proposer immédiatement. */
  nextBestAction: NextBestAction | null;

  /** Données manquantes, lorsque `status === "INSUFFICIENT_DATA"`. */
  missing?: string[];
}
