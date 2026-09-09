import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/activity — recent admin/system events (admin-operator only).
 * Returns the latest N AnalyticsEvents (sorted desc) with timestamps + refs
 * + session/member/value + member details (email, prénom, statut),
 * so the admin can see a chronological feed with user detail per row.
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const rawLimit = searchParams.get("limit");
    const n = rawLimit === null ? 20 : Number(rawLimit);
    const limit = Number.isFinite(n)
      ? Math.min(Math.max(Math.floor(n), 1), 100)
      : 20;

    const events = await db.analyticsEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        sessionId: true,
        memberId: true,
        ref: true,
        value: true,
        createdAt: true,
      },
    });

    // Enrichit avec les détails membre (email, prénom, statut) pour le détail par user
    const memberIds = [...new Set(events.map((e) => e.memberId).filter(Boolean))] as string[];
    const members =
      memberIds.length > 0
        ? await db.member.findMany({
            where: { id: { in: memberIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileStatus: true,
              country: true,
              city: true,
            },
          })
        : [];
    const memberById = new Map(members.map((m) => [m.id, m]));

    const enriched = events.map((e) => ({
      ...e,
      member: e.memberId ? (memberById.get(e.memberId) ?? null) : null,
    }));

    return NextResponse.json({ events: enriched });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
