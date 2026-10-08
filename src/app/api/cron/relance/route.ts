import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import { sendRelanceEmail } from "@/lib/email/builders";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";
import { planBatch } from "@/lib/email-budget";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Délais des relances en milliseconds
const RELANCE_7_JOURS_MS = 7 * 24 * 60 * 60 * 1000;
const RELANCE_15_JOURS_MS = 15 * 24 * 60 * 60 * 1000;
const RELANCE_30_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

/** Clé fixe de sérialisation des runs de ce cron (verrou consultatif Postgres). */
const ADVISORY_LOCK_KEY = 123457;

/** GET /api/cron/relance — envoie les relances aux profils abandonnés (cron-job.org). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "relance non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // ── Sérialise les runs qui se chevauchent (même pattern que event-reminders)
  // pg_advisory_xact_lock est libéré automatiquement en fin de transaction,
  // y compris sur erreur. Le try/finally garantit le nettoyage best-effort
  // restant (unlock explicite = no-op si déjà libéré).
  await db.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`,
  );
  try {
    const now = new Date();
    const relanceCutoff = new Date(now.getTime() - RELANCE_7_JOURS_MS);

    // J+7 éligibles filtrés en base : les plus anciens d'abord (batch).
    // Avant : take 50 sur tous les brouillons puis filtre JS → les vieux
    // au-delà de 50 n'étaient jamais relancés quand le backlog grossissait.
    // Perf-7 : retry auto sur erreurs transient (pool épuisé, timeout).
    const drafts = await withPrismaRetry(() =>
      db.profilingDraft.findMany({
        where: {
          completedAt: null,
          email: { not: "" },
          relanceSentAt: null,
          createdAt: { lte: relanceCutoff },
        },
        take: 50,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          answers: true,
          lastQuestionId: true,
          createdAt: true,
          relanceSentAt: true,
        },
      }),
    );

    // J+7 : envois réels (reprise du profil). J+15/J+30 : estimations.
    // Déjà filtré en base (createdAt <= J-7, relanceSentAt NULL).
    const targets7 = drafts;

    // Anti-doublon : membres déjà relancés (log d'envoi).
    const memberByEmail = new Map(
      (
        await withPrismaRetry(() =>
          db.member.findMany({
            where: { email: { in: targets7.map((d) => d.email.toLowerCase()) } },
            select: { id: true, email: true, firstName: true },
          }),
        )
      ).map((m) => [m.email.toLowerCase(), m]),
    );
    const loggedRelance = await withPrismaRetry(() =>
      memberIdsWithEmailLog(
        [...memberByEmail.values()].map((m) => m.id),
        "relance",
      ),
    );

    let sent7 = 0;
    let errors = 0;
    const sentIds7: string[] = [];

    // Garde-fou : limiter les envois au budget restant.
    const plan = await planBatch({ category: "marketing", requested: targets7.length });
    const toSend7 = targets7.slice(0, plan.allowed);

    for (let i = 0; i < toSend7.length; i += plan.batchSize || 10) {
      const chunk = toSend7.slice(i, i + (plan.batchSize || 10));
      const results = await Promise.allSettled(
        chunk.map(async (draft) => {
          let firstName = draft.firstName ?? "";
          try {
            const answers = JSON.parse(draft.answers) as Record<string, unknown>;
            if (!firstName && typeof answers.firstName === "string") {
              firstName = answers.firstName;
            }
          } catch {
            /* ignore */
          }
          const member = memberByEmail.get(draft.email.toLowerCase());
          if (member && loggedRelance.has(member.id)) {
            return { id: draft.id, ok: true, skipped: true as const };
          }
          const res = await sendRelanceEmail({
            to: draft.email,
            firstName,
            lastQuestionId: draft.lastQuestionId ?? undefined,
            forceProvider: plan.provider,
          });
          if (res.ok && member) {
            await logMemberEmail({
              memberId: member.id,
              email: draft.email,
              kind: "relance",
              provider: res.provider,
              providerId: res.id,
            });
          }
          return { id: draft.id, ok: res.ok, skipped: false as const };
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.ok) {
          sent7 += 1;
          if (!r.value.skipped) sentIds7.push(r.value.id);
        } else {
          errors += 1;
        }
      }
    }

    let sent15 = 0;
    let sent30 = 0;

    for (const draft of drafts) {
      const ageMs = now.getTime() - draft.createdAt.getTime();

      // J+15 / J+30 : estimations (aucun envoi supplémentaire pour l'instant).
      if (ageMs >= RELANCE_15_JOURS_MS && ageMs < RELANCE_30_JOURS_MS) {
        sent15 += 1;
      }
      if (ageMs >= RELANCE_30_JOURS_MS) {
        sent30 += 1;
      }
    }

    if (sentIds7.length) {
      await withPrismaRetry(() =>
        db.profilingDraft.updateMany({
          where: { id: { in: sentIds7 } },
          data: { relanceSentAt: new Date() },
        }),
      );
    }

    // Heartbeat : dernier passage visible au dashboard.
    try {
      await withPrismaRetry(() =>
        db.analyticsEvent.create({
          data: {
            type: "cron_relance",
            ref: `sent7=${sent7} errors=${errors} scanned=${drafts.length}`,
            value: sent7,
          },
        }),
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ok: true,
      sent7,
      sent15,
      sent30,
      errors,
      scanned: drafts.length,
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