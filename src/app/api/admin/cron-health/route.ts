import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CRONS = [
  { key: "cron_relance", label: "Relance profils (J+7)", expectedEveryH: 24 },
  { key: "cron_email_alerts", label: "Alertes délivrabilité", expectedEveryH: 24 },
  { key: "cron_collect_metrics", label: "Collecte métriques", expectedEveryH: 24 },
  { key: "admin_announce_dashboard", label: "Annonce espace (manuel)", expectedEveryH: null },
  { key: "admin_invite_relance", label: "Relance invitations (manuel)", expectedEveryH: null },
  { key: "admin_import_invite", label: "Import invitations (manuel)", expectedEveryH: null },
] as const;

/**
 * GET /api/admin/cron-health — dernier passage de chaque cron/lot (admin-only).
 * Si un cron quotidien ne tourne plus, le dashboard l'affiche en alerte.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const now = Date.now();
  const crons = await Promise.all(
    CRONS.map(async (c) => {
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
}
