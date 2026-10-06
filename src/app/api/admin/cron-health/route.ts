import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AuthError, errorToResponse } from "@/lib/errors";
import { CRON_HEALTH } from "@/lib/cron/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Liste des crons suivis : voir le registre unique (supprime la duplication
// dashboard/route.ts <> cron-health/route.ts — ajouter un cron = le registre).
// `CRON_HEALTH` reproduit exactement les 7 lignes historiques, dans le même ordre.

/**
 * GET /api/admin/cron-health — dernier passage de chaque cron/lot (admin-only).
 * Si un cron quotidien ne tourne plus, le dashboard l'affiche en alerte.
 */
export async function GET(req: NextRequest) {
  try {
  if (!(await isAdminAuthed(req))) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
  }

  const now = Date.now();
  const crons = await Promise.all(
    CRON_HEALTH.map(async (c) => {
      const last = await db.analyticsEvent.findFirst({
        where: { type: c.key },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, ref: true },
      });
      const ageMs = last ? now - last.createdAt.getTime() : null;
      const status = !last
        ? "never"
        : c.expectedEveryH === null
          ? "manual"
          : ageMs !== null && ageMs <= c.expectedEveryH * 2 * 3600 * 1000
            ? "ok"
            : "stale";
      return {
        key: c.key,
        label: c.label,
        expectedEveryH: c.expectedEveryH,
        lastRun: last?.createdAt ?? null,
        summary: last?.ref ?? null,
        status,
      };
    }),
  );

  return NextResponse.json({ ok: true, crons });
  } catch (err) {
    return errorToResponse(err);
  }
}
