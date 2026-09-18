import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { getSessionAccess, type SessionAccessCode } from "@/lib/workshop-server";
import { canAttempt, publicQuestions } from "@/lib/workshop-quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ACCESS_STATUS: Record<SessionAccessCode, number> = {
  NOT_FOUND: 404,
  NOT_ENROLLED: 403,
  SESSION_LOCKED: 403,
};

/**
 * GET /api/workshops/sessions/[id] — détail pédagogique d'une séance
 * POUR le membre courant.
 *
 * AUTH   : session membre (401) + enrollment actif (403 NOT_ENROLLED) +
 *          séance débloquée (403 SESSION_LOCKED).
 * OUTPUT : session (objectif, programme, compétences), activités et
 *          ressources ordonnées, livrable, MES soumissions + reviews
 *          (feedback), quiz avec questions PUBLIQUES (JAMAIS correctJson),
 *          mes tentatives + canAttempt.
 * ERRORS : 401, 403, 404, 429.
 *
 * GARDE-FOU : les réponses correctes ne quittent jamais le serveur — les
 * questions sont sérialisées via publicQuestions() uniquement. Un membre
 * ne peut voir QUE ses propres soumissions (ownership strict).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`workshop-session:${session.member.id}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { id } = await params;
  const access = await getSessionAccess(session.member.id, id);
  if (!access.ok) {
    const messages: Record<SessionAccessCode, string> = {
      NOT_FOUND: "Ressource introuvable.",
      NOT_ENROLLED: "Inscris-toi à l'atelier pour accéder à cette séance.",
      SESSION_LOCKED: "Cette séance est encore verrouillée.",
    };
    return NextResponse.json(
      { error: messages[access.code], code: access.code },
      { status: ACCESS_STATUS[access.code] },
    );
  }

  const ws = await db.workshopSession.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      title: true,
      objective: true,
      program: true,
      skills: true,
      activities: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          kind: true,
          title: true,
          description: true,
          url: true,
        },
      },
      deliverable: {
        select: { id: true, type: true, title: true, description: true, isRequired: true },
      },
      quiz: {
        select: {
          id: true,
          title: true,
          passThreshold: true,
          maxAttempts: true,
          isRequired: true,
          // correctJson volontairement NON sélectionné : jamais exposé.
          questions: {
            orderBy: { order: "asc" },
            select: { id: true, order: true, type: true, prompt: true, optionsJson: true, points: true },
          },
        },
      },
    },
  });
  if (!ws) {
    return NextResponse.json(
      { error: "Ressource introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // MES soumissions + reviews (ownership strict : memberId dans le where).
  const mySubmissions = ws.deliverable
    ? await db.workshopSubmission.findMany({
        where: { memberId: session.member.id, deliverableId: ws.deliverable.id },
        orderBy: { attempt: "desc" },
        select: {
          id: true,
          attempt: true,
          content: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviews: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              decision: true,
              feedback: true,
              reviewer: true,
              createdAt: true,
            },
          },
        },
      })
    : [];

  const myAttempts = ws.quiz
    ? await db.workshopQuizAttempt.findMany({
        where: { memberId: session.member.id, quizId: ws.quiz.id },
        orderBy: { submittedAt: "desc" },
        select: { id: true, score: true, passed: true, submittedAt: true },
      })
    : [];

  return NextResponse.json({
    session: {
      id: ws.id,
      number: ws.number,
      title: ws.title,
      objective: ws.objective,
      program: ws.program,
      skills: ws.skills,
      state: access.state,
    },
    activities: ws.activities,
    deliverable: ws.deliverable,
    // Jamais de correctJson dans cette réponse.
    quiz: ws.quiz
      ? {
          id: ws.quiz.id,
          title: ws.quiz.title,
          passThreshold: ws.quiz.passThreshold,
          maxAttempts: ws.quiz.maxAttempts,
          isRequired: ws.quiz.isRequired,
          questions: publicQuestions(ws.quiz.questions),
          myAttempts: myAttempts.map((a) => ({
            id: a.id,
            score: a.score,
            passed: a.passed,
            submittedAt: a.submittedAt,
          })),
          // Serveur only : une nouvelle tentative est-elle possible ?
          canAttempt: canAttempt(ws.quiz.maxAttempts, myAttempts.length),
        }
      : null,
    mySubmissions,
  });
}
