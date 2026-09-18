import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/activity-logins — activité des connexions membres (admin-only).
 *
 * Proxy : MemberSession.lastSeenAt (refresh sliding-window à chaque requête
 * authentifiée, 1 write/heure max). Membres distincts actifs par jour (DAU)
 * sur 30 jours + distincts 7j / 30j.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const rows = await db.$queryRaw<
    Array<{ day: string; active: bigint }>
  >`
    SELECT
      to_char(date_trunc('day', "lastSeenAt"), 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT "memberId") AS active
    FROM "MemberSession"
    WHERE "lastSeenAt" >= NOW() - INTERVAL '30 days'
      AND "revokedAt" IS NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const byDay = new Map(rows.map((r) => [r.day, Number(r.active)]));
  const daily: { date: string; active: number }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().split("T")[0];
    daily.push({ date: key, active: byDay.get(key) ?? 0 });
  }

  const last7 = daily.slice(-7).reduce((a, d) => a + d.active, 0);
  const distinct30 = await db.memberSession.groupBy({
    by: ["memberId"],
    where: { lastSeenAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) }, revokedAt: null },
  });

  return NextResponse.json({
    ok: true,
    daily,
    dau7Avg: Math.round((last7 / 7) * 10) / 10,
    distinct30: distinct30.length,
  });
}
