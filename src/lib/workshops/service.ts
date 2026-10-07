/**
 * HASHCODE REBOOT — domaine ATELIERS : logique métier serveur (service).
 *
 * Consolidation (Struct-4) de :
 * - workshop-progression.ts : moteur de progression dérivée (pur),
 * - workshop-quiz.ts        : scoring des quiz 100 % serveur (pur),
 * - workshop-server.ts      : assemblage DB → fonctions pures (loadWorkshopForMember,
 *                             getSessionAccess).
 *
 * Les fonctions pures ne touchent jamais la DB ; seul l'assemblage final
 * (section 3) importe `db`. La validation est dans ./validation.ts, les
 * emails transactionnels dans ./emails.ts.
 */

// ── Section 1 : progression (ex-workshop-progression.ts, pur) ────────────────

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

// ── Section 2 : scoring quiz (ex-workshop-quiz.ts, pur) ──────────────────────

/**
 * HASHCODE REBOOT — scoring des quiz ATELIERS (100 % serveur).
 *
 * GARDE-FOU FONDAMENTAL : les réponses correctes (correctJson) ne quittent
 * JAMAIS le serveur. La seule projection client est publicQuestions(), qui
 * ne retourne que l'énoncé, les options et les points — jamais l'indice
 * correct. Le scoring s'exécute exclusivement côté serveur (protocole §17) :
 * le client envoie ses réponses, le serveur calcule le score et `passed`.
 *
 * Types supportés en v1 : single, multiple, true_false. Le type short_answer
 * est reporté (scoring exact-match non fiable — cf. audit §21, protocole §17
 * « réponse courte si techniquement supportable »).
 *
 * Forme des réponses (cf. ./validation.ts parseAnswers) :
 *   - single / true_false : indice unique (number)
 *   - multiple : tableau d'indices (number[]) — match exact de l'ensemble
 *
 * Seuil : passThreshold en pourcentage (0-100), configurable par quiz.
 * Tentatives : répétées tant que maxAttempts ne l'interdit pas (§17) —
 * voir canAttempt().
 */

import type { QuestionType } from "./validation";

export interface PublicQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  /** Options dé-JSON-ifiées — SANS aucune indication de la réponse. */
  options: string[];
  points: number;
}

export interface ScoredQuestion {
  questionId: string;
  type: QuestionType;
  correct: boolean;
  pointsEarned: number;
}

export interface QuizScore {
  /** Points gagnés. */
  score: number;
  /** Points possibles (somme des points des questions). */
  total: number;
  /** 0..100, arrondi à l'entier inférieur. */
  percent: number;
  /** percent >= passThreshold. */
  passed: boolean;
  perQuestion: ScoredQuestion[];
}

interface QuestionForScoring {
  id: string;
  order: number;
  type: string;
  prompt: string;
  optionsJson: string;
  correctJson: string;
  points: number;
}

/**
 * Projection client d'une question : correctJson est ABSENT de la sortie
 * (testé par des tests de non-fuite). Toute sérialisation d'une question
 * de quiz vers le client doit passer par ici.
 */
export function publicQuestions(
  questions: {
    id: string;
    order: number;
    type: string;
    prompt: string;
    optionsJson: string;
    points: number;
  }[],
): PublicQuestion[] {
  return questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      let options: string[] = [];
      try {
        const parsed = JSON.parse(q.optionsJson);
        if (Array.isArray(parsed)) options = parsed.map((o) => String(o));
      } catch {
        options = [];
      }
      return {
        id: q.id,
        order: q.order,
        type: q.type as QuestionType,
        prompt: q.prompt,
        options,
        points: q.points,
      };
    });
}

/** Parse correctJson en indices 0-based (number | number[]), null si corrompu. */
function parseCorrect(type: string, correctJson: string): number | number[] | null {
  try {
    const parsed: unknown = JSON.parse(correctJson);
    if (type === "multiple") {
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((c) => Number.isInteger(c) && (c as number) >= 0)
      ) {
        return [...(parsed as number[])].sort((a, b) => a - b);
      }
      return null;
    }
    if (Number.isInteger(parsed) && (parsed as number) >= 0) return parsed as number;
    return null;
  } catch {
    return null;
  }
}

/** Normalise une entrée de réponse en ensemble trié d'indices. */
function answerToSet(answer: unknown): number[] | null {
  if (typeof answer === "number") {
    if (!Number.isInteger(answer) || answer < 0) return null;
    return [answer];
  }
  if (Array.isArray(answer)) {
    const idx = answer.map((c) => Number(c));
    if (idx.some((c) => !Number.isInteger(c) || c < 0)) return null;
    return [...idx].sort((a, b) => a - b);
  }
  return null;
}

/** Comparaison d'ensembles d'indices (déjà triés). */
function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Note une tentative contre le seuil du quiz.
 * Retourne null si les réponses ne sont pas alignées sur les questions
 * (longueur différente) ou de forme invalide — la route renverra alors
 * 422, jamais un score arbitraire.
 *
 * Barème : match exact par question (all-or-nothing pour multiple — un
 * choix partiel est faux). Le tri des ensembles rend le scoring insensible
 * à l'ordre des sélections.
 */
export function scoreAttempt(
  questions: QuestionForScoring[],
  answers: unknown[],
  passThreshold: number,
): QuizScore | null {
  if (questions.length === 0) return null;
  if (!Array.isArray(answers) || answers.length !== questions.length) return null;
  if (!Number.isInteger(passThreshold) || passThreshold < 0 || passThreshold > 100) return null;

  const ordered = questions.slice().sort((a, b) => a.order - b.order);

  const perQuestion: ScoredQuestion[] = [];
  let score = 0;
  let total = 0;

  for (let i = 0; i < ordered.length; i++) {
    const q = ordered[i];
    const correctIndices = parseCorrect(q.type, q.correctJson);
    if (correctIndices === null) return null; // donnée de question corrompue → pas de score
    total += q.points;

    const correctSet = answerToSet(correctIndices);
    const userSet = answerToSet(answers[i]);
    if (userSet === null) return null; // forme de réponse invalide → pas de score

    const correct = correctSet !== null && sameSet(correctSet, userSet);

    perQuestion.push({
      questionId: q.id,
      type: q.type as QuestionType,
      correct,
      pointsEarned: correct ? q.points : 0,
    });
    if (correct) score += q.points;
  }

  const percent = total > 0 ? Math.floor((score / total) * 100) : 0;
  return {
    score,
    total,
    percent,
    passed: percent >= passThreshold,
    perQuestion,
  };
}

/**
 * Une nouvelle tentative est-elle autorisée ? maxAttempts null = illimité
 * (défaut du modèle, protocole §17 : « Les tentatives peuvent être répétées
 * tant qu'aucune règle métier ne l'interdit »).
 */
export function canAttempt(maxAttempts: number | null, attemptsCount: number): boolean {
  if (maxAttempts === null) return true;
  return attemptsCount < maxAttempts;
}

// ── Section 3 : assemblage serveur (ex-workshop-server.ts, DB) ───────────────

/**
 * HASHCODE REBOOT — assemblage serveur du domaine ATELIERS.
 *
 * Glue entre la base et les fonctions pures (sections 1-2 de ce fichier) :
 * charge un atelier avec ses semaines/séances, les données de progression
 * DU MEMBRE COURANT (soumissions + reviews + tentatives), dérive les
 * états côté serveur et les résume. Aucun état n'entre par le client.
 *
 * Utilisé par GET /api/workshops (liste) et GET /api/workshops/[slug]
 * (détail). Les routes de contenu (séance, soumissions, quiz) sont en #85
 * et demandent enrollment + séance débloquée en plus.
 */

import { db } from "@/lib/db";

export interface SessionStateView {
  id: string;
  number: number;
  title: string;
  objective: string | null;
  state: SessionState;
  hasDeliverable: boolean;
  hasQuiz: boolean;
  deliverableRequired: boolean;
  quizRequired: boolean;
  eventId: string | null;
  /** Déblocage manuel admin : ouvre la séance même verrouillée. */
  unlockOverride: boolean;
  /** ISO de la date à partir de laquelle la séance est accessible (gate
   *  calendaire) : scheduledAt, sinon startsAt de l'Event lié, sinon null. */
  availableAt: string | null;
}

export interface WeekStateView {
  id: string;
  number: number;
  title: string;
  objective: string | null;
  sessions: SessionStateView[];
}

export interface WorkshopStateView {
  workshop: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    domain: string | null;
    level: string | null;
  };
  enrollment: { status: string; enrolledAt: Date } | null;
  weeks: WeekStateView[];
  /** Ordre global (flatten weeks×sessions) — aligné sur applyUnlockChain. */
  states: SessionState[];
  summary: WorkshopSummary;
}

/**
 * Charge un atelier et dérive l'état de chaque séance POUR CE MEMBRE.
 * Retourne null si l'atelier n'existe pas.
 *
 * Coût : 1 requête atelier + 2 requêtes (soumissions, tentatives) —
 * indépendant du nombre de séances. Appelé en boucle par la liste : les
 * ateliers publiés sont peu nombreux (v1 : 1), à mettre en cache si besoin.
 */
export async function loadWorkshopForMember(
  memberId: string,
  workshopId: string,
): Promise<WorkshopStateView | null> {
  const workshop = await db.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      status: true,
      domain: true,
      level: true,
      weeks: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          title: true,
          objective: true,
          sessions: {
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              title: true,
              objective: true,
              deliverableRequired: true,
              quizRequired: true,
              eventId: true,
              scheduledAt: true,
              unlockOverride: true,
              event: { select: { startsAt: true } },
              deliverable: { select: { id: true } },
              quiz: { select: { id: true } },
            },
          },
        },
      },
      enrollments: {
        where: { memberId },
        select: { status: true, enrolledAt: true },
        take: 1,
      },
    },
  });
  if (!workshop) return null;

  const sessions = workshop.weeks.flatMap((w) => w.sessions);
  const deliverableIds = sessions
    .map((s) => s.deliverable?.id ?? null)
    .filter((id): id is string => id !== null);
  const quizIds = sessions
    .map((s) => s.quiz?.id ?? null)
    .filter((id): id is string => id !== null);

  const [submissions, attempts] = await Promise.all([
    deliverableIds.length
      ? db.workshopSubmission.findMany({
          where: { memberId, deliverableId: { in: deliverableIds } },
          select: {
            id: true,
            deliverableId: true,
            attempt: true,
            status: true,
            // Dernière review par soumission (la review fait foi — §15).
            reviews: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { decision: true },
            },
          },
        })
      : Promise.resolve([] as never[]),
    quizIds.length
      ? db.workshopQuizAttempt.findMany({
          where: { memberId, quizId: { in: quizIds } },
          select: { quizId: true, passed: true },
        })
      : Promise.resolve([] as never[]),
  ]);

  // Dernière soumission par livrable (append-only → attempt max).
  const byDeliverable = new Map<string, { status: string; reviewDecision: string | null }>();
  const grouped = new Map<string, typeof submissions>();
  for (const sub of submissions) {
    const list = grouped.get(sub.deliverableId) ?? [];
    list.push(sub);
    grouped.set(sub.deliverableId, list);
  }
  for (const [deliverableId, subs] of grouped) {
    const latest = pickLatestSubmission(subs);
    if (latest) {
      byDeliverable.set(deliverableId, {
        status: latest.status,
        reviewDecision: latest.reviews[0]?.decision ?? null,
      });
    }
  }

  const attemptsByQuiz = new Map<string, { passed: boolean }[]>();
  for (const attempt of attempts) {
    const list = attemptsByQuiz.get(attempt.quizId) ?? [];
    list.push({ passed: attempt.passed });
    attemptsByQuiz.set(attempt.quizId, list);
  }

  const rawStates = sessions.map((s) => {
    const deliverableId = s.deliverable?.id ?? null;
    const quizId = s.quiz?.id ?? null;
    return computeSessionState({
      hasDeliverable: deliverableId !== null,
      deliverableRequired: s.deliverableRequired,
      hasQuiz: quizId !== null,
      quizRequired: s.quizRequired,
      latestSubmissionStatus: deliverableId
        ? (byDeliverable.get(deliverableId)?.status ?? null)
        : null,
      latestReviewDecision: deliverableId
        ? (byDeliverable.get(deliverableId)?.reviewDecision ?? null)
        : null,
      quizState: quizId
        ? deriveQuizState(attemptsByQuiz.get(quizId) ?? [])
        : "NOT_STARTED",
    });
  });
  // Ordre des gates : chaîne séquentielle → date → override admin (prime
  // sur TOUT, y compris le gate calendaire — sinon le déverrouillage forcé
  // serait annulé par la date). Une séance ouverte par l'admin est
  // NOT_STARTED, jamais COMPLETED : computeSessionState en repli donne
  // l'état pédagogique réel.
  const states = applyUnlockOverride(
    applyDateGate(
      applyUnlockChain(rawStates),
      sessions.map((s) => s.scheduledAt ?? s.event?.startsAt ?? null),
    ),
    sessions.map((s) => s.unlockOverride),
  );
  const summary = summarizeWorkshop(states);

  // Ré-injecte les états dans la structure par semaines.
  let i = 0;
  const weeks = workshop.weeks.map((w) => ({
    id: w.id,
    number: w.number,
    title: w.title,
    objective: w.objective,
    sessions: w.sessions.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      objective: s.objective,
      state: states[i++],
      hasDeliverable: s.deliverable !== null,
      hasQuiz: s.quiz !== null,
      deliverableRequired: s.deliverableRequired,
      quizRequired: s.quizRequired,
      eventId: s.eventId,
      unlockOverride: s.unlockOverride,
      availableAt: (s.scheduledAt ?? s.event?.startsAt ?? null)?.toISOString() ?? null,
    })),
  }));

  const enrollment = workshop.enrollments[0] ?? null;
  return {
    workshop: {
      id: workshop.id,
      slug: workshop.slug,
      title: workshop.title,
      description: workshop.description,
      status: workshop.status,
      domain: workshop.domain,
      level: workshop.level,
    },
    enrollment: enrollment
      ? { status: enrollment.status, enrolledAt: enrollment.enrolledAt }
      : null,
    weeks,
    states,
    summary,
  };
}

// ── Accès à une séance (détail, soumission, tentative) ──────────────────────

export type SessionAccessCode =
  | "NOT_FOUND"
  | "NOT_ENROLLED"
  | "SESSION_LOCKED";

export type SessionAccess =
  | { ok: true; workshopId: string; state: SessionState }
  | { ok: false; code: "NOT_FOUND" | "NOT_ENROLLED" | "SESSION_LOCKED" };

/**
 * Contrôles d'accès à une séance (protocole §21) :
 *   auth (route) → séance existe & atelier publié → enrollment actif →
 *   séance débloquée. La chaîne de déblocage est RECALCULÉE ici côté
 * serveur — jamais un état fourni par le client.
 *
 * Un atelier draft/archived est masqué (NOT_FOUND) pour un membre, comme
 * un atelier inexistant — pas de fuite d'existence.
 */
export async function getSessionAccess(
  memberId: string,
  sessionId: string,
): Promise<SessionAccess> {
  const ws = await db.workshopSession.findUnique({
    where: { id: sessionId },
    select: {
      week: {
        select: {
          workshopId: true,
          workshop: { select: { status: true } },
        },
      },
    },
  });
  if (!ws) return { ok: false, code: "NOT_FOUND" };
  if (ws.week.workshop.status !== "published") {
    return { ok: false, code: "NOT_FOUND" };
  }

  const enrollment = await db.workshopEnrollment.findUnique({
    where: {
      workshopId_memberId: { workshopId: ws.week.workshopId, memberId },
    },
    select: { status: true },
  });
  if (!enrollment || enrollment.status !== "active") {
    return { ok: false, code: "NOT_ENROLLED" };
  }

  // État recalculé sur TOUTE la chaîne (déblocage séquentiel).
  const view = await loadWorkshopForMember(memberId, ws.week.workshopId);
  const sessionView = view?.weeks
    .flatMap((w) => w.sessions)
    .find((s) => s.id === sessionId);
  if (!view || !sessionView) return { ok: false, code: "NOT_FOUND" };
  if (sessionView.state === "LOCKED") {
    return { ok: false, code: "SESSION_LOCKED" };
  }

  return { ok: true, workshopId: ws.week.workshopId, state: sessionView.state };
}
