import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { submissionStatusSchema } from "@/lib/missions/types";
import {
  AppError,
  errorToResponse,
  ForbiddenError,
  RateLimitError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/mission-submissions — file de revue (opérateurs).
 * Filtres whitelistés : missionId, status, limit bornée. Identité membre
 * incluse (email/prénom/nom : nécessaire à la revue).
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const rl = await rateLimit(`admin-mission-sub:${rateKey(req)}`, {
      capacity: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const { searchParams } = new URL(req.url);
    const missionId = searchParams.get("missionId");
    const status = searchParams.get("status");
    if (status && !submissionStatusSchema.safeParse(status).success) {
      throw new AppError("Statut invalide.", { status: 422, code: "INVALID_STATUS" });
    }
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(1, Number(rawLimit) || 1), 200) : 50;

    const submissions = await db.missionSubmission.findMany({
      where: {
        ...(missionId ? { missionId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: limit,
      include: {
        mission: { select: { id: true, slug: true, title: true } },
        member: { select: { id: true, email: true, firstName: true, lastName: true } },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { decision: true, reviewer: true, createdAt: true },
        },
      },
    });
    return NextResponse.json({ submissions, total: submissions.length });
  } catch (err) {
    return errorToResponse(err);
  }
}
