import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  AuthError,
  errorToResponse,
  NotFoundError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/missions/[id]/abandon — abandonner (ACTIVE/UPCOMING → ABANDONED).
 * Repartir = POST start (nouvelle ligne, historique conservé).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;

    const rl = await rateLimit(`mission-abandon:${rateKey(req)}`, {
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

    const { id } = await params;
    const assignment = await db.missionAssignment.findFirst({
      where: {
        missionId: id,
        memberId: session.member.id,
        status: { in: ["UPCOMING", "ACTIVE"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!assignment) {
      throw new NotFoundError("Aucune mission en cours à abandonner.");
    }

    const updated = await db.missionAssignment.update({
      where: { id: assignment.id },
      data: { status: "ABANDONED", abandonedAt: new Date() },
    });
    return NextResponse.json({ assignment: updated });
  } catch (err) {
    return errorToResponse(err);
  }
}
