import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { AuthError, ForbiddenError, errorToResponse, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPEN_STATUSES = ["UPCOMING", "ACTIVE", "SUBMITTED"] as const;

/**
 * POST /api/missions/[id]/start — démarrer une mission (#232-c).
 * Idempotent : une assignation ouverte existante est renvoyée (pas de doublon).
 * Après ABANDONED : nouvelle ligne (historique conservé). Mission PUBLISHED exigée.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;

    const rl = await rateLimit(`mission-start:${rateKey(req)}`, {
      capacity: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
      );
    }

    const session = await getSession(req);
    if (!session) throw new AuthError("Non authentifié.", "UNAUTHENTICATED");

    // CSRF : même origine obligatoire (#233).
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }

    const { id } = await params;
    const mission = await db.mission.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    // 404 dans les deux cas (brouillon jamais révélé).
    if (!mission || mission.status !== "PUBLISHED") {
      throw new NotFoundError("Mission introuvable.");
    }

    const existing = await db.missionAssignment.findFirst({
      where: {
        missionId: id,
        memberId: session.member.id,
        status: { in: [...OPEN_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({ assignment: existing, created: false });
    }

    const assignment = await db.missionAssignment.create({
      data: { missionId: id, memberId: session.member.id, status: "ACTIVE" },
    });
    return NextResponse.json({ assignment, created: true }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
