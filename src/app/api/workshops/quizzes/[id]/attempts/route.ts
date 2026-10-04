import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { checkCSRF } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { parseAnswers } from "@/lib/workshop-validation";
import { canAttempt, scoreAttempt } from "@/lib/workshop-quiz";
import { getSessionAccess, type SessionAccessCode } from "@/lib/workshop-server";
import { sendEmail } from "@/lib/mail";
import { quizEmail } from "@/lib/workshop-emails";
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const ACCESS_MESSAGES: Record<SessionAccessCode, string> = {
  NOT_FOUND: "Ressource introuvable.",
  NOT_ENROLLED: "Inscris-toi à l'atelier pour accéder à cette séance.",
  SESSION_LOCKED: "Cette séance est encore verrouillée.",
};

/** Traduit un refus d'accès de séance en erreur applicative (404 / 403). */
function accessError(code: SessionAccessCode): Error {
  const message = ACCESS_MESSAGES[code];
  return code === "NOT_FOUND" ? new NotFoundError(message) : new ForbiddenError(message);
}

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
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  const session = await getSession(req);
  if (!session) {
    throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
  }
  if (!checkCSRF(req)) {
    throw new ForbiddenError("CSRF validation failed.");
  }

  const rl = await rateLimit(`workshop-quiz:${session.member.id}`, {
    capacity: 20,
    windowMs: 600_000,
  });
  if (!rl.ok) {
    throw new RateLimitError(
      "Trop de tentatives. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
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
    throw new NotFoundError("Quiz introuvable.");
  }

  const access = await getSessionAccess(session.member.id, quiz.session.id);
  if (!access.ok) {
    throw accessError(access.code);
  }

  const body = (await parseJsonBody(req)) as Record<string, unknown>;

  const answersShape = parseAnswers(body.answers);
  if (!answersShape.ok) {
    throw new ValidationError(answersShape.error);
  }

  // Limite de tentatives (§17 : répétition libre sauf règle métier).
  const attemptsCount = await db.workshopQuizAttempt.count({
    where: { quizId: quiz.id, memberId: session.member.id },
  });
  if (!canAttempt(quiz.maxAttempts, attemptsCount)) {
    throw new ConflictError("Nombre maximum de tentatives atteint.");
  }

  const score = scoreAttempt(quiz.questions, answersShape.answers, quiz.passThreshold);
  if (!score) {
    throw new ValidationError("Réponses invalides ou désalignées sur les questions.");
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

  // Envoi email de résultat de quiz
  const [quizFull, member] = await Promise.all([
    db.workshopQuiz.findUnique({
      where: { id: quiz.id },
      select: {
        title: true,
        session: {
          select: {
            week: {
              select: {
                workshop: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    }),
    db.member.findUnique({
      where: { id: session.member.id },
      select: { email: true, firstName: true },
    }),
  ]);

  if (quizFull?.session?.week?.workshop && member?.email) {
    const workshop = quizFull.session.week.workshop;
    const attemptNumber = attemptsCount + 1;

    const emailPayload = quizEmail({
      memberName: member.firstName || "Membre",
      workshopTitle: workshop.title,
      quizTitle: quizFull.title || "Quiz",
      score: score.score,
      total: score.total,
      passed: score.passed,
      attemptNumber,
    });

    // Fire-and-forget : la réponse ne doit pas attendre le SMTP.
    void sendEmail({
      to: member.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      category: "transactional",
    }).catch(() => {});
  }

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
  } catch (err) {
    return errorToResponse(err);
  }
}
