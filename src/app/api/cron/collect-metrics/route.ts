import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  collectMetrics,
  yesterdayUTC,
  type MetricsProvider,
} from "@/lib/email-metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  provider: z.enum(["resend", "brevo", "all"]).optional().default("all"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis.")
    .optional(),
});

/**
 * GET /api/cron/collect-metrics — collecte les métriques Resend/Brevo
 * (cron-job.org, 1×/jour). Même logique que `npm run collect:metrics`.
 * Défaut : jour précédent (UTC), tous les providers.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "collecte non configurée (CRON_SECRET manquant)" },
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

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    provider: searchParams.get("provider") ?? undefined,
    date: searchParams.get("date") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const date = parsed.data.date
    ? new Date(`${parsed.data.date}T00:00:00.000Z`)
    : yesterdayUTC();
  const provider = parsed.data.provider as MetricsProvider;

  try {
    const result = await collectMetrics(date, provider);

    try {
      await db.analyticsEvent.create({
        data: {
          type: "cron_collect_metrics",
          ref: `date=${date.toISOString().split("T")[0]} provider=${provider}`,
        },
      });
    } catch {
      /* ignore */
    }

    const ok = Object.values(result).every((r) => r.ok);
    return NextResponse.json({ ok, date: date.toISOString().split("T")[0], result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "erreur inconnue" },
      { status: 500 },
    );
  }
}
