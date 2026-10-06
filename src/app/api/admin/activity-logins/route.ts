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
 * Source de vérité : `Session` (Better Auth). Elle lisait `MemberSession`, un
 * doublon de l'ère pré-Better Auth resté sans aucun écrivain — donc ses deux
 * lectures renvoyaient du vide, en silence : le DAU du tableau de bord valait
 * 0 et s'affichait comme un vrai chiffre. Ce n'était pas une donnée absente,
 * c'était une donnée fausse.
 *
 * Deux colonnes de `MemberSession` n'existent pas dans `Session`, et les
 * remplacer naïvement aurait reconduit le même mensonge :
 *
 *  - `lastSeenAt` → `updatedAt`. `Session` n'a pas de « dernier vu », mais
 *    Better Auth rafraîchit `updatedAt` à chaque requête authentifiée (fenêtre
 *    glissante) : c'est exactement la même sémantique, à l'écriture près
 *    (1 write par requête authentifiée au lieu d'1 par heure). C'est donc le
 *    meilleur substitut, et le seul défendable.
 *  - `revokedAt` → `expiresAt > NOW()`. Il n'y a pas de colonne de révocation :
 *    Better Auth SUPPRIME la ligne à la déconnexion ou à la révocation, et la
 *    seule façon qu'une ligne subsiste en étant invalide est d'avoir dépassé
 *    son expiration. `expiresAt > NOW()` est donc l'équivalent exact, pas une
 *    approximation.
 *
 * « Membre » se compte par `userId` : `Member` et `User` se correspondent 1:1
 * par email (`account-auth.ts`), et le `groupBy` déduplique les appareils. Un
 * membre sans session n'apparaît pas, ce qui est correct pour un DAU.
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
    // Même couple de prédicats que le SQL ci-dessus : c'est `userId` qui joue
    // le rôle du membre, et `expiresAt` celui de la révocation.
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
