import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/missions — référentiel public (#232-c).
 * Missions PUBLISHED uniquement (les DRAFT/ARCHIVED → 404 ailleurs, jamais
 * listées). Si session : statut de mon assignation ouverte joint par mission.
 */
export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(`missions-list:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de requêtes.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
      );
    }

    const missions = await db.mission.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        domain: true,
        level: true,
        sortOrder: true,
      },
    });

    // Enrichissement optionnel : jamais bloquant, jamais d'erreur si anonyme.
    let mine: Record<string, string> = {};
    try {
      const session = await getSession(req);
      if (session) {
        const open = await db.missionAssignment.findMany({
          where: {
            memberId: session.member.id,
            status: { in: ["UPCOMING", "ACTIVE", "SUBMITTED", "VALIDATED"] },
          },
          select: { missionId: true, status: true },
        });
        mine = Object.fromEntries(open.map((a) => [a.missionId, a.status]));
      }
    } catch {
      /* anonyme : liste seule */
    }

    return NextResponse.json({
      missions: missions.map((m) => ({
        ...m,
        myStatus: mine[m.id] ?? null,
      })),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
