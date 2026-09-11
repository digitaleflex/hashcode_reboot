#!/usr/bin/env node
/**
 * Email Deliverability Metrics Collector (CLI)
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
 *
 * Note : la même logique est exposée en HTTP via GET /api/cron/collect-metrics
 * pour cron-job.org (qui ne peut appeler que des URLs).
 */

import { PrismaClient } from '@prisma/client';
import {
  collectMetrics,
  formatDateForApi,
  yesterdayUTC,
  type MetricsProvider,
} from '../src/lib/email-metrics';

const prisma = new PrismaClient();

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
  return yesterdayUTC();
}

function getProviderArg(): MetricsProvider {
  const args = process.argv.slice(2);
  const providerArg = args.find(a => a.startsWith('--provider='));
  if (providerArg) {
    const p = providerArg.split('=')[1];
    if (['resend', 'brevo', 'all'].includes(p)) return p as MetricsProvider;
    console.error(`❌ Invalid provider: ${p}. Use resend, brevo, or all`);
    process.exit(1);
  }
  return 'all';
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const date = parseDateArg();
  const provider = getProviderArg();

  if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY && !process.env.SENDINBLUE_API_KEY) {
    console.error('❌ No API keys configured. Set RESEND_API_KEY and/or BREVO_API_KEY');
    process.exit(1);
  }

  console.log(`🚀 Starting metrics collection for ${formatDateForApi(date)} (provider: ${provider})`);

  try {
    const result = await collectMetrics(date, provider);
    for (const [name, r] of Object.entries(result)) {
      if (r.ok) console.log(`✅ ${name.toUpperCase()} ${formatDateForApi(date)}: collected`);
      else console.error(`❌ ${name.toUpperCase()} collection failed:`, r.error);
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
