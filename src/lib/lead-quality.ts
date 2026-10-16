/**
 * Qualité des leads (#105) — fonctions pures (testées sans DB).
 *
 * PAS de psychométrie : uniquement complétude des données, consentement,
 * cohérence déclarative et statuts. Les agrégats vivent dans la route
 * (SQL) ; ici : score unitaire + règles de cohérence + champs scrutés.
 */

export interface LeadRow {
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  secondaryDomains?: string | null;
  goal?: string | null;
  goalProjectStage?: string | null;
  goalSituation?: string | null;
  availabilityTimes?: string | null;
  mentoringInterest?: string | null;
  mentoringMaybeReason?: string | null;
  mentoringTypes?: string | null;
  mentoringFrequency?: string | null;
  mentoringDomain?: string | null;
  budgetWillingness?: string | null;
  budgetRange?: string | null;
  threeMonthGoal?: string | null;
}

interface OptionalField {
  key: keyof LeadRow;
  /** Champ pertinent pour cette ligne ? (conditionnels) */
  applies: (row: LeadRow) => boolean;
  /** Rempli ? */
  filled: (row: LeadRow) => boolean;
}

const nonEmpty = (v: unknown): boolean =>
  typeof v === "string" && v.trim().length > 0;
const nonEmptyJsonArray = (v: unknown): boolean => {
  if (!nonEmpty(v)) return false;
  try {
    const arr = JSON.parse(v as string);
    return Array.isArray(arr) && arr.length > 0;
  } catch {
    return v !== "[]";
  }
};

const OPTIONAL_FIELDS: OptionalField[] = [
  { key: "lastName", applies: () => true, filled: (r) => nonEmpty(r.lastName) },
  { key: "phone", applies: () => true, filled: (r) => nonEmpty(r.phone) },
  { key: "city", applies: () => true, filled: (r) => nonEmpty(r.city) },
  {
    key: "secondaryDomains",
    applies: () => true,
    filled: (r) => nonEmptyJsonArray(r.secondaryDomains),
  },
  {
    key: "goalProjectStage",
    applies: (r) => r.goal === "project" || r.goal === "business",
    filled: (r) => nonEmpty(r.goalProjectStage),
  },
  {
    key: "goalSituation",
    applies: (r) => r.goal === "employment",
    filled: (r) => nonEmpty(r.goalSituation),
  },
  {
    key: "availabilityTimes",
    applies: () => true,
    filled: (r) => nonEmpty(r.availabilityTimes),
  },
  {
    key: "mentoringMaybeReason",
    applies: (r) => r.mentoringInterest === "maybe",
    filled: (r) => nonEmpty(r.mentoringMaybeReason),
  },
  {
    key: "mentoringTypes",
    applies: (r) => r.mentoringInterest === "yes",
    filled: (r) => nonEmptyJsonArray(r.mentoringTypes),
  },
  {
    key: "mentoringFrequency",
    applies: (r) => r.mentoringInterest === "yes",
    filled: (r) => nonEmpty(r.mentoringFrequency),
  },
  {
    key: "mentoringDomain",
    applies: (r) => r.mentoringInterest === "yes",
    filled: (r) => nonEmpty(r.mentoringDomain),
  },
  {
    key: "budgetWillingness",
    applies: (r) => r.mentoringInterest === "yes" || r.mentoringInterest === "maybe",
    filled: (r) => nonEmpty(r.budgetWillingness),
  },
  {
    key: "budgetRange",
    applies: (r) => r.mentoringInterest === "yes" || r.mentoringInterest === "maybe",
    filled: (r) => nonEmpty(r.budgetRange),
  },
  {
    key: "threeMonthGoal",
    applies: () => true,
    filled: (r) => nonEmpty(r.threeMonthGoal),
  },
];

/** Score 0–100 = champs optionnels pertinents remplis. */
export function scoreCompleteness(row: LeadRow): number {
  const applicable = OPTIONAL_FIELDS.filter((f) => f.applies(row));
  if (applicable.length === 0) return 100;
  const filled = applicable.filter((f) => f.filled(row)).length;
  return Math.round((filled / applicable.length) * 100);
}

/** Règles de cohérence déclarative (codes stables pour l'UI). */
export function coherenceFlags(row: LeadRow): string[] {
  const flags: string[] = [];
  if (row.goal === "employment" && !nonEmpty(row.goalSituation)) {
    flags.push("EMPLOYMENT_WITHOUT_SITUATION");
  }
  if (row.mentoringInterest === "yes" && !nonEmptyJsonArray(row.mentoringTypes)) {
    flags.push("MENTORING_WITHOUT_TYPES");
  }
  if (
    (row.goal === "project" || row.goal === "business") &&
    !nonEmpty(row.goalProjectStage)
  ) {
    flags.push("PROJECT_WITHOUT_STAGE");
  }
  return flags;
}
