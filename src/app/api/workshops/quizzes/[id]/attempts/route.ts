import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { checkCSRF } from "@/lib/admin-auth";
import { rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { parseAnswers } from "@/lib/workshop-validation";
import { canAttempt, scoreAttempt } from "@/lib/workshop-quiz";
import { getSessionAccess, type SessionAccessCode } from "@/lib/workshop-server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const ACCESS_STATUS: Record<SessionAccessCode, number> = {
  NOT_FOUND: 404,
  NOT_ENROLLED: 403,
  SESSION_LOCKED: 403,
};

/**
 * POST /api/workshops/quizzes/[id]/attempts — soumettre les réponses du
 * quiz de la séance.
 *
 * AUTH   : session membre (401) + CSRF (403) + enrollment actif (403) +
 *          séance débloquée (403).
 * INPUT  : { answers: (number|number[])[] } — forme validée par
 *          parseAnswers(), SCORING 100% serveur (workshop-quiz).
 * OUTPUT : 201 { ok, attempt: { id, score, total, percent, passed } } —
 *          le détail perQuestion est volontairement ABSENT : il révélerait
 *          quelles questions sont ratées et rétrécit l'espace de recherche
 *          des réponses correctes.
 * ERRORS : 401, 403, 404 (quiz inexistant), 409 (maxAttempts atteint),
 *          422 (réponses invalides ou désalignées), 429.
 * GUARDS : blockIfTesting.
 * SECRETS: correctJson ne quitte jamais le serveur (cf. workshop-quiz.ts,
 *          tests de non-fuite).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }

  const rl = await rateLimit(`workshop-quiz:${session.member.id}`, {
    capacity: 20,
    windowMs: 600_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { id } = await params;
  const quiz = await db.workshopQuiz.findUnique({
    where: { id },
    select: {
      id: true,
      passThreshold: true,
      maxAttempts: true,
      questions: {
        orderBy: { order: "asc" },
        // Scoring serveur : correctJson requis ici, JAMAIS en sortie.
        select: {
          id: true,
          order: true,
          type: true,
          prompt: true,
          optionsJson: true,
          correctJson: true,
          points: true,
        },
      },
      session: { select: { id: true } },
    },
  });
  if (!quiz) {
    return NextResponse.json(
      { error: "Quiz introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const access = await getSessionAccess(session.member.id, quiz.session.id);
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  const answersShape = parseAnswers(body.answers);
  if (!answersShape.ok) {
    return NextResponse.json(
      { error: answersShape.error, code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  // Limite de tentatives (§17 : répétition libre sauf règle métier).
  const attemptsCount = await db.workshopQuizAttempt.count({
    where: { quizId: quiz.id, memberId: session.member.id },
  });
  if (!canAttempt(quiz.maxAttempts, attemptsCount)) {
    return NextResponse.json(
      { error: "Nombre maximum de tentatives atteint.", code: "MAX_ATTEMPTS" },
      { status: 409 },
    );
  }

  const score = scoreAttempt(quiz.questions, answersShape.answers, quiz.passThreshold);
  if (!score) {
    return NextResponse.json(
      { error: "Réponses invalides ou désalignées sur les questions.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const attempt = await db.workshopQuizAttempt.create({
    data: {
      quizId: quiz.id,
      memberId: session.member.id,
      answersJson: JSON.stringify(answersShape.answers),
      score: score.score,
      passed: score.passed,
      submittedAt: new Date(),
    },
    select: { id: true, score: true, passed: true, submittedAt: true },
  });

  return NextResponse.json(
    {
      ok: true,
      attempt: {
        id: attempt.id,
        score: score.score,
        total: score.total,
        percent: score.percent,
        passed: score.passed,
        submittedAt: attempt.submittedAt,
      },
    },
    { status: 201 },
  );
}
