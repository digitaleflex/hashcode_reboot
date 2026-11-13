import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AuthError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/activity-logins — activité des connexions membres (admin-only).
 *
 * Source : table Better Auth `Session` (`updatedAt` est rafraîchi à chaque
 * requête authentifiée → même sémantique de fenêtre glissante que l'ancien
 * `MemberSession.lastSeenAt`, à l'écriture près). `MemberSession` n'est plus
 * écrit depuis la bascule Better Auth : le lire renvoyait un DAU toujours nul.
 * `expiresAt > NOW()` remplace `revokedAt IS NULL` : Better Auth supprime la
 * ligne à la déconnexion, il n'y a pas de colonne de révocation.
 * Membres distincts actifs par jour (DAU) sur 30 jours + distincts 30j.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdminAuthed(req))) {
      throw new AuthError("Non autorisé.", "UNAUTHORIZED");
    }

    const rows = await db.$queryRaw<
      Array<{ day: string; active: bigint }>
    >`
    SELECT
      to_char(date_trunc('day', "updatedAt"), 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT "userId") AS active
    FROM "Session"
    WHERE "updatedAt" >= NOW() - INTERVAL '30 days'
      AND "expiresAt" > NOW()
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
    const distinct30 = await db.session.groupBy({
      by: ["userId"],
      where: {
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
        expiresAt: { gt: new Date() },
      },
    });

    return NextResponse.json({
      ok: true,
      daily,
      dau7Avg: Math.round((last7 / 7) * 10) / 10,
      distinct30: distinct30.length,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
