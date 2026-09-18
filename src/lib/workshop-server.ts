/**
 * HASHCODE REBOOT — assemblage serveur du domaine ATELIERS.
 *
 * Glue entre la base et les fonctions pures (workshop-progression.ts) :
 * charge un atelier avec ses semaines/séances, les données de progression
 * DU MEMBRE COURANT (soumissions + reviews + tentatives), dérive les
 * états côté serveur et les résume. Aucun état n'entre par le client.
 *
 * Utilisé par GET /api/workshops (liste) et GET /api/workshops/[slug]
 * (détail). Les routes de contenu (séance, soumissions, quiz) sont en #85
 * et demandent enrollment + séance débloquée en plus.
 */

import { db } from "@/lib/db";
import {
  applyDateGate,
  applyUnlockChain,
  computeSessionState,
  deriveQuizState,
  pickLatestSubmission,
  summarizeWorkshop,
  type SessionState,
  type WorkshopSummary,
} from "./workshop-progression";

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
  const states = applyDateGate(
    applyUnlockChain(rawStates),
    sessions.map((s) => s.scheduledAt ?? s.event?.startsAt ?? null),
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
