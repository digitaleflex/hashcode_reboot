import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAdminAuthed } from '@/lib/admin-auth';

export const runtime = 'nodejs';

const querySchema = z.object({
  provider: z.enum(['resend', 'brevo', 'all']).optional().default('all'),
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/admin/email-deliverability
 * 
 * Returns aggregated email deliverability metrics for dashboard.
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: 'Non autorisé.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    provider: searchParams.get('provider') ?? undefined,
    days: searchParams.get('days') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides.', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { provider, days, startDate, endDate } = parsed.data;

  // Build date range
  const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
  end.setUTCHours(23, 59, 59, 999);
  
  const start = startDate 
    ? new Date(startDate + 'T00:00:00.000Z') 
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);

  const providers = provider === 'all' ? ['resend', 'brevo'] : [provider];

  // Fetch metrics for each provider
  const metricsByProvider: Record<string, any[]> = {};
  
  for (const p of providers) {
    const metrics = await db.emailProviderMetric.findMany({
      where: {
        provider: p,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });
    metricsByProvider[p] = metrics;
  }

  // Compute summary stats for the period
  const summary = providers.map(p => {
    const metrics = metricsByProvider[p] || [];
    const totals = metrics.reduce((acc, m) => ({
      sent: acc.sent + m.sent,
      delivered: acc.delivered + m.delivered,
      bounced: acc.bounced + m.bounced,
      complained: acc.complained + m.complained,
      unsubscribed: acc.unsubscribed + m.unsubscribed,
      opened: acc.opened + m.opened,
      clicked: acc.clicked + m.clicked,
      uniqueOpened: acc.uniqueOpened + m.uniqueOpened,
      uniqueClicked: acc.uniqueClicked + m.uniqueClicked,
    }), {
      sent: 0, delivered: 0, bounced: 0, complained: 0,
      unsubscribed: 0, opened: 0, clicked: 0,
      uniqueOpened: 0, uniqueClicked: 0,
    });

    const deliveryRate = totals.sent > 0 ? totals.delivered / totals.sent : 0;
    const openRate = totals.delivered > 0 ? totals.uniqueOpened / totals.delivered : 0;
    const clickRate = totals.delivered > 0 ? totals.uniqueClicked / totals.delivered : 0;
    const bounceRate = totals.sent > 0 ? totals.bounced / totals.sent : 0;
    const complaintRate = totals.delivered > 0 ? totals.complained / totals.delivered : 0;

    // Last 7 days vs previous 7 days comparison
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const last7 = metrics.filter(m => m.date >= sevenDaysAgo);
    const prev7 = metrics.filter(m => m.date >= fourteenDaysAgo && m.date < sevenDaysAgo);

    const sumLast7 = last7.reduce((a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }), { sent: 0, delivered: 0 });
    const sumPrev7 = prev7.reduce((a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }), { sent: 0, delivered: 0 });

    const volumeChange = sumPrev7.sent > 0 ? (sumLast7.sent - sumPrev7.sent) / sumPrev7.sent : 0;
    const deliveryChange = sumPrev7.delivered > 0 && sumLast7.delivered > 0 
      ? (sumLast7.delivered / sumLast7.sent) - (sumPrev7.delivered / sumPrev7.sent)
      : 0;

    return {
      provider: p,
      totals,
      rates: {
        deliveryRate,
        openRate,
        clickRate,
        bounceRate,
        complaintRate,
      },
      comparison: {
        volumeChange,
        deliveryChange,
      },
      daysWithData: metrics.length,
    };
  });

  // Format chart data
  const chartData = providers.map(p => ({
    provider: p,
    data: metricsByProvider[p]?.map(m => ({
      date: m.date.toISOString().split('T')[0],
      sent: m.sent,
      delivered: m.delivered,
      bounced: m.bounced,
      opened: m.opened,
      clicked: m.clicked,
      uniqueOpened: m.uniqueOpened,
      uniqueClicked: m.uniqueClicked,
      deliveryRate: m.deliveryRate,
      openRate: m.openRate,
      clickRate: m.clickRate,
      bounceRate: m.bounceRate,
      complaintRate: m.complaintRate,
    })) || [],
  }));

  return NextResponse.json({
    ok: true,
    dateRange: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
    summary,
    chartData,
  });
}