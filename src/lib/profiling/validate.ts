import { z } from "zod";
import type { ProfileAnswers } from "./types";

/**
 * Strict server-side validation. Never trust the browser.
 * Mirrors the conditional logic of the question engine.
 */

const domainSchema = z.enum(["web", "cybersecurity", "ai"]);
const levelSchema = z.enum(["beginner", "practicing", "autonomous", "advanced"]);
const goalSchema = z.enum([
  "project",
  "employment",
  "freelance",
  "upskill",
  "business",
  "career",
  "other",
]);
const availabilitySchema = z.enum(["<2h", "2-5h", "5-10h", "10-15h", "15h+"]);
const learningSchema = z.enum(["practice", "path", "group", "mentor", "project"]);
const mentoringSchema = z.enum(["no", "maybe", "yes"]);
const budgetWillingnessSchema = z.enum(["yes", "maybe", "not_now"]);
const budgetRangeSchema = z.enum([
  "<2500",
  "2500-5000",
  "5000-10000",
  "10000-20000",
  "20000-30000",
  ">30000",
  "unknown",
]);
const genderSchema = z
  .enum(["male", "female", "other", "prefer_not_say"])
  .optional();

export const profileSchema = z
  .object({
    firstName: z.string().trim().min(1, "Prénom requis").max(40),
    lastName: z.string().trim().min(1, "Nom requis").max(60),
    email: z.string().trim().toLowerCase().email("Email invalide"),
    phone: z.string().trim().min(1, "WhatsApp requis").max(40),
    country: z.string().trim().min(1, "Pays requis").max(8),
    city: z.string().trim().min(1, "Ville requise").max(80),
    gender: genderSchema,

    primaryDomain: domainSchema,
    secondaryDomains: z.array(domainSchema).max(3).optional(),
    domainSpecialty: z.array(z.string().max(40)).max(6).optional(),
    level: levelSchema,

    goal: goalSchema,
    goalProjectStage: z.string().trim().max(40).optional(),
    goalSituation: z.string().trim().max(40).optional(),

    availability: availabilitySchema,
    availabilityTimes: z.string().trim().max(80).optional(),

    learningStyle: learningSchema,

    mentoringInterest: mentoringSchema,
    mentoringMaybeReason: z.string().trim().max(280).optional(),
    mentoringTypes: z.array(z.string().max(40)).max(6).optional(),
    mentoringFrequency: z.string().trim().max(40).optional(),
    mentoringDomain: z.string().trim().max(60).optional(),

    budgetWillingness: budgetWillingnessSchema.optional(),
    budgetRange: budgetRangeSchema.optional(),

    threeMonthGoal: z.string().trim().min(8, "Objectif trop court").max(280),
  })
  .superRefine((val, ctx) => {
    // Conditional sanity: budget fields only if mentoring interest + willingness.
    if (
      val.mentoringInterest !== "yes" &&
      val.mentoringInterest !== "maybe"
    ) {
      if (val.budgetWillingness)
        ctx.addIssue({
          path: ["budgetWillingness"],
          message: "Ne devrait pas être défini sans intérêt mentorat",
          code: "custom",
        });
    }
    if (
      val.budgetWillingness !== "yes" &&
      val.budgetWillingness !== "maybe"
    ) {
      if (val.budgetRange)
        ctx.addIssue({
          path: ["budgetRange"],
          message: "Ne devrait pas être défini sans volonté d'investir",
          code: "custom",
        });
    }
  });





/** Map ProfileAnswers → Prisma create payload (handles JSON encoding). */
export function answersToCreatePayload(a: ProfileAnswers) {
  return {
    firstName: a.firstName.trim(),
    lastName: a.lastName?.trim() || "",
    email: a.email.trim().toLowerCase(),
    phone: a.phone?.trim() || "",
    country: a.country.trim(),
    city: a.city?.trim() || "",
    gender: a.gender ?? null,
    primaryDomain: a.primaryDomain!,
    secondaryDomains: JSON.stringify(a.secondaryDomains ?? []),
    domainSpecialty: JSON.stringify(a.domainSpecialty ?? []),
    level: a.level!,
    goal: a.goal!,
    goalProjectStage: a.goalProjectStage ?? null,
    goalSituation: a.goalSituation ?? null,
    availability: a.availability!,
    availabilityTimes: a.availabilityTimes ?? null,
    learningStyle: a.learningStyle!,
    mentoringInterest: a.mentoringInterest ?? null,
    mentoringMaybeReason: a.mentoringMaybeReason ?? null,
    mentoringTypes: JSON.stringify(a.mentoringTypes ?? []),
    mentoringFrequency: a.mentoringFrequency ?? null,
    mentoringDomain: a.mentoringDomain ?? null,
    budgetWillingness: a.budgetWillingness ?? null,
    budgetRange: a.budgetRange ?? null,
    threeMonthGoal: a.threeMonthGoal?.trim() ?? null,
  };
}
