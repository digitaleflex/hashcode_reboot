import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { SUBMISSION_STATUSES } from "@/lib/workshop-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arrondi à 2 décimales — évite les flottants illisibles dans une API. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compteurs de soumissions à zéro, indexés par statut. */
function emptyStatusCounts(): Record<string, number> {
  return Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s, 0]));
}

/**
 * GET /api/admin/workshops/[id] — détail pédagogique complet + pilotage.
 *
 * AUTH   : admin operator.
 * INPUT  : id (path).
 * OUTPUT : { workshop: { …, weeks: [{ sessions: [{ activities, deliverable,
 *          quiz (correctJson INCLUS), stats: { submissionCounts,
 *          submissionTotal, quiz: { attemptCount, averageScore } } }] }],
 *          enrollments (membre), submissions (membre + historique reviews) } }.
 * ERRORS : 403, 404 atelier introuvable, 429.
 *
 * Le `correctJson` des questions est volontairement exposé ICI (admin seulement)
 * pour permettre la revue ; la route membre ne le projette jamais.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`admin-workshop-detail:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { id } = await params;

  const workshop = await db.workshop.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      status: true,
      domain: true,
      level: true,
      createdAt: true,
      updatedAt: true,
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
              program: true,
              skills: true,
              deliverableRequired: true,
              quizRequired: true,
              eventId: true,
              scheduledAt: true,
              createdAt: true,
              updatedAt: true,
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
                select: {
                  id: true,
                  type: true,
                  title: true,
                  description: true,
                  isRequired: true,
                },
              },
              quiz: {
                select: {
                  id: true,
                  title: true,
                  passThreshold: true,
                  maxAttempts: true,
                  isRequired: true,
                  questions: {
                    orderBy: { order: "asc" },
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
                },
              },
            },
          },
        },
      },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          member: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!workshop) {
    return NextResponse.json(
      { error: "Atelier introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const sessions = workshop.weeks.flatMap((w) => w.sessions);
  const deliverableToSession = new Map<string, string>();
  for (const session of sessions) {
    if (session.deliverable) {
      deliverableToSession.set(session.deliverable.id, session.id);
    }
  }
  const deliverableIds = [...deliverableToSession.keys()];
  const quizIds = sessions
    .map((s) => s.quiz?.id)
    .filter((qid): qid is string => typeof qid === "string");

  const [submissions, quizGroups] = await Promise.all([
    deliverableIds.length
      ? db.workshopSubmission.findMany({
          where: { deliverableId: { in: deliverableIds } },
          orderBy: { submittedAt: "desc" },
          select: {
            id: true,
            deliverableId: true,
            memberId: true,
            attempt: true,
            content: true,
            status: true,
            submittedAt: true,
            reviewedAt: true,
            member: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            reviews: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                reviewer: true,
                decision: true,
                feedback: true,
                createdAt: true,
              },
            },
          },
        })
      : Promise.resolve([] as never[]),
    quizIds.length
      ? db.workshopQuizAttempt.groupBy({
          by: ["quizId"],
          where: { quizId: { in: quizIds } },
          _avg: { score: true },
          _count: { _all: true },
        })
      : Promise.resolve([] as never[]),
  ]);

  const submissionCountsBySession = new Map<string, Record<string, number>>();
  for (const session of sessions) {
    submissionCountsBySession.set(session.id, emptyStatusCounts());
  }
  for (const sub of submissions) {
    const sessionId = deliverableToSession.get(sub.deliverableId);
    if (!sessionId) continue;
    const counts = submissionCountsBySession.get(sessionId);
    if (!counts) continue;
    counts[sub.status] = (counts[sub.status] ?? 0) + 1;
  }

  const quizStats = new Map<
    string,
    { attemptCount: number; averageScore: number | null }
  >();
  for (const row of quizGroups) {
    quizStats.set(row.quizId, {
      attemptCount: row._count._all,
      averageScore: row._avg.score === null ? null : round2(row._avg.score),
    });
  }

  return NextResponse.json({
    workshop: {
      id: workshop.id,
      slug: workshop.slug,
      title: workshop.title,
      description: workshop.description,
      status: workshop.status,
      domain: workshop.domain,
      level: workshop.level,
      createdAt: workshop.createdAt,
      updatedAt: workshop.updatedAt,
      weeks: workshop.weeks.map((week) => ({
        id: week.id,
        number: week.number,
        title: week.title,
        objective: week.objective,
        sessions: week.sessions.map((session) => {
          const counts = submissionCountsBySession.get(session.id) ?? {};
          const submissionTotal = Object.values(counts).reduce(
            (sum, n) => sum + n,
            0,
          );
          return {
            ...session,
            stats: {
              submissionCounts: counts,
              submissionTotal,
              quiz: session.quiz
                ? (quizStats.get(session.quiz.id) ?? {
                    attemptCount: 0,
                    averageScore: null,
                  })
                : { attemptCount: 0, averageScore: null },
            },
          };
        }),
      })),
      enrollments: workshop.enrollments,
      submissions,
    },
  });
}
