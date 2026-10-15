/**
 * Missions persistées — statuts (#232-b).
 *
 * Convention maison (cf. schéma Prisma) : statuts = String en base,
 * unions TS/Zod ici (JAMAIS d'enum Prisma). Aucun score psychométrique.
 */
import { z } from "zod";

/** Statut éditorial d'une mission (référentiel admin). */
export const MISSION_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];
export const missionStatusSchema = z.enum(MISSION_STATUSES);

/** Domaines (miroir Member.primaryDomain). */
export const MISSION_DOMAINS = ["web", "cybersecurity", "ai"] as const;
export type MissionDomain = (typeof MISSION_DOMAINS)[number];
export const missionDomainSchema = z.enum(MISSION_DOMAINS);

/** Niveaux (miroir Member.level). */
export const MISSION_LEVELS = [
  "beginner",
  "practicing",
  "autonomous",
  "advanced",
] as const;
export type MissionLevel = (typeof MISSION_LEVELS)[number];
export const missionLevelSchema = z.enum(MISSION_LEVELS);

/** États d'une assignation (progression membre). */
export const ASSIGNMENT_STATUSES = [
  "UPCOMING",
  "ACTIVE",
  "SUBMITTED",
  "VALIDATED",
  "REJECTED",
  "ABANDONED",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export const assignmentStatusSchema = z.enum(ASSIGNMENT_STATUSES);

/** États d'une soumission (miroir WorkshopSubmission). */
export const SUBMISSION_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REVISION",
  "REJECTED",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);

/** Décisions de revue (miroir WorkshopReview). */
export const REVIEW_DECISIONS = ["APPROVED", "REVISION", "REJECTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export const reviewDecisionSchema = z.enum(REVIEW_DECISIONS);
