import { z } from "zod";
import type { Domain, ProfileAnswers } from "./types";

/**
 * Strict server-side validation. Never trust the browser.
 * Mirrors the conditional logic of the question engine.
 * 
 * Supports translation via createProfileSchema(t) where t is from next-intl/server.
 * The default export profileSchema uses French messages (backwards compatible).
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
const budgetRangeSchema = z.enum([
  "<2500",
  "2500-5000",
  "5000-10000",
  "10000-20000",
  "20000-30000",
  ">30000",
  "unknown",
  "not_now",
]);
const genderSchema = z
  .enum(["male", "female", "other", "prefer_not_say"])
  .optional();

/** Translation function type for validation messages (compatible with next-intl/server). */
export type ValidationTFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Default (French) validation messages — used when no t function provided. */
const defaultMessages = {
  firstNameRequired: "Prénom requis",
  lastNameMax: "Nom trop long (max 60 caractères)",
  emailInvalid: "Email invalide",
  phoneInvalid: "Numéro WhatsApp invalide (format international : +229 ...)",
  phoneMax: "Numéro trop long (max 40 caractères)",
  countryRequired: "Pays requis",
  countryMax: "Pays invalide (max 8 caractères)",
  cityMax: "Ville trop longue (max 80 caractères)",
  primaryDomainRequired: "Domaine principal requis",
  levelRequired: "Niveau requis",
  goalRequired: "Objectif requis",
  availabilityRequired: "Disponibilité requise",
  learningStyleRequired: "Style d'apprentissage requis",
  mentoringInterestRequired: "Intérêt mentorat requis",
  threeMonthGoalRequired: "Objectif à 3 mois requis",
  threeMonthGoalMin: "Objectif trop court (min 4 caractères)",
  threeMonthGoalMax: "Objectif trop long (max 280 caractères)",
  goalProjectStageMax: "Étape de projet trop longue (max 40 caractères)",
  goalSituationMax: "Situation trop longue (max 40 caractères)",
  availabilityTimesMax: "Créneaux trop longs (max 80 caractères)",
  mentoringMaybeReasonMax: "Raison trop longue (max 280 caractères)",
  mentoringFrequencyMax: "Fréquence trop longue (max 40 caractères)",
  mentoringDomainMax: "Domaine mentorat trop long (max 60 caractères)",
  budgetRangeInvalid: "Budget invalide",
  sourceMax: "Source trop longue (max 120 caractères)",
  budgetRangeWithoutMentoring: "Ne devrait pas être défini sans intérêt mentorat",
  secondaryDomainsMax: "Trop de domaines secondaires (max 3)",
  domainSpecialtyMax: "Trop de spécialités (max 6)",
  mentoringTypesMax: "Trop de types mentorat (max 6)",
};

/** Messages returned by t() function for each validation key. */
function getMessages(t: ValidationTFunction) {
  return {
    firstNameRequired: () => t("validation.firstNameRequired"),
    lastNameMax: () => t("validation.lastNameMax"),
    emailInvalid: () => t("validation.emailInvalid"),
    phoneInvalid: () => t("validation.phoneInvalid"),
    phoneMax: () => t("validation.phoneMax"),
    countryRequired: () => t("validation.countryRequired"),
    countryMax: () => t("validation.countryMax"),
    cityMax: () => t("validation.cityMax"),
    primaryDomainRequired: () => t("validation.primaryDomainRequired"),
    levelRequired: () => t("validation.levelRequired"),
    goalRequired: () => t("validation.goalRequired"),
    availabilityRequired: () => t("validation.availabilityRequired"),
    learningStyleRequired: () => t("validation.learningStyleRequired"),
    mentoringInterestRequired: () => t("validation.mentoringInterestRequired"),
    threeMonthGoalRequired: () => t("validation.threeMonthGoalRequired"),
    threeMonthGoalMin: () => t("validation.threeMonthGoalMin"),
    threeMonthGoalMax: () => t("validation.threeMonthGoalMax"),
    goalProjectStageMax: () => t("validation.goalProjectStageMax"),
    goalSituationMax: () => t("validation.goalSituationMax"),
    availabilityTimesMax: () => t("validation.availabilityTimesMax"),
    mentoringMaybeReasonMax: () => t("validation.mentoringMaybeReasonMax"),
    mentoringFrequencyMax: () => t("validation.mentoringFrequencyMax"),
    mentoringDomainMax: () => t("validation.mentoringDomainMax"),
    budgetRangeInvalid: () => t("validation.budgetRangeInvalid"),
    sourceMax: () => t("validation.sourceMax"),
    budgetRangeWithoutMentoring: () => t("validation.budgetRangeWithoutMentoring"),
    secondaryDomainsMax: () => t("validation.secondaryDomainsMax"),
    domainSpecialtyMax: () => t("validation.domainSpecialtyMax"),
    mentoringTypesMax: () => t("validation.mentoringTypesMax"),
  };
}

/**
 * Creates a profile schema with translated validation messages.
 * @param t - Translation function from next-intl/server (getTranslations)
 * @returns Zod schema with translated error messages
 */
export function createProfileSchema(t?: ValidationTFunction) {
  const msg = t
    ? getMessages(t)
    : {
        firstNameRequired: () => defaultMessages.firstNameRequired,
        lastNameMax: () => defaultMessages.lastNameMax,
        emailInvalid: () => defaultMessages.emailInvalid,
        phoneInvalid: () => defaultMessages.phoneInvalid,
        phoneMax: () => defaultMessages.phoneMax,
        countryRequired: () => defaultMessages.countryRequired,
        countryMax: () => defaultMessages.countryMax,
        cityMax: () => defaultMessages.cityMax,
        primaryDomainRequired: () => defaultMessages.primaryDomainRequired,
        levelRequired: () => defaultMessages.levelRequired,
        goalRequired: () => defaultMessages.goalRequired,
        availabilityRequired: () => defaultMessages.availabilityRequired,
        learningStyleRequired: () => defaultMessages.learningStyleRequired,
        mentoringInterestRequired: () => defaultMessages.mentoringInterestRequired,
        threeMonthGoalRequired: () => defaultMessages.threeMonthGoalRequired,
        threeMonthGoalMin: () => defaultMessages.threeMonthGoalMin,
        threeMonthGoalMax: () => defaultMessages.threeMonthGoalMax,
        goalProjectStageMax: () => defaultMessages.goalProjectStageMax,
        goalSituationMax: () => defaultMessages.goalSituationMax,
        availabilityTimesMax: () => defaultMessages.availabilityTimesMax,
        mentoringMaybeReasonMax: () => defaultMessages.mentoringMaybeReasonMax,
        mentoringFrequencyMax: () => defaultMessages.mentoringFrequencyMax,
        mentoringDomainMax: () => defaultMessages.mentoringDomainMax,
        budgetRangeInvalid: () => defaultMessages.budgetRangeInvalid,
        sourceMax: () => defaultMessages.sourceMax,
        budgetRangeWithoutMentoring: () => defaultMessages.budgetRangeWithoutMentoring,
        secondaryDomainsMax: () => defaultMessages.secondaryDomainsMax,
        domainSpecialtyMax: () => defaultMessages.domainSpecialtyMax,
        mentoringTypesMax: () => defaultMessages.mentoringTypesMax,
      };

  const schema = z
    .object({
      firstName: z.string().trim().min(1, msg.firstNameRequired()).max(40),
      lastName: z.string().trim().max(60, msg.lastNameMax()).optional().default(""),
      email: z.string().trim().toLowerCase().email(msg.emailInvalid()),
      phone: z
        .string()
        .trim()
        .max(40, msg.phoneMax())
        .regex(
          /^$|^\+?[0-9][0-9\s\-()]{6,30}$/,
          msg.phoneInvalid(),
        )
        .optional()
        .default(""),
      country: z.string().trim().min(1, msg.countryRequired()).max(8, msg.countryMax()),
      city: z.string().trim().max(80, msg.cityMax()).optional().default(""),
      gender: genderSchema,

      primaryDomain: domainSchema,
      secondaryDomains: z.array(domainSchema).max(3, msg.secondaryDomainsMax()).optional(),
      domainSpecialty: z.array(z.string().max(40)).max(6, msg.domainSpecialtyMax()).optional(),
      level: levelSchema,

      goal: goalSchema,
      goalProjectStage: z.string().trim().max(40, msg.goalProjectStageMax()).optional(),
      goalSituation: z.string().trim().max(40, msg.goalSituationMax()).optional(),

      availability: availabilitySchema,
      availabilityTimes: z.string().trim().max(80, msg.availabilityTimesMax()).optional(),

      learningStyle: learningSchema,

      mentoringInterest: mentoringSchema,
      mentoringMaybeReason: z.string().trim().max(280, msg.mentoringMaybeReasonMax()).optional(),
      mentoringTypes: z.array(z.string().max(40)).max(6, msg.mentoringTypesMax()).optional(),
      mentoringFrequency: z.string().trim().max(40, msg.mentoringFrequencyMax()).optional(),
      mentoringDomain: z.string().trim().max(60, msg.mentoringDomainMax()).optional(),

      budgetRange: budgetRangeSchema.optional(),

      threeMonthGoal: z
        .string()
        .trim()
        .min(4, msg.threeMonthGoalMin())
        .max(280, msg.threeMonthGoalMax()),

      source: z.string().trim().max(120, msg.sourceMax()).optional().default("direct"),
    })
    .superRefine((val, ctx) => {
      // Budget range only valid with mentoring interest.
      if (
        val.mentoringInterest !== "yes" &&
        val.mentoringInterest !== "maybe"
      ) {
        if (val.budgetRange && val.budgetRange !== "not_now" && val.budgetRange !== "unknown") {
          ctx.addIssue({
            path: ["budgetRange"],
            message: msg.budgetRangeWithoutMentoring(),
            code: "custom",
          });
        }
      }
    });

  return schema;
}

/** Default schema with French messages (backwards compatible). */
export const profileSchema = createProfileSchema(undefined);

export type ParsedProfile = z.infer<typeof profileSchema>;

/** Convert Prisma Member row → ProfileAnswers-shaped object (for resume / admin). */
export function memberToAnswers(_m: {
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string;
  city: string | null;
  gender: string | null;
  primaryDomain: string;
  secondaryDomains: string;
  domainSpecialty: string | null;
  level: string;
  goal: string;
  goalProjectStage: string | null;
  goalSituation: string | null;
  availability: string;
  availabilityTimes: string | null;
  learningStyle: string;
  mentoringInterest: string | null;
  mentoringMaybeReason: string | null;
  mentoringTypes: string;
  mentoringFrequency: string | null;
  mentoringDomain: string | null;
  budgetRange: string | null;
  threeMonthGoal: string | null;
}): ProfileAnswers {
  const parse = <T,>(s: string, fallback: T): T => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  };
  return {
    firstName: _m.firstName,
    lastName: _m.lastName ?? "",
    email: _m.email,
    phone: _m.phone ?? "",
    country: _m.country,
    city: _m.city ?? "",
    gender: (_m.gender as ProfileAnswers["gender"]) ?? undefined,
    primaryDomain: _m.primaryDomain as ProfileAnswers["primaryDomain"],
    secondaryDomains: parse<Domain[]>(_m.secondaryDomains, []),
    domainSpecialty: parse<string[]>(_m.domainSpecialty ?? "[]", []),
    level: _m.level as ProfileAnswers["level"],
    goal: _m.goal as ProfileAnswers["goal"],
    goalProjectStage: _m.goalProjectStage ?? undefined,
    goalSituation: _m.goalSituation ?? undefined,
    availability: _m.availability as ProfileAnswers["availability"],
    availabilityTimes: _m.availabilityTimes ?? undefined,
    learningStyle: _m.learningStyle as ProfileAnswers["learningStyle"],
    mentoringInterest: (_m.mentoringInterest as ProfileAnswers["mentoringInterest"]) ?? undefined,
    mentoringMaybeReason: _m.mentoringMaybeReason ?? undefined,
    mentoringTypes: parse<string[]>(_m.mentoringTypes, []),
    mentoringFrequency: _m.mentoringFrequency ?? undefined,
    mentoringDomain: _m.mentoringDomain ?? undefined,
    budgetRange: (_m.budgetRange as ProfileAnswers["budgetRange"]) ?? undefined,
    threeMonthGoal: _m.threeMonthGoal ?? undefined,
  };
}

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
    budgetRange: a.budgetRange ?? null,
    threeMonthGoal: a.threeMonthGoal?.trim() ?? null,
  };
}