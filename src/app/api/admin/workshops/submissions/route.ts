import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { SUBMISSION_STATUSES } from "@/lib/workshop-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Statuts par défaut de la file de revue (non encore traités). */
const DEFAULT_QUEUE_STATUSES = ["PENDING", "IN_REVIEW"];

/**
 * GET /api/admin/workshops/submissions — file de revue des livrables.
 *
 * AUTH   : admin operator.
 * INPUT  : ?status=PENDING|IN_REVIEW|APPROVED|REVISION|REJECTED,
 *          ?workshopId, ?limit (défaut 100, max 500).
 * OUTPUT : { submissions: [{ …, member, deliverable: { title, type },
 *          session: { number, title }, workshop: { id, slug, title } }],
 *          total }.
 * ERRORS : 403, 422 statut inconnu, 429.
 *
 * Tri : submittedAt asc — le plus ancien d'abord (équité de traitement).
 * Sans `status`, la file se limite à PENDING + IN_REVIEW.
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`admin-workshop-submissions:${rateKey(req)}`, {
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
  const workshopId = searchParams.get("workshopId");
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit
    ? Math.min(Math.max(1, Number(rawLimit) || 1), 500)
    : 100;

  if (status && !(SUBMISSION_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      {
        error:
          "Statut invalide. Attendu : PENDING | IN_REVIEW | APPROVED | REVISION | REJECTED.",
        code: "INVALID_STATUS",
      },
      { status: 422 },
    );
  }

  const rows = await db.workshopSubmission.findMany({
    where: {
      status: status ? status : { in: [...DEFAULT_QUEUE_STATUSES] },
      ...(workshopId
        ? { deliverable: { session: { week: { workshopId } } } }
        : {}),
    },
    orderBy: { submittedAt: "asc" },
    take: limit,
    select: {
      id: true,
      attempt: true,
      content: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      member: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      deliverable: {
        select: {
          id: true,
          title: true,
          type: true,
          session: {
            select: {
              id: true,
              number: true,
              title: true,
              week: {
                select: {
                  id: true,
                  number: true,
                  workshop: { select: { id: true, slug: true, title: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const submissions = rows.map((row) => {
    const { deliverable, ...rest } = row;
    const { session, ...deliverableFields } = deliverable;
    const { week, ...sessionFields } = session;
    return {
      ...rest,
      deliverable: deliverableFields,
      session: { ...sessionFields, weekNumber: week.number },
      workshop: week.workshop,
    };
  });

  return NextResponse.json({ submissions, total: submissions.length });
}
