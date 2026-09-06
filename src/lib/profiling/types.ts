/**
 * HASHCODE REBOOT — Profiling domain types.
 * Shared between client (UI state) and server (API validation).
 */

export type Domain = "web" | "cybersecurity" | "ai";
export type Level = "beginner" | "practicing" | "autonomous" | "advanced";
export type Goal =
  | "project"
  | "employment"
  | "freelance"
  | "upskill"
  | "business"
  | "career"
  | "other";
export type Availability = "<2h" | "2-5h" | "5-10h" | "10-15h" | "15h+";
export type LearningStyle = "practice" | "path" | "group" | "mentor" | "project";
export type MentoringInterest = "no" | "maybe" | "yes";
export type BudgetWillingness = "yes" | "maybe" | "not_now";
export type BudgetRange =
  | "<2500"
  | "2500-5000"
  | "5000-10000"
  | "10000-20000"
  | "20000-30000"
  | ">30000"
  | "unknown";
export type Gender = "male" | "female" | "other" | "prefer_not_say";

export type ProfileStatus = "PENDING" | "APPROVED" | "REJECTED" | "WAITLIST";
export type CommunityStatus = "NOT_INVITED" | "INVITED" | "JOINED";
export type AccessLane = "immediate" | "pending";

/** All profiling answers collected through the flow. */
export interface ProfileAnswers {
  // Identité (all required now — no optional contact fields)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  gender?: Gender;

  // Profil
  primaryDomain?: Domain;
  secondaryDomains?: Domain[];
  domainSpecialty?: string[];
  level?: Level;

  // Objectifs
  goal?: Goal;
  goalProjectStage?: string;
  goalSituation?: string;

  // Disponibilité
  availability?: Availability;
  availabilityTimes?: string;

  // Apprentissage
  learningStyle?: LearningStyle;

  // Mentorat
  mentoringInterest?: MentoringInterest;
  mentoringMaybeReason?: string;
  mentoringTypes?: string[];
  mentoringFrequency?: string;
  mentoringDomain?: string;

  // Budget
  budgetWillingness?: BudgetWillingness;
  budgetRange?: BudgetRange;

  // Open
  threeMonthGoal?: string;
}

export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "text"
  | "email"
  | "longtext"
  | "country";

export interface QuestionOption {
  value: string;
  label: string;
  emoji?: string;
  description?: string;
  hint?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  helper?: string;
  placeholder?: string;
  options?: QuestionOption[];
  required: boolean;
  mapsTo: keyof ProfileAnswers;
  /** When defined, the question only shows if this returns true. */
  condition?: (a: ProfileAnswers) => boolean;
  allowMultiple?: boolean;
  minChars?: number;
  maxChars?: number;
  /** Optional microcopy shown when this question becomes active. */
  microcopy?: string;
  /** Group label for the step indicator. */
  group: "profil" | "objectifs" | "rythme" | "mentorat" | "contact" | "vision";
}

/** Result of the automatic controls (the strategic branching). */
export interface AutoControlsResult {
  accessLane: AccessLane;
  profileStatus: ProfileStatus;
  communityStatus: CommunityStatus;
  reasons: string[];
}

/** Generated profile summary for the profile card. */
export interface GeneratedProfile {
  archetype: string;
  archetypeEmoji: string;
  domainLabel: string;
  levelLabel: string;
  goalLabel: string;
  availabilityLabel: string;
  styleLabel: string;
  mentoringLabel: string;
  tags: string[];
  genderLabel?: string;
}
