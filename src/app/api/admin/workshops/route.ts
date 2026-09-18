import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { WORKSHOP_STATUSES } from "@/lib/workshop-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Statuts de soumission qui attendent une action admin (file de review). */
const AWAITING_REVIEW = new Set(["PENDING", "IN_REVIEW"]);

/**
 * GET /api/admin/workshops — pilotage : liste TOUS les ateliers (brouillons et
 * archives compris) avec leurs compteurs et la file d'attente par séance.
 *
 * AUTH   : admin operator (403 sinon).
 * INPUT  : ?status=draft|published|archived, ?limit (défaut 50, max 200).
 * OUTPUT : { workshops: [{ id, slug, title, …, stats: { enrollmentCount,
 *          submissionCount, reviewCount }, sessions: [{ number, title,
 *          pendingReviews }], recentEnrollments }], total }.
 * ERRORS : 403 accès refusé, 422 statut inconnu, 429 rate limit.
 *
 * Tri : createdAt desc (les plus récents d'abord).
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`admin-workshops-list:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit
    ? Math.min(Math.max(1, Number(rawLimit) || 1), 200)
    : 50;

  if (status && !(WORKSHOP_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      {
        error: "Statut invalide. Attendu : draft | published | archived.",
        code: "INVALID_STATUS",
      },
      { status: 422 },
    );
  }

  const workshops = await db.workshop.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
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
          sessions: {
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              title: true,
              deliverable: { select: { id: true } },
            },
          },
        },
      },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          member: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  // Livrable → { workshopId, sessionId } pour agréger sans requête par atelier.
  const deliverableIndex = new Map<
    string,
    { workshopId: string; sessionId: string }
  >();
  for (const w of workshops) {
    for (const week of w.weeks) {
      for (const session of week.sessions) {
        if (session.deliverable) {
          deliverableIndex.set(session.deliverable.id, {
            workshopId: w.id,
            sessionId: session.id,
          });
        }
      }
    }
  }
  const deliverableIds = [...deliverableIndex.keys()];

  const submissions = deliverableIds.length
    ? await db.workshopSubmission.findMany({
        where: { deliverableId: { in: deliverableIds } },
        select: {
          deliverableId: true,
          status: true,
          _count: { select: { reviews: true } },
        },
      })
    : [];

  const submissionCountByWorkshop = new Map<string, number>();
  const reviewCountByWorkshop = new Map<string, number>();
  const pendingBySession = new Map<string, number>();

  for (const sub of submissions) {
    const index = deliverableIndex.get(sub.deliverableId);
    if (!index) continue;
    submissionCountByWorkshop.set(
      index.workshopId,
      (submissionCountByWorkshop.get(index.workshopId) ?? 0) + 1,
    );
    reviewCountByWorkshop.set(
      index.workshopId,
      (reviewCountByWorkshop.get(index.workshopId) ?? 0) + sub._count.reviews,
    );
    if (AWAITING_REVIEW.has(sub.status)) {
      pendingBySession.set(
        index.sessionId,
        (pendingBySession.get(index.sessionId) ?? 0) + 1,
      );
    }
  }

  return NextResponse.json({
    workshops: workshops.map((w) => ({
      id: w.id,
      slug: w.slug,
      title: w.title,
      description: w.description,
      status: w.status,
      domain: w.domain,
      level: w.level,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      stats: {
        enrollmentCount: w._count.enrollments,
        submissionCount: submissionCountByWorkshop.get(w.id) ?? 0,
        reviewCount: reviewCountByWorkshop.get(w.id) ?? 0,
      },
      sessions: w.weeks.flatMap((week) =>
        week.sessions.map((session) => ({
          id: session.id,
          number: session.number,
          title: session.title,
          weekNumber: week.number,
          pendingReviews: pendingBySession.get(session.id) ?? 0,
        })),
      ),
      recentEnrollments: w.enrollments,
    })),
    total: workshops.length,
  });
}
