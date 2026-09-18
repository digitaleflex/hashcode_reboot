/**
 * HASHCODE REBOOT — Matching mentorat (#61).
 *
 * Fonctions pures : un score 0-100 par paire (mentee, mentor), tri
 * décroissant, top 5. Testées dans tests/matching.test.cjs.
 *
 * Barème (spec #61) :
 * - +30 même primaryDomain
 * - +20 overlap de spécialités (domainSpecialty)
 * - +20 même mentoringFrequency
 * - +10 même country
 * - +20 budget « compatible » = le mentoré a un budget concret renseigné
 *   (ni unknown, ni not_now, ni null) — signe d'intention sérieuse.
 * Plafonné à 100. En cas d'égalité : mentor avec le moins de mentorés actifs
 * d'abord (équilibrage de charge), puis niveau avancé d'abord.
 */

export interface MenteeProfile {
  primaryDomain: string | null;
  domainSpecialty: string[] | string | null;
  mentoringFrequency: string | null;
  country: string | null;
  budgetRange: string | null;
}

export interface MentorProfile {
  id: string;
  primaryDomain: string | null;
  domainSpecialty: string[] | string | null;
  mentoringFrequency: string | null;
  country: string | null;
  level: string | null;
  activeMentees: number;
}

export interface MatchResult {
  mentorId: string;
  score: number;
  reasons: string[];
}

/** Parse tolerante : JSON string, tableau, null → string[]. */
export function parseSpecialties(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const CONCRETE_BUDGETS = new Set([
  "<2500",
  "2500-5000",
  "5000-10000",
  "10000-20000",
  "20000-30000",
  ">30000",
]);

export function scoreMatch(mentee: MenteeProfile, mentor: MentorProfile): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  if (mentee.primaryDomain && mentor.primaryDomain && mentee.primaryDomain === mentor.primaryDomain) {
    score += 30;
    reasons.push("same-domain");
  }

  const menteeSpecs = new Set(parseSpecialties(mentee.domainSpecialty));
  const overlap = parseSpecialties(mentor.domainSpecialty).filter((s) => menteeSpecs.has(s));
  if (overlap.length > 0) {
    score += 20;
    reasons.push("specialty-overlap");
  }

  if (
    mentee.mentoringFrequency &&
    mentor.mentoringFrequency &&
    mentee.mentoringFrequency === mentor.mentoringFrequency
  ) {
    score += 20;
    reasons.push("same-frequency");
  }

  if (mentee.country && mentor.country && mentee.country === mentor.country) {
    score += 10;
    reasons.push("same-country");
  }

  if (mentee.budgetRange && CONCRETE_BUDGETS.has(mentee.budgetRange)) {
    score += 20;
    reasons.push("concrete-budget");
  }

  return { mentorId: mentor.id, score: Math.min(100, score), reasons };
}

const LEVEL_RANK: Record<string, number> = {
  advanced: 0,
  autonomous: 1,
  practicing: 2,
  beginner: 3,
};

/** Top N mentors pour un mentoré (tri : score desc, charge asc, niveau desc). */
export function suggestMentors(
  mentee: MenteeProfile,
  mentors: MentorProfile[],
  limit = 5,
): MatchResult[] {
  return mentors
    .map((m) => ({ result: scoreMatch(mentee, m), mentor: m }))
    .sort((a, b) => {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score;
      if (a.mentor.activeMentees !== b.mentor.activeMentees) {
        return a.mentor.activeMentees - b.mentor.activeMentees;
      }
      const ra = LEVEL_RANK[a.mentor.level ?? ""] ?? 99;
      const rb = LEVEL_RANK[b.mentor.level ?? ""] ?? 99;
      return ra - rb;
    })
    .slice(0, Math.max(1, limit))
    .map((x) => x.result);
}
