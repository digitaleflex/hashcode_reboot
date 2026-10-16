import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { normalizeEmail, normalizePhone } from "@/lib/dedup";
import {
  errorToResponse,
  ForbiddenError,
  RateLimitError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MEMBER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  country: true,
  profileStatus: true,
  createdAt: true,
} as const;

/**
 * GET /api/admin/duplicates — candidats à la fusion (opérateurs, #103).
 * EXACT : même email normalisé (insensible casse/espaces). AMBIGU : même
 * téléphone normalisé, emails différents (contrôle humain exigé pour fusion).
 * Borné (limit, max 200 groupes). Lecture seule.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const rl = await rateLimit(`admin-duplicates:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const rawLimit = new URL(req.url).searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(1, Number(rawLimit) || 1), 200) : 50;

    // Groupes exacts (SQL, même normalisation que l'index unique).
    const exactGroups = (await db.$queryRaw<{ key: string; ids: string[] }[]>`
      SELECT LOWER(TRIM(email)) AS key, ARRAY_AGG(id ORDER BY "createdAt") AS ids
      FROM "Member" WHERE "deletedAt" IS NULL
      GROUP BY 1 HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC LIMIT ${limit}
    `) as { key: string; ids: string[] }[];

    // Groupes téléphone (SQL, même normalisation que l'index).
    const phoneGroups = (await db.$queryRaw<{ key: string; ids: string[] }[]>`
      SELECT regexp_replace(phone, '[\\s\\-().]', '', 'g') AS key,
             ARRAY_AGG(id ORDER BY "createdAt") AS ids
      FROM "Member" WHERE "deletedAt" IS NULL AND phone IS NOT NULL
      GROUP BY 1 HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC LIMIT ${limit}
    `) as { key: string; ids: string[] }[];

    const loadGroup = async (ids: string[]) =>
      db.member.findMany({ where: { id: { in: ids } }, select: MEMBER_SELECT });

    const exact = await Promise.all(
      exactGroups.map(async (g) => ({
        kind: "EXACT" as const,
        key: g.key,
        members: await loadGroup(g.ids),
      })),
    );
    // Téléphone seul + emails déjà couverts par EXACT → reste AMBIGU.
    const exactIds = new Set(exact.flatMap((g) => g.members.map((m) => m.id)));
    const ambiguous = (
      await Promise.all(
        phoneGroups.map(async (g) => {
          const members = (await loadGroup(g.ids)).filter((m) => !exactIds.has(m.id));
          if (members.length < 2) return null;
          const emails = new Set(
            members.map((m) => normalizeEmail(m.email)).filter(Boolean),
          );
          if (emails.size < 2) return null; // même email → déjà EXACT
          return {
            kind: "AMBIGUOUS" as const,
            key: g.key,
            phone: normalizePhone(
              members.find((m) => m.phone)?.phone,
            ),
            members,
          };
        }),
      )
    ).filter((g): g is NonNullable<typeof g> => g !== null);

    return NextResponse.json({ exact, ambiguous });
  } catch (err) {
    return errorToResponse(err);
  }
}
