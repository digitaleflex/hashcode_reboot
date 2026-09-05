import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/activity — recent admin/system events (admin-operator only).
 * Returns the latest N AnalyticsEvents (sorted desc) with timestamps + refs,
 * so the admin can see a chronological feed of what happened.
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

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
