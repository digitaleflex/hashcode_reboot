/**
 * HASHCODE REBOOT — Dynamic profile builder (Profiling Engine V1).
 *
 * Pure, deterministic functions (no Date.now, no I/O). Combines:
 *  - declared answers (ProfileAnswers),
 *  - engine inference (orientationEngine.evaluate),
 *  - observed behavioural signals (ObservedSignals).
 */

import { orientationEngine } from "@/lib/orientation/engine";
import type { ArchetypeKey, Scores } from "@/lib/orientation/types";
import type { Domain, Level, ProfileAnswers } from "@/lib/profiling/types";
import {
  DYNAMIC_PROFILE_VERSION,
  type DynamicProfile,
  type DynamicProfileStatus,
  type InferredLayer,
  type ObservedConfidence,
  type ObservedSignals,
} from "./layers";

export type {
  Domain,
  DynamicProfile,
  DynamicProfileStatus,
  InferredLayer,
  Level,
  ObservedConfidence,
  ObservedSignals,
  ProfileAnswers,
};
export { DYNAMIC_PROFILE_VERSION };

const LEVELS: Level[] = ["beginner", "practicing", "autonomous", "advanced"];

const ARCHETYPE_ORDER: ArchetypeKey[] = [
  "builder",
  "strategist",
  "creator",
  "catalyst",
];

const VALID_DOMAINS: Domain[] = ["web", "cybersecurity", "ai"];

/** Score below which the runner-up archetype is discarded. */
const SECONDARY_SCORE_FLOOR = 0.15;

/** Completions required to suggest a single-step level upgrade. */
const COMPLETIONS_FOR_UPGRADE = 2;

/** Activity volume required before a domain affinity shift is considered. */
const ACTIVITY_FOR_DOMAIN_SHIFT = 3;

/** True when no behavioural signal has been observed yet. */
export function isObservedEmpty(o: ObservedSignals): boolean {
  return (
    o.workshopsStarted === 0 &&
    o.workshopsCompleted === 0 &&
    o.eventsJoined === 0 &&
    o.mentoringRequested === false &&
    o.recosAccepted === 0 &&
    o.recosIgnored === 0 &&
    o.lastActivityAt === null
  );
}

/**
 * Count non-null signals: each counter > 0, mentoringRequested === true and
 * lastActivityAt !== null each count as exactly one signal.
 */
function countSignals(o: ObservedSignals): number {
  let n = 0;
  if (o.workshopsStarted > 0) n += 1;
  if (o.workshopsCompleted > 0) n += 1;
  if (o.eventsJoined > 0) n += 1;
  if (o.recosAccepted > 0) n += 1;
  if (o.recosIgnored > 0) n += 1;
  if (o.mentoringRequested) n += 1;
  if (o.lastActivityAt !== null) n += 1;
  return n;
}

/** Archetypes ranked by score, descending (canonical order breaks ties). */
function rankArchetypes(scores: Scores): ArchetypeKey[] {
  return [...ARCHETYPE_ORDER].sort(
    (a, b) =>
      scores[b] - scores[a] ||
      ARCHETYPE_ORDER.indexOf(a) - ARCHETYPE_ORDER.indexOf(b),
  );
}

/**
 * Build the layered dynamic profile from declared answers + observed signals.
 * Never downgrades the level; upgrades at most one step.
 */
export function buildLayeredProfile(
  declared: ProfileAnswers,
  observed: ObservedSignals,
): DynamicProfile {
  const result = orientationEngine.evaluate(declared);

  const ranked = rankArchetypes(result.scores);
  const dominant = ranked[0];
  const runnerUp = ranked[1];
  const secondary: ArchetypeKey | null =
    result.scores[runnerUp] < SECONDARY_SCORE_FLOOR ? null : runnerUp;

  const empty = isObservedEmpty(observed);

  const signalCount = empty ? 0 : countSignals(observed);
  const observedConfidence: ObservedConfidence =
    signalCount === 0 ? 0 : signalCount >= 3 ? 1 : 0.5;

  const baseLevel: Level = declared.level ?? "beginner";
  let effectiveLevel: Level = baseLevel;
  let levelUpgradeSuggested = false;
  if (
    observed.workshopsCompleted >= COMPLETIONS_FOR_UPGRADE &&
    baseLevel !== "advanced"
  ) {
    effectiveLevel = LEVELS[LEVELS.indexOf(baseLevel) + 1];
    levelUpgradeSuggested = true;
  }

  let domainAffinityShift: Domain | null = null;
  const candidate = observed.observedDominantDomain;
  if (
    observed.eventsJoined + observed.workshopsStarted >=
      ACTIVITY_FOR_DOMAIN_SHIFT &&
    candidate !== undefined &&
    (VALID_DOMAINS as string[]).includes(candidate) &&
    candidate !== declared.primaryDomain
  ) {
    domainAffinityShift = candidate as Domain;
  }

  const explanations: string[] = [empty ? "observed:empty" : "observed:present"];
  if (levelUpgradeSuggested) explanations.push("level:upgrade-suggested");
  if (domainAffinityShift !== null) explanations.push("domain:affinity-shift");
  if (declared.mentoringInterest === "no" && observed.mentoringRequested) {
    explanations.push("mentoring:observed-overrides-declared");
  }

  const status: DynamicProfileStatus = empty ? "INSUFFICIENT_DATA" : "OK";

  return {
    declared,
    inferred: {
      scores: result.scores,
      confidence: result.confidence,
      dominant,
      secondary,
      engineVersion: result.engineVersion,
      status: result.status,
    },
    observed,
    effectiveLevel,
    levelUpgradeSuggested,
    domainAffinityShift,
    observedConfidence,
    status,
    explanations,
    version: DYNAMIC_PROFILE_VERSION,
  };
}
