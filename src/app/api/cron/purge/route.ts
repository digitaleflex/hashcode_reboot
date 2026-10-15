import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { purgeExpired } from "@/lib/retention";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/purge — purge de rétention (#153).
 * Supprime les données techniques expirées (brouillons obsolètes, mesures
 * brutes > 13 mois). Ne touche jamais : AuditLog, Consent, Qualification,
 * Member, RateLimit, tables d'auth.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "purge non configurée (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const purged = await purgeExpired(db);
  // Heartbeat (comme event-reminders) : le dashboard détecte les passages
  // manqués via expectedEveryH. Best-effort, jamais bloquant.
  try {
    await db.analyticsEvent.create({
      data: toServerEventData({ type: "cron_purge", ref: "cron-purge" }),
    });
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString(), purged });
}
