

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { AuthError, ValidationError, errorToResponse } from "@/lib/errors";
import {
  DELIVERABILITY_PROVIDERS,
  providerChart,
  summarizeProvider,
  type ProviderMetricRow,
} from "@/lib/admin/aggregates";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

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
 *
 * D29 : les totaux, les taux et la comparaison 7 j / 7 j sont calculés par
 * `summarizeProvider()`, et la série du graphique par `providerChart()` — un
 * seul endroit pour ces formules. `summarizeProvider` reçoit `now` en
 * parametre (c'est ce qui la rend testable) : la route le fournit
 * explicitement, une fois pour toute la reponse, au lieu de laisser chaque
 * provider refaire son propre `new Date()`.
 *
 * Ce qui reste local et NON duplique : la surcharge `startDate` / `endDate`.
 * Elle impose une plage bornee, ce que `deliverabilityWindow(days, now)` ne
 * modelise pas (elle ne connait qu'une duree en jours) ; la fenetre par
 * defaut, elle, reste celle de la route.
 */
export async function GET(req: NextRequest) {
  try {
  if (!(await isAdminAuthed(req))) {
    // D26 — 401 + code `UNAUTHORIZED` conservés à l'identique.
    throw new AuthError('Non autorisé.', 'UNAUTHORIZED');
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    provider: searchParams.get('provider') ?? undefined,
    days: searchParams.get('days') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
  });

  if (!parsed.success) {
    // D26 — 422 + `details` identiques ; seul le `code` est ajouté.
    throw new ValidationError('Paramètres invalides.', parsed.error.flatten());
  }

  const { provider, days, startDate, endDate } = parsed.data;

  // Un seul « maintenant » pour la reponse entiere : il sert a la fois a la
  // fenetre et a la comparaison 7 j / 7 j de `summarizeProvider`.
  const now = new Date();

  // Build date range
  const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  
  const start = startDate 
    ? new Date(startDate + 'T00:00:00.000Z') 
    : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);

  const providers = provider === 'all' ? [...DELIVERABILITY_PROVIDERS] : [provider];

  // Fetch metrics for each provider
  const metricsByProvider: Record<string, ProviderMetricRow[]> = {};
  
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

  // Compute summary stats for the period (formule partagee).
  const summary = providers.map(p => summarizeProvider(p, metricsByProvider[p] || [], now));

  // Format chart data (serie temporelle partagee).
  const chartData = providers.map(p => providerChart(p, metricsByProvider[p] || []));

  return NextResponse.json({
    ok: true,
    dateRange: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
    summary,
    chartData,
  });
  } catch (err) {
    return errorToResponse(err);
  }
}