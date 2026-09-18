import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  type EmailBudget,
  getAllBudgets,
  recentThroughput,
  remainingBatches,
} from "@/lib/email-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  /** Taille de lot utilisée pour exprimer la capacité restante (« vagues »). */
  batchSize: z.coerce.number().int().min(1).max(1000).optional().default(48),
  /** Fenêtre du débit mesuré, en minutes. */
  minutes: z.coerce.number().int().min(5).max(1440).optional().default(60),
});

export interface EmailOpsAlert {
  level: "warn" | "critical";
  provider?: string;
  message: string;
}

/**
 * GET /api/admin/email-ops — supervision des envois en TEMPS RÉEL (admin-only).
 *
 * Complète /api/admin/email-deliverability, qui travaille sur des agrégats
 * JOURNALIERS collectés par cron (jusqu'à 24 h de retard) : ici, on lit les
 * envois réellement acceptés depuis 00:00 UTC, pour pouvoir agir avant de
 * dépasser un quota.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    batchSize: searchParams.get("batchSize") ?? undefined,
    minutes: searchParams.get("minutes") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { batchSize, minutes } = parsed.data;

  const { budgets, unattributed } = await getAllBudgets();

  const enriched = await Promise.all(
    budgets.map(async (b: EmailBudget) => ({
      ...b,
      // Combien de lots complets restent possibles aujourd'hui.
      remainingBatches: await remainingBatches(b.provider, batchSize),
    })),
  );

  const throughput = await recentThroughput(minutes);

  // Alertes lisibles : l'admin doit voir le problème sans interpréter un graphe.
  const alerts: EmailOpsAlert[] = [];
  for (const b of enriched) {
    if (b.level === "blocked") {
      alerts.push({
        level: "critical",
        provider: b.provider,
        message:
          `Quota ${b.provider} épuisé : ${b.used}/${b.cap} envois aujourd'hui. ` +
          `Les envois sont suspendus jusqu'à 00:00 UTC ; les destinataires non ` +
          `servis seront repris automatiquement.`,
      });
    } else if (b.level === "critical") {
      alerts.push({
        level: "critical",
        provider: b.provider,
        message:
          `Quota ${b.provider} presque épuisé : ${b.used}/${b.cap} ` +
          `(${Math.round(b.ratio * 100)} %). Les lots sont réduits à 1 envoi ` +
          `avec une pause d'1 s.`,
      });
    } else if (b.level === "warn") {
      alerts.push({
        level: "warn",
        provider: b.provider,
        message:
          `Quota ${b.provider} à ${Math.round(b.ratio * 100)} % ` +
          `(${b.used}/${b.cap}). Taille de lot réduite à 5 avec pause de 200 ms.`,
      });
    }
  }
  if (unattributed > 0) {
    alerts.push({
      level: "warn",
      message:
        `${unattributed} envoi(s) aujourd'hui sans provider identifié ` +
        `(lignes antérieures à l'ajout de la colonne). Ils ne sont pas comptés ` +
        `dans les quotas ci-dessus.`,
    });
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    providers: enriched,
    throughput: { minutes, sent: throughput },
    capacityBatchSize: batchSize,
    unattributed,
    alerts,
  });
}
