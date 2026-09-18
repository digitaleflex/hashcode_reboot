import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAlertCheck } from "@/lib/email-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/email-alerts — vérifie les seuils de délivrabilité
 * (bounce, plainte, livraison, ouverture, clic) et notifie si besoin.
 * À appeler 1×/jour après le collecteur de métriques (cron-job.org).
 * Notifications via ALERT_EMAILS et/ou ALERT_SLACK_WEBHOOK.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "alertes non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await runAlertCheck();

    try {
      await db.analyticsEvent.create({
        data: {
          type: "cron_email_alerts",
          ref: `alerts=${result.alerts.length} critical=${result.hasCritical}`,
          value: result.alerts.length,
        },
      });
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
  }
}
