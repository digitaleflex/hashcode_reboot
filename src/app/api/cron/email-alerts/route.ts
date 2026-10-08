import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import { runAlertCheck } from "@/lib/email-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/email-alerts — vérifie les seuils de délivrabilité
 * (bounce, plainte, livraison, ouverture, clic) et notifie si besoin.
 * À appeler 1×/jour après le collecteur de métriques (cron-job.org).
 * Notifications via ALERT_EMAILS et/ou ALERT_SLACK_WEBHOOK.
 */

/** Clé fixe de sérialisation des runs de ce cron (verrou consultatif Postgres). */
const ADVISORY_LOCK_KEY = 123458;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "alertes non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // ── Sérialise les runs qui se chevauchent (même pattern que event-reminders)
  // pg_advisory_xact_lock est libéré automatiquement en fin de transaction,
  // y compris sur erreur. Le try/finally garantit le nettoyage best-effort
  // restant (unlock explicite = no-op si déjà libéré).
  await db.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`,
  );
  try {
    const result = await runAlertCheck();

    try {
      await withPrismaRetry(() =>
        db.analyticsEvent.create({
          data: toServerEventData({
            type: "cron_email_alerts",
            ref: `alerts=${result.alerts.length} critical=${result.hasCritical}`,
            value: result.alerts.length,
          }),
        }),
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ok: true,
      alerts: result.alerts.length,
      hasCritical: result.hasCritical,
      hasWarning: result.hasWarning,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "erreur inconnue" },
      { status: 500 },
    );
  } finally {
    try {
      await db.$executeRawUnsafe(
        `SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`,
      );
    } catch {
      /* déjà libéré en fin de transaction — ignore */
    }
  }
}
