import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import {
  collectMetrics,
  yesterdayUTC,
  type MetricsProvider,
} from "@/lib/email-metrics";
import { AppError, AuthError, ValidationError, errorToResponse } from "@/lib/errors";

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

/** Clé fixe de sérialisation des runs de ce cron (verrou consultatif Postgres). */
const ADVISORY_LOCK_KEY = 123459;

export async function GET(req: NextRequest) {
  try {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    throw new AuthError("collecte non configurée (CRON_SECRET manquant)", "UNAUTHORIZED");
  }
  if (!isCronAuthed(req)) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    provider: searchParams.get("provider") ?? undefined,
    date: searchParams.get("date") ?? undefined,
  });
  if (!parsed.success) {
    throw new ValidationError("Paramètres invalides.", parsed.error.flatten());
  }

  const date = parsed.data.date
    ? new Date(`${parsed.data.date}T00:00:00.000Z`)
    : yesterdayUTC();
  const provider = parsed.data.provider as MetricsProvider;

  // ── Sérialise les runs qui se chevauchent (même pattern que event-reminders)
  // pg_advisory_xact_lock est libéré automatiquement en fin de transaction,
  // y compris sur erreur. Le try/finally garantit le nettoyage best-effort
  // restant (unlock explicite = no-op si déjà libéré).
  await db.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`,
  );
  try {
    const result = await collectMetrics(date, provider);

    try {
      await withPrismaRetry(() =>
        db.analyticsEvent.create({
          data: {
            type: "cron_collect_metrics",
            ref: `date=${date.toISOString().split("T")[0]} provider=${provider}`,
          },
        }),
      );
    } catch {
      /* ignore */
    }

    const ok = Object.values(result).every((r) => r.ok);
    return NextResponse.json({ ok, date: date.toISOString().split("T")[0], result });
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : "erreur inconnue", {
      status: 500,
      code: "INTERNAL_ERROR",
    });
  } finally {
    try {
      await db.$executeRawUnsafe(
        `SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`,
      );
    } catch {
      /* déjà libéré en fin de transaction — ignore */
    }
  }
  } catch (err) {
    return errorToResponse(err);
  }
}
