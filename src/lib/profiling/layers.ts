/**
 * HASHCODE REBOOT — Profiling layers (declared / inferred / observed).
 *
 * Types + version ONLY. No logic here — pure shape definitions.
 * Logic lives in `dynamicProfile.ts`.
 */

import type {
  ArchetypeKey,
  OrientationStatus,
  Scores,
} from "@/lib/orientation/types";
import type { Domain, Level, ProfileAnswers } from "./types";

/** Version of the dynamic-profile shape (bump on breaking shape change). */
export const DYNAMIC_PROFILE_VERSION = "1.0.0";

/** Behavioural signals observed on the platform (never self-declared). */
export interface ObservedSignals {
  workshopsStarted: number;
  workshopsCompleted: number;
  eventsJoined: number;
  mentoringRequested: boolean;
  recosAccepted: number;
  recosIgnored: number;
  lastActivityAt: string | null;
  observedDominantDomain?: string;
}

/** Confidence granted to the observed layer (discrete steps). */
export type ObservedConfidence = 0 | 0.5 | 1;

/** Declared profile re-scored through the orientation engine. */
export interface InferredLayer {
  scores: Scores;
  confidence: number;
  dominant: ArchetypeKey;
  /** Runner-up archetype, null when its score is below 0.15. */
  secondary: ArchetypeKey | null;
  engineVersion: string;
  status: OrientationStatus;
}

export type DynamicProfileStatus = "OK" | "INSUFFICIENT_DATA";

/** Layered profile: declared answers + engine inference + observed signals. */
export interface DynamicProfile {
  declared: ProfileAnswers;
  inferred: InferredLayer;
  observed: ObservedSignals;
  effectiveLevel: Level;
  levelUpgradeSuggested: boolean;
  domainAffinityShift: Domain | null;
  observedConfidence: ObservedConfidence;
  status: DynamicProfileStatus;
  explanations: string[];
  version: string;
}
