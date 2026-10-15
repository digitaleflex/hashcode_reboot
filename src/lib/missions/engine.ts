/**
 * Missions persistées — moteur de progression (#232-b).
 *
 * Pur (aucune DB, aucun réseau) : calcule les transitions et la progression
 * dérivée. Les écritures vivent dans les routes (c). Idempotent par
 * construction : ré-appliquer la même décision produit le même état.
 *
 * Graphe des assignations :
 *   UPCOMING → ACTIVE | ABANDONED
 *   ACTIVE → SUBMITTED | ABANDONED
 *   SUBMITTED → VALIDATED | REJECTED | ACTIVE (retour au travail)
 *   REJECTED → SUBMITTED (nouvelle tentative) | ABANDONED
 *   VALIDATED, ABANDONED : terminaux (repartir = NOUVELLE assignation).
 *
 * Graphe des soumissions :
 *   PENDING → IN_REVIEW | APPROVED | REVISION | REJECTED
 *   IN_REVIEW → APPROVED | REVISION | REJECTED
 *   APPROVED, REVISION, REJECTED : terminaux (resoumettre = nouvel attempt).
 */
import type {
  AssignmentStatus,
  ReviewDecision,
  SubmissionStatus,
} from "./types";

const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  UPCOMING: ["ACTIVE", "ABANDONED"],
  ACTIVE: ["SUBMITTED", "ABANDONED"],
  SUBMITTED: ["VALIDATED", "REJECTED", "ACTIVE"],
  REJECTED: ["SUBMITTED", "ABANDONED"],
  VALIDATED: [],
  ABANDONED: [],
};

const SUBMISSION_TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  PENDING: ["IN_REVIEW", "APPROVED", "REVISION", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REVISION", "REJECTED"],
  APPROVED: [],
  REVISION: [],
  REJECTED: [],
};

/** Décision de revue → statut de soumission résultant. */
const DECISION_TO_SUBMISSION: Record<ReviewDecision, SubmissionStatus> = {
  APPROVED: "APPROVED",
  REVISION: "REVISION",
  REJECTED: "REJECTED",
};

/** Décision de revue → statut d'assignation résultant. */
const DECISION_TO_ASSIGNMENT: Record<ReviewDecision, AssignmentStatus> = {
  APPROVED: "VALIDATED",
  REVISION: "ACTIVE",
  REJECTED: "REJECTED",
};

export function canTransitionAssignment(
  from: AssignmentStatus,
  to: AssignmentStatus,
): boolean {
  return ASSIGNMENT_TRANSITIONS[from].includes(to);
}

export function canTransitionSubmission(
  from: SubmissionStatus,
  to: SubmissionStatus,
): boolean {
  return SUBMISSION_TRANSITIONS[from].includes(to);
}

/** Statuts terminaux (aucune sortie : repartir = nouvelle ligne). */
export function isTerminalAssignmentStatus(status: AssignmentStatus): boolean {
  return ASSIGNMENT_TRANSITIONS[status].length === 0;
}

export function isTerminalSubmissionStatus(status: SubmissionStatus): boolean {
  return SUBMISSION_TRANSITIONS[status].length === 0;
}

/** Prochain numéro d'attempt (idempotent : max existant + 1, 1 si vide). */
export function nextAttempt(existingAttempts: number[]): number {
  if (existingAttempts.length === 0) return 1;
  return Math.max(...existingAttempts) + 1;
}

export interface ReviewOutcome {
  submissionStatus: SubmissionStatus;
  assignmentStatus: AssignmentStatus;
  /** Horodatage à poser sur validatedAt (APPROVED) / abandonedAt (jamais ici). */
  validated: boolean;
}

/**
 * Applique une décision de revue. Pur et idempotent : rejouer la même
 * décision sur le même état rend le même résultat, sans effet de bord
 * (les écritures + horodatages vivent dans la route (c)).
 */
export function applyReview(
  _currentSubmission: SubmissionStatus,
  decision: ReviewDecision,
): ReviewOutcome {
  return {
    submissionStatus: DECISION_TO_SUBMISSION[decision],
    assignmentStatus: DECISION_TO_ASSIGNMENT[decision],
    validated: decision === "APPROVED",
  };
}

export interface ProgressInput {
  missionId: string;
  status: AssignmentStatus;
}

export interface MemberProgress {
  /** Assignations démarrées (hors UPCOMING). */
  started: number;
  active: number;
  submitted: number;
  validated: number;
  rejected: number;
  abandoned: number;
  upcoming: number;
  /** Slugs/ids validés (uniques). */
  validatedMissionIds: string[];
  /** Taux = validées / démarrées (0 si rien démarré). */
  completionRate: number;
}

/** Progression dérivée et requêtable (critère #232). */
export function deriveProgress(assignments: ProgressInput[]): MemberProgress {
  const byStatus: Record<AssignmentStatus, number> = {
    UPCOMING: 0,
    ACTIVE: 0,
    SUBMITTED: 0,
    VALIDATED: 0,
    REJECTED: 0,
    ABANDONED: 0,
  };
  const validatedSet = new Set<string>();
  for (const a of assignments) {
    byStatus[a.status] += 1;
    if (a.status === "VALIDATED") validatedSet.add(a.missionId);
  }
  const started =
    byStatus.ACTIVE +
    byStatus.SUBMITTED +
    byStatus.VALIDATED +
    byStatus.REJECTED +
    byStatus.ABANDONED;
  return {
    started,
    active: byStatus.ACTIVE,
    submitted: byStatus.SUBMITTED,
    validated: byStatus.VALIDATED,
    rejected: byStatus.REJECTED,
    abandoned: byStatus.ABANDONED,
    upcoming: byStatus.UPCOMING,
    validatedMissionIds: [...validatedSet].sort(),
    completionRate: started === 0 ? 0 : byStatus.VALIDATED / started,
  };
}
