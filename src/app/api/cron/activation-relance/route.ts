import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import { sendActivationRelanceEmail } from "@/lib/email/builders";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";
import { planBatch } from "@/lib/email-budget";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Membres approuvés depuis 7+ jours sans aucun challenge.
const ACTIVATION_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000;

/** Clé fixe de sérialisation des runs de ce cron (verrou consultatif Postgres). */
const ADVISORY_LOCK_KEY = 123460;

/** GET /api/cron/activation-relance — relance les approuvés sans premier challenge (J+7). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "activation-relance non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // ── Sérialise les runs qui se chevauchent (même pattern que relance)
  // pg_advisory_xact_lock est libéré automatiquement en fin de transaction,
  // y compris sur erreur. Le try/finally garantit le nettoyage best-effort
  // restant (unlock explicite = no-op si déjà libéré).
  await db.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`,
  );
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - ACTIVATION_CUTOFF_MS);
    const base =
      process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
    const challengeUrl = `${base}/dashboard/ateliers`;

    // J+7 éligibles filtrés en base : les plus anciens d'abord (batch).
    const candidates = await withPrismaRetry(() =>
      db.member.findMany({
        where: {
          profileStatus: "APPROVED",
          deletedAt: null,
          createdAt: { lte: cutoff },
          workshopSubmissions: { none: {} },
        },
        take: 50,
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, firstName: true },
      }),
    );

    // Anti-doublon : membres déjà relancés pour l'activation.
    const logged = await withPrismaRetry(() =>
      memberIdsWithEmailLog(
        candidates.map((m) => m.id),
        "activation_relance",
      ),
    );
    const targets = candidates.filter((m) => !logged.has(m.id));

    // Garde-fou : limiter les envois au budget restant.
    const plan = await planBatch({ category: "marketing", requested: targets.length });
    const toSend = targets.slice(0, plan.allowed);

    let sent = 0;
    let errors = 0;

    for (let i = 0; i < toSend.length; i += plan.batchSize || 10) {
      const chunk = toSend.slice(i, i + (plan.batchSize || 10));
      const results = await Promise.allSettled(
        chunk.map(async (member) => {
          const res = await sendActivationRelanceEmail({
            to: member.email,
            firstName: member.firstName ?? "",
            challengeUrl,
            forceProvider: plan.provider,
          });
          if (res.ok) {
            await logMemberEmail({
              memberId: member.id,
              email: member.email,
              kind: "activation_relance",
              provider: res.provider,
              providerId: res.id,
            });
          }
          return res.ok;
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          sent += 1;
        } else {
          errors += 1;
        }
      }
    }

    // Heartbeat : dernier passage visible au dashboard.
    try {
      await withPrismaRetry(() =>
        db.analyticsEvent.create({
          data: {
            type: "cron_activation_relance",
            ref: `sent=${sent} errors=${errors} scanned=${candidates.length}`,
            value: sent,
          },
        }),
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ok: true,
      sent,
      errors,
      scanned: candidates.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "erreur inconnue" },
      { status: 500 },
    );
  } finally {
    try {
      await db.$executeRawUnsafe(
        `SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`,
      );
    } catch {
      /* déjà libéré en fin de transaction — ignore */
    }
  }
}
