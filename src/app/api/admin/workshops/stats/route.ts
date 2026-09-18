import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import {
  SUBMISSION_STATUSES,
  ENROLLMENT_STATUSES,
} from "@/lib/workshop-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function zeroed(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

/**
 * GET /api/admin/workshops/stats — vue globale de pilotage des ateliers.
 *
 * AUTH   : admin operator.
 * OUTPUT : {
 *   totals: { workshops, enrollments, submissions, reviews },
 *   enrollmentsByStatus: { active, completed, dropped },
 *   submissionsByStatus: { PENDING, IN_REVIEW, APPROVED, REVISION, REJECTED },
 *   quiz: { totalAttempts, passedAttempts, passRate },
 *   workshops: [{ id, slug, title, status, enrollmentCount, completedEnrollments,
 *                 completionRate, submissionCount, avgSubmissionsPerMember }],
 *   recentReviews: [10 dernières, avec membre + atelier]
 * }
 * ERRORS : 403, 429.
 *
 * Taux exprimés en pourcentage 0..100. `avgSubmissionsPerMember` = soumissions
 * / nombre de membres ayant effectivement soumis (pas les inscrits).
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`admin-workshop-stats:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const [
    totalWorkshops,
    totalEnrollments,
    totalSubmissions,
    totalReviews,
    enrollmentStatusGroups,
    submissionStatusGroups,
    totalQuizAttempts,
    passedQuizAttempts,
    workshops,
    enrollmentByWorkshopGroups,
    submissionPairs,
    deliverables,
    recentReviews,
  ] = await Promise.all([
    db.workshop.count(),
    db.workshopEnrollment.count(),
    db.workshopSubmission.count(),
    db.workshopReview.count(),
    db.workshopEnrollment.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.workshopSubmission.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.workshopQuizAttempt.count(),
    db.workshopQuizAttempt.count({ where: { passed: true } }),
    db.workshop.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        _count: { select: { enrollments: true } },
      },
    }),
    db.workshopEnrollment.groupBy({
      by: ["workshopId", "status"],
      _count: { _all: true },
    }),
    db.workshopSubmission.groupBy({
      by: ["deliverableId", "memberId"],
      _count: { _all: true },
    }),
    db.workshopDeliverable.findMany({
      select: {
        id: true,
        session: { select: { week: { select: { workshopId: true } } } },
      },
    }),
    db.workshopReview.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        reviewer: true,
        decision: true,
        feedback: true,
        createdAt: true,
        submission: {
          select: {
            id: true,
            member: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            deliverable: {
              select: {
                title: true,
                session: {
                  select: {
                    number: true,
                    title: true,
                    week: {
                      select: {
                        workshop: { select: { id: true, slug: true, title: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const enrollmentsByStatus = zeroed(ENROLLMENT_STATUSES);
  for (const group of enrollmentStatusGroups) {
    enrollmentsByStatus[group.status] =
      (enrollmentsByStatus[group.status] ?? 0) + group._count._all;
  }

  const submissionsByStatus = zeroed(SUBMISSION_STATUSES);
  for (const group of submissionStatusGroups) {
    submissionsByStatus[group.status] =
      (submissionsByStatus[group.status] ?? 0) + group._count._all;
  }

  const deliverableToWorkshop = new Map(
    deliverables.map((d) => [d.id, d.session.week.workshopId]),
  );

  const subsByWorkshop = new Map<string, { total: number; members: Set<string> }>();
  for (const pair of submissionPairs) {
    const workshopId = deliverableToWorkshop.get(pair.deliverableId);
    if (!workshopId) continue;
    const entry = subsByWorkshop.get(workshopId) ?? {
      total: 0,
      members: new Set<string>(),
    };
    entry.total += pair._count._all;
    entry.members.add(pair.memberId);
    subsByWorkshop.set(workshopId, entry);
  }

  const enrollByWorkshop = new Map<string, { total: number; completed: number }>();
  for (const group of enrollmentByWorkshopGroups) {
    const entry = enrollByWorkshop.get(group.workshopId) ?? {
      total: 0,
      completed: 0,
    };
    entry.total += group._count._all;
    if (group.status === "completed") entry.completed += group._count._all;
    enrollByWorkshop.set(group.workshopId, entry);
  }

  const perWorkshop = workshops.map((w) => {
    const subs = subsByWorkshop.get(w.id);
    const enroll = enrollByWorkshop.get(w.id);
    const enrollmentCount = w._count.enrollments;
    const distinctSubmitters = subs?.members.size ?? 0;
    return {
      id: w.id,
      slug: w.slug,
      title: w.title,
      status: w.status,
      enrollmentCount,
      completedEnrollments: enroll?.completed ?? 0,
      completionRate:
        enrollmentCount > 0
          ? round2(((enroll?.completed ?? 0) / enrollmentCount) * 100)
          : 0,
      submissionCount: subs?.total ?? 0,
      avgSubmissionsPerMember:
        distinctSubmitters > 0
          ? round2((subs?.total ?? 0) / distinctSubmitters)
          : 0,
    };
  });

  return NextResponse.json({
    totals: {
      workshops: totalWorkshops,
      enrollments: totalEnrollments,
      submissions: totalSubmissions,
      reviews: totalReviews,
    },
    enrollmentsByStatus,
    submissionsByStatus,
    quiz: {
      totalAttempts: totalQuizAttempts,
      passedAttempts: passedQuizAttempts,
      passRate:
        totalQuizAttempts > 0
          ? round2((passedQuizAttempts / totalQuizAttempts) * 100)
          : 0,
    },
    workshops: perWorkshop,
    recentReviews,
  });
}
