import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runAlertCheck } from "@/lib/email-alerts";
import { AppError, AuthError, errorToResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/email-alerts — vérifie les seuils de délivrabilité
 * (bounce, plainte, livraison, ouverture, clic) et notifie si besoin.
 * À appeler 1×/jour après le collecteur de métriques (cron-job.org).
 * Notifications via ALERT_EMAILS et/ou ALERT_SLACK_WEBHOOK.
 */
export async function GET(req: NextRequest) {
  try {
  if (!process.env.CRON_SECRET) {
    // D26 — même 401 que `cron/collect-metrics`, seul `ok: false` disparaît.
    throw new AuthError(
      "alertes non configuré (CRON_SECRET manquant)",
      "UNAUTHORIZED",
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
  }
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(a, b)) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
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
    // D26 — le 500 garde le message de l'erreur (utile en diagnostic cron).
    throw new AppError(err instanceof Error ? err.message : "erreur inconnue", {
      status: 500,
      code: "INTERNAL_ERROR",
    });
  }
  } catch (err) {
    return errorToResponse(err);
  }
}
