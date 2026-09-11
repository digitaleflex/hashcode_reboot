import { db } from "@/lib/db";

/**
 * Collecte des métriques de délivrabilité (Resend + Brevo).
 * Utilisé par le script `scripts/collect-email-metrics.ts` ET la route
 * `GET /api/cron/collect-metrics` (cron-job.org ne peut appeler que du HTTP).
 */

export interface ProviderMetrics {
  provider: "resend" | "brevo";
  date: Date;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  opened: number;
  clicked: number;
  uniqueOpened: number;
  uniqueClicked: number;
  hardBounce: number;
  softBounce: number;
  deliveryRate?: number | null;
  openRate?: number | null;
  clickRate?: number | null;
  bounceRate?: number | null;
  complaintRate?: number | null;
}

interface ResendMetricsResponse {
  data: Array<{
    period: string;
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    opened: number;
    clicked: number;
    unique_opened: number;
    unique_clicked: number;
  }> | null;
}

interface BrevoAggregatedReport {
  reports: Array<{
    date: string;
    requests: number;
    delivered: number;
    hard_bounces: number;
    soft_bounces: number;
    opens: number;
    clicks: number;
    unique_opens: number;
    unique_clicks: number;
    unsubscriptions: number;
    complaints: number;
  }>;
}

export function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function yesterdayUTC(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function computeRates(m: ProviderMetrics): ProviderMetrics {
  const delivered = m.delivered || 0;
  const sent = m.sent || 0;
  return {
    ...m,
    deliveryRate: sent > 0 ? delivered / sent : null,
    openRate: delivered > 0 ? m.uniqueOpened / delivered : null,
    clickRate: delivered > 0 ? m.uniqueClicked / delivered : null,
    bounceRate: sent > 0 ? m.bounced / sent : null,
    complaintRate: delivered > 0 ? m.complained / delivered : null,
  };
}

export async function upsertMetric(metrics: ProviderMetrics): Promise<ProviderMetrics> {
  const withRates = computeRates(metrics);
  await db.emailProviderMetric.upsert({
    where: {
      provider_date: {
        provider: metrics.provider,
        date: metrics.date,
      },
    },
    update: {
      sent: withRates.sent,
      delivered: withRates.delivered,
      bounced: withRates.bounced,
      complained: withRates.complained,
      unsubscribed: withRates.unsubscribed,
      opened: withRates.opened,
      clicked: withRates.clicked,
      uniqueOpened: withRates.uniqueOpened,
      uniqueClicked: withRates.uniqueClicked,
      hardBounce: withRates.hardBounce,
      softBounce: withRates.softBounce,
      deliveryRate: withRates.deliveryRate,
      openRate: withRates.openRate,
      clickRate: withRates.clickRate,
      bounceRate: withRates.bounceRate,
      complaintRate: withRates.complaintRate,
    },
    create: {
      provider: withRates.provider,
      date: withRates.date,
      sent: withRates.sent,
      delivered: withRates.delivered,
      bounced: withRates.bounced,
      complained: withRates.complained,
      unsubscribed: withRates.unsubscribed,
      opened: withRates.opened,
      clicked: withRates.clicked,
      uniqueOpened: withRates.uniqueOpened,
      uniqueClicked: withRates.uniqueClicked,
      hardBounce: withRates.hardBounce,
      softBounce: withRates.softBounce,
      deliveryRate: withRates.deliveryRate,
      openRate: withRates.openRate,
      clickRate: withRates.clickRate,
      bounceRate: withRates.bounceRate,
      complaintRate: withRates.complaintRate,
    },
  });
  return withRates;
}

export async function collectResend(date: Date): Promise<ProviderMetrics> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  const dateStr = formatDateForApi(date);
  const response = await fetch(
    `https://api.resend.com/metrics?start_date=${dateStr}&end_date=${dateStr}&dimensions=period`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error (${response.status}): ${error}`);
  }
  const data = (await response.json()) as ResendMetricsResponse;
  const periods = data.data || [];
  const totals = periods.reduce(
    (acc, period) => ({
      sent: acc.sent + (period.sent || 0),
      delivered: acc.delivered + (period.delivered || 0),
      bounced: acc.bounced + (period.bounced || 0),
      complained: acc.complained + (period.complained || 0),
      unsubscribed: acc.unsubscribed + (period.unsubscribed || 0),
      opened: acc.opened + (period.opened || 0),
      clicked: acc.clicked + (period.clicked || 0),
      uniqueOpened: acc.uniqueOpened + (period.unique_opened || 0),
      uniqueClicked: acc.uniqueClicked + (period.unique_clicked || 0),
    }),
    {
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      opened: 0,
      clicked: 0,
      uniqueOpened: 0,
      uniqueClicked: 0,
    },
  );
  return { provider: "resend", date, ...totals, hardBounce: 0, softBounce: 0 };
}

export async function collectBrevo(date: Date): Promise<ProviderMetrics> {
  const apiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");
  const dateStr = formatDateForApi(date);
  const response = await fetch(
    `https://api.brevo.com/v3/statistics/aggregatedReport?startDate=${dateStr}&endDate=${dateStr}`,
    {
      headers: { "api-key": apiKey, Accept: "application/json" },
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${error}`);
  }
  const data = (await response.json()) as BrevoAggregatedReport;
  const report = data.reports?.[0];
  if (!report) {
    return {
      provider: "brevo",
      date,
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      opened: 0,
      clicked: 0,
      uniqueOpened: 0,
      uniqueClicked: 0,
      hardBounce: 0,
      softBounce: 0,
    };
  }
  return {
    provider: "brevo",
    date,
    sent: report.requests || 0,
    delivered: report.delivered || 0,
    bounced: (report.hard_bounces || 0) + (report.soft_bounces || 0),
    complained: report.complaints || 0,
    unsubscribed: report.unsubscriptions || 0,
    opened: report.opens || 0,
    clicked: report.clicks || 0,
    uniqueOpened: report.unique_opens || 0,
    uniqueClicked: report.unique_clicks || 0,
    hardBounce: report.hard_bounces || 0,
    softBounce: report.soft_bounces || 0,
  };
}

export type MetricsProvider = "resend" | "brevo" | "all";

/** Collecte + upsert pour un jour et un provider. Retourne le résumé par provider. */
export async function collectMetrics(
  date: Date,
  provider: MetricsProvider,
): Promise<Record<string, { ok: boolean; error?: string }>> {
  const result: Record<string, { ok: boolean; error?: string }> = {};
  if (provider === "resend" || provider === "all") {
    if (process.env.RESEND_API_KEY) {
      try {
        await upsertMetric(await collectResend(date));
        result.resend = { ok: true };
      } catch (err) {
        result.resend = {
          ok: false,
          error: err instanceof Error ? err.message : "erreur inconnue",
        };
      }
    }
  }
  if (provider === "brevo" || provider === "all") {
    const key = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
    if (key) {
      try {
        await upsertMetric(await collectBrevo(date));
        result.brevo = { ok: true };
      } catch (err) {
        result.brevo = {
          ok: false,
          error: err instanceof Error ? err.message : "erreur inconnue",
        };
      }
    }
  }
  return result;
}
