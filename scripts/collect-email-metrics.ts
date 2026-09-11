#!/usr/bin/env node
/**
 * Email Deliverability Metrics Collector
 * 
 * Collects daily metrics from Resend and Brevo APIs and stores them in the database.
 * Run daily via cron (e.g., 02:00 UTC) to capture previous day's data.
 * 
 * Usage:
 *   node scripts/collect-email-metrics.js [--date=YYYY-MM-DD] [--provider=resend|brevo|all]
 * 
 * Environment variables required:
 *   - RESEND_API_KEY
 *   - BREVO_API_KEY (or SENDINBLUE_API_KEY)
 *   - POSTGRES_PRISMA_URL (or DATABASE_URL)
 */

import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

const prisma = new PrismaClient();

// ─── Configuration ────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;

if (!RESEND_API_KEY && !BREVO_API_KEY) {
  console.error('❌ No API keys configured. Set RESEND_API_KEY and/or BREVO_API_KEY');
  process.exit(1);
}

// ─── Types ────────────────────────────────────────────────────────────────

interface ProviderMetrics {
  provider: 'resend' | 'brevo';
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
  // Computed rates (optional, added by computeRates)
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

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseDateArg(): Date {
  const args = process.argv.slice(2);
  const dateArg = args.find(a => a.startsWith('--date='));
  if (dateArg) {
    const dateStr = dateArg.split('=')[1];
    const d = new Date(dateStr + 'T00:00:00.000Z');
    if (isNaN(d.getTime())) {
      console.error(`❌ Invalid date format: ${dateStr}. Use YYYY-MM-DD`);
      process.exit(1);
    }
    return d;
  }
  // Default: yesterday UTC
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  return yesterday;
}

function getProviderArg(): 'resend' | 'brevo' | 'all' {
  const args = process.argv.slice(2);
  const providerArg = args.find(a => a.startsWith('--provider='));
  if (providerArg) {
    const p = providerArg.split('=')[1];
    if (['resend', 'brevo', 'all'].includes(p)) return p as 'resend' | 'brevo' | 'all';
    console.error(`❌ Invalid provider: ${p}. Use resend, brevo, or all`);
    process.exit(1);
  }
  return 'all';
}

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
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

async function upsertMetric(metrics: ProviderMetrics) {
  const withRates = computeRates(metrics);
  
  await prisma.emailProviderMetric.upsert({
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
  
  console.log(`✅ ${metrics.provider.toUpperCase()} ${formatDateForApi(metrics.date)}: ` +
    `sent=${metrics.sent} delivered=${metrics.delivered} ` +
    `openRate=${(withRates.openRate ? withRates.openRate * 100 : 0).toFixed(1)}% ` +
    `clickRate=${(withRates.clickRate ? withRates.clickRate * 100 : 0).toFixed(1)}% ` +
    `bounceRate=${(withRates.bounceRate ? withRates.bounceRate * 100 : 0).toFixed(2)}%`);
}

// ─── Resend Collector ─────────────────────────────────────────────────────

async function collectResend(date: Date): Promise<ProviderMetrics> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  
  const resend = new Resend(RESEND_API_KEY);
  const dateStr = formatDateForApi(date);
  
  console.log(`📥 Fetching Resend metrics for ${dateStr}...`);
  
  // Resend API: get metrics with period dimension
  const response = await fetch(
    `https://api.resend.com/metrics?start_date=${dateStr}&end_date=${dateStr}&dimensions=period`,
    {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error (${response.status}): ${error}`);
  }
  
  const data: ResendMetricsResponse = await response.json();
  
  // Aggregate all periods (should be just one for a single day)
  const periods = data.data || [];
  const totals = periods.reduce((acc, period) => ({
    sent: acc.sent + (period.sent || 0),
    delivered: acc.delivered + (period.delivered || 0),
    bounced: acc.bounced + (period.bounced || 0),
    complained: acc.complained + (period.complained || 0),
    unsubscribed: acc.unsubscribed + (period.unsubscribed || 0),
    opened: acc.opened + (period.opened || 0),
    clicked: acc.clicked + (period.clicked || 0),
    uniqueOpened: acc.uniqueOpened + (period.unique_opened || 0),
    uniqueClicked: acc.uniqueClicked + (period.unique_clicked || 0),
  }), {
    sent: 0, delivered: 0, bounced: 0, complained: 0,
    unsubscribed: 0, opened: 0, clicked: 0,
    uniqueOpened: 0, uniqueClicked: 0,
  });
  
  // Resend doesn't distinguish hard/soft bounces in metrics API
  // We'll estimate from EmailEvent webhook data if needed
  return {
    provider: 'resend',
    date,
    ...totals,
    hardBounce: 0,
    softBounce: 0,
  };
}

// ─── Brevo Collector ──────────────────────────────────────────────────────

async function collectBrevo(date: Date): Promise<ProviderMetrics> {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY not configured');
  }
  
  const dateStr = formatDateForApi(date);
  
  console.log(`📥 Fetching Brevo metrics for ${dateStr}...`);
  
  // Brevo API v3: Get aggregated report
  const response = await fetch(
    `https://api.brevo.com/v3/statistics/aggregatedReport?startDate=${dateStr}&endDate=${dateStr}`,
    {
      headers: {
        'api-key': BREVO_API_KEY,
        'Accept': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${error}`);
  }
  
  const data: BrevoAggregatedReport = await response.json();
  
  // Brevo returns array of daily reports
  const report = data.reports?.[0];
  if (!report) {
    console.log(`⚠️  No Brevo data for ${dateStr}`);
    return {
      provider: 'brevo',
      date,
      sent: 0, delivered: 0, bounced: 0, complained: 0,
      unsubscribed: 0, opened: 0, clicked: 0,
      uniqueOpened: 0, uniqueClicked: 0,
      hardBounce: 0, softBounce: 0,
    };
  }
  
  return {
    provider: 'brevo',
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

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const date = parseDateArg();
  const provider = getProviderArg();
  
  console.log(`🚀 Starting metrics collection for ${formatDateForApi(date)} (provider: ${provider})`);
  
  try {
    if (provider === 'resend' || provider === 'all') {
      if (RESEND_API_KEY) {
        try {
          const metrics = await collectResend(date);
          await upsertMetric(metrics);
        } catch (err) {
          console.error(`❌ Resend collection failed:`, err);
        }
      } else {
        console.log('⏭️  Skipping Resend (no API key)');
      }
    }
    
    if (provider === 'brevo' || provider === 'all') {
      if (BREVO_API_KEY) {
        try {
          const metrics = await collectBrevo(date);
          await upsertMetric(metrics);
        } catch (err) {
          console.error(`❌ Brevo collection failed:`, err);
        }
      } else {
        console.log('⏭️  Skipping Brevo (no API key)');
      }
    }
    
    console.log('✨ Collection complete');

    // Heartbeat : dernier passage visible au dashboard (santé des crons).
    try {
      await prisma.analyticsEvent.create({
        data: {
          type: 'cron_collect_metrics',
          ref: `date=${formatDateForApi(date)} provider=${provider}`,
        },
      });
    } catch {
      /* best-effort */
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});