import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { deriveProgress } from "@/lib/missions/engine";
import { AuthError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/account/missions — ma progression (#232-c).
 * Auth via middleware (401 sans cookie) + session ici. Jamais de PII d'autrui.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) throw new AuthError("Non authentifié.", "UNAUTHENTICATED");

    const assignments = await db.missionAssignment.findMany({
      where: { memberId: session.member.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        validatedAt: true,
        mission: {
          select: { id: true, slug: true, title: true, domain: true, level: true, status: true },
        },
      },
    });
    const progress = deriveProgress(
      assignments.map((a) => ({
        missionId: a.mission.id,
        status: a.status as
          | "UPCOMING"
          | "ACTIVE"
          | "SUBMITTED"
          | "VALIDATED"
          | "REJECTED"
          | "ABANDONED",
      })),
    );
    return NextResponse.json({ assignments, progress });
  } catch (err) {
    return errorToResponse(err);
  }
}
