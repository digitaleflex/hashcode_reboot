/**
 * HASHCODE REBOOT — moteur de progression ATELIERS (dérivé, ADR-001 D1).
 *
 * AUCUNE table de progression : l'état de chaque séance est CALCULÉ côté
 * serveur à partir des données brutes (soumissions, reviews, tentatives de
 * quiz). Le client ne peut ni fournir ni modifier un état — aucun endpoint
 * n'accepte de progression entrante.
 *
 * Règle de validation (protocole §18) : une séance est COMPLETED quand
 * TOUTES ses conditions effectives sont remplies —
 *   - livrable requis EFFECTIF = un livrable existe ET deliverableRequired
 *   - quiz requis effectif = un quiz existe ET quizRequired
 * Une condition sans ressource n'est JAMAIS fantôme : si une séance n'a
 * ni livrable ni quiz effectif, elle est COMPLETED dès son déblocage.
 *
 * La DERNIÈRE review de la DERNIÈRE soumission fait foi (protocole §15) ;
 * une resoumission repasse par PENDING (nouvelle ligne, attempt n+1).
 *
 * Déblocage séquentiel : la séance N est débloquée ssi N == 1 ou la
 * séance N-1 est COMPLETED (protocole §20).
 */

export const SESSION_STATES = [
  "LOCKED",
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "IN_REVIEW",
  "REVISION",
  "REJECTED",
  "COMPLETED",
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

/** État du quiz pour une séance, déjà dérivé des tentatives (serveur). */
export type QuizState = "NOT_STARTED" | "PASSED" | "FAILED";

export interface SessionProgressInput {
  hasDeliverable: boolean;
  deliverableRequired: boolean;
  hasQuiz: boolean;
  quizRequired: boolean;
  /** Statut de la DERNIÈRE soumission (attempt max) : null si aucune. */
  latestSubmissionStatus: string | null;
  /** Décision de la DERNIÈRE review de cette soumission : fait foi. */
  latestReviewDecision: string | null;
  quizState: QuizState;
}

/**
 * État pédagogique d'une séance — SANS le verrou (voir applyUnlockChain).
 * LOCKED n'est jamais retourné ici : c'est la chaîne de déblocage qui
 * l'impose, pour qu'une séance ne puisse pas se "verrouiller" elle-même
 * par accident.
 */
export function computeSessionState(input: SessionProgressInput): SessionState {
  const deliverableEffective = input.hasDeliverable && input.deliverableRequired;
  const quizEffective = input.hasQuiz && input.quizRequired;

  // Aucune condition effective → complétée dès le déblocage (jamais de
  // condition fantôme, protocole §18).
  if (!deliverableEffective && !quizEffective) return "COMPLETED";

  // La review rendue fait foi sur l'issue du livrable.
  const deliverableStatus: string | null =
    input.latestReviewDecision ?? input.latestSubmissionStatus ?? null;

  if (deliverableEffective) {
    switch (deliverableStatus) {
      case "APPROVED":
        // Livrable approuvé : reste le quiz effectif, s'il y en a un.
        return quizEffective && input.quizState !== "PASSED" ? "IN_PROGRESS" : "COMPLETED";
      case "IN_REVIEW":
        return "IN_REVIEW";
      case "REVISION":
        return "REVISION";
      case "REJECTED":
        return "REJECTED";
      case "PENDING":
        return "SUBMITTED";
      default:
        // Pas encore de soumission : le quiz peut être tenté (activité),
        // mais la séance n'est ni soumise ni validée.
        if (quizEffective && input.quizState === "PASSED") return "IN_PROGRESS";
        if (quizEffective && input.quizState === "FAILED") return "IN_PROGRESS";
        return "NOT_STARTED";
    }
  }

  // Quiz seulement (pas de livrable effectif).
  if (quizEffective) {
    if (input.quizState === "PASSED") return "COMPLETED";
    if (input.quizState === "FAILED") return "IN_PROGRESS";
    return "NOT_STARTED";
  }

  return "COMPLETED";
}

/**
 * Chaîne de déblocage séquentielle : la séance i (0-based) n'est accessible
 * que si i == 0 ou si la séance i-1 est COMPLETED. Tout état calculé d'une
 * séance non débloquée est ÉCRASÉ en LOCKED — même si des données
 * résiduelles existent (ex : soumission importée) : le verrou serveur
 * prime toujours.
 */
export function applyUnlockChain(states: SessionState[]): SessionState[] {
  const out: SessionState[] = [];
  for (let i = 0; i < states.length; i++) {
    const previousCompleted = i === 0 || out[i - 1] === "COMPLETED";
    out.push(previousCompleted ? states[i] : "LOCKED");
  }
  return out;
}

/**
 * Override administrateur : lève le verrou d'une séance ouverte manuellement
 * par l'admin (WorkshopSession.unlockOverride). L'override PRIME sur les
 * deux verrous (chaîne + date) mais ne transforme jamais LOCKED en état
 * pédagogique : une séance ouverte par l'admin sans données de progression
 * est NOT_STARTED, pas COMPLETED — le client membre applique donc
 * computeSessionState en repli.
 */
export function applyUnlockOverride(
  states: SessionState[],
  overrides: boolean[],
): SessionState[] {
  return states.map((state, i) =>
    overrides[i] && state === "LOCKED" ? "NOT_STARTED" : state,
  );
}

/**
 * Gate calendaire : une séance dont la date de disponibilité est FUTURE
 * reste LOCKED, même si la chaîne séquentielle l'aurait débloquée.
 * S'applique APRÈS applyUnlockChain — les deux verrous se cumulent :
 * une séance est accessible ssi (chaîne OK) ET (date atteinte ou absente).
 *
 * - availableAt[i] = date à partir de laquelle la séance i est accessible
 *   (scheduledAt, sinon startsAt de l'Event lié, sinon null = pas de gate).
 * - now injectable pour les tests (défaut : maintenant).
 * - Comparaison en millisecondes : une séance programmée aujourd'hui à
 *   20h00 reste verrouillée à 19h59.
 */
export function applyDateGate(
  states: SessionState[],
  availableAt: (Date | null)[],
  now: Date = new Date(),
): SessionState[] {
  const nowMs = now.getTime();
  return states.map((state, i) => {
    if (state === "LOCKED") return state;
    const at = availableAt[i] ?? null;
    if (at !== null && at.getTime() > nowMs) return "LOCKED";
    return state;
  });
}

export interface WorkshopSummary {
  total: number;
  completed: number;
  /** 0..100, arrondi à l'entier inférieur. */
  percent: number;
  /** Index (0-based) de la prochaine séance à travailler, ou null si fini. */
  nextSessionIndex: number | null;
  isComplete: boolean;
}

export function summarizeWorkshop(states: SessionState[]): WorkshopSummary {
  const total = states.length;
  const completed = states.filter((s) => s === "COMPLETED").length;
  const nextSessionIndex = states.findIndex((s) => s !== "COMPLETED" && s !== "LOCKED");
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.floor((completed / total) * 100),
    nextSessionIndex: nextSessionIndex === -1 ? null : nextSessionIndex,
    isComplete: total > 0 && completed === total,
  };
}

/**
 * Sélectionne la soumission la plus récente d'un livrable (attempt max).
 * Les soumissions sont append-only : c'est la dernière qui fait foi.
 */
export function pickLatestSubmission<T extends { attempt: number }>(
  submissions: T[],
): T | null {
  if (submissions.length === 0) return null;
  return submissions.reduce((a, b) => (b.attempt > a.attempt ? b : a));
}

/**
 * État de quiz dérivé des tentatives : PASSED dès qu'une tentative est
 * passée (les tentatives peuvent être répétées tant que maxAttempts ne
 * l'interdit pas — protocole §17).
 */
export function deriveQuizState(attempts: { passed: boolean }[]): QuizState {
  if (attempts.length === 0) return "NOT_STARTED";
  return attempts.some((a) => a.passed) ? "PASSED" : "FAILED";
}
