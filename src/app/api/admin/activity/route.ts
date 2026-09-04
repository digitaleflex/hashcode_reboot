import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/activity — recent admin/system events (admin-only).
 * Returns the latest N AnalyticsEvents (sorted desc) with timestamps + refs,
 * so the admin can see a chronological feed of what happened.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

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
}
