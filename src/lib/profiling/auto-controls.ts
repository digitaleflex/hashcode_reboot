import type {
  ProfileAnswers,
  AutoControlsResult,
  ProfileStatus,
  CommunityStatus,
  AccessLane,
} from "./types";
import { EMAIL_RE, DISPOSABLE_DOMAINS } from "./engine";

/**
 * HASHCODE REBOOT — Contrôles automatiques (the strategic branching).
 *
 * Principle (user instruction): do NOT create artificial friction. If someone
 * just spent 2 minutes completing their profile and is perfectly compatible
 * with HASHCODE, and nothing requires manual validation → give them immediate
 * access. WhatsApp is NOT the reward for the form; the reward is "HASHCODE
 * understood me." WhatsApp is just the next logical step.
 *
 * Branch A — IMMEDIATE ACCESS (profileStatus=APPROVED, communityStatus=INVITED,
 *   accessLane=immediate): the user gets the WhatsApp + community CTA right away.
 *
 * Branch B — PENDING (profileStatus=PENDING, communityStatus=NOT_INVITED,
 *   accessLane=pending): routed to human review for a personal invitation.
 *
 * The default is immediate access. PENDING is reserved for signals that
 * genuinely benefit from a human touch:
 *   1. Disposable / temp email → can't trust the contact channel.
 *   2. Empty or near-empty 3-month goal → low signal, human can re-engage.
 *   3. High-value mentoring lead (mentoring=yes AND budget >= 20 000 FCFA)
 *      → a human invitation converts far better than an automated one.
 */

const HIGH_BUDGET_TIERS = new Set(["20000-30000", ">30000"]);

export function runAutoControls(a: ProfileAnswers): AutoControlsResult {
  const reasons: string[] = [];

  const email = (a.email ?? "").trim().toLowerCase();
  const emailValid = EMAIL_RE.test(email);
  const domain = email.split("@")[1] ?? "";
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);

  const hasName = (a.firstName ?? "").trim().length >= 1;
  const hasDomain = !!a.primaryDomain;
  const hasGoal = !!a.goal;
  const hasLevel = !!a.level;
  const hasAvailability = !!a.availability;
  const goalLen = (a.threeMonthGoal ?? "").trim().length;
  const goalMeaningful = goalLen >= 8;

  const highValueLead =
    a.mentoringInterest === "yes" &&
    a.budgetRange !== undefined &&
    HIGH_BUDGET_TIERS.has(a.budgetRange);

  // Core completeness gate (should be enforced upstream but double-check).
  const coreComplete =
    emailValid && hasName && hasDomain && hasGoal && hasLevel && hasAvailability;

  if (!coreComplete) {
    reasons.push("missing-core");
  }
  if (isDisposable) {
    reasons.push("disposable-email");
  }
  if (!goalMeaningful) {
    reasons.push("low-signal-goal");
  }
  if (highValueLead) {
    reasons.push("high-value-mentoring-lead");
  }

  const pending = reasons.length > 0;

  const accessLane: AccessLane = pending ? "pending" : "immediate";
  const profileStatus: ProfileStatus = pending ? "PENDING" : "APPROVED";
  const communityStatus: CommunityStatus = pending ? "NOT_INVITED" : "INVITED";

  return {
    accessLane,
    profileStatus,
    communityStatus,
    reasons,
  };
}

/** Human-readable reason labels (used by the pending screen). */
export const REASON_LABELS: Record<string, string> = {
  "missing-core": "Informations essentielles à confirmer",
  "disposable-email": "Adresse email à vérifier",
  "low-signal-goal": "Objectif à préciser ensemble",
  "high-value-mentoring-lead": "Demande d'accompagnement prioritaire",
};

export const WHATSAPP_URL = "https://chat.whatsapp.com/JwJGgoQpS46I9r81QPrCs4";
