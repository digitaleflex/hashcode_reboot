import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import { sendEngagementEmail } from "@/lib/email/builders";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";
import { planBatch } from "@/lib/email-budget";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Délai minimum après invitation avant relance d'engagement (3 jours). */
const ENGAGEMENT_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

/** Clé fixe de sérialisation des runs de ce cron. */
const ADVISORY_LOCK_KEY = 123462;

/** GET /api/cron/engagement-relance — relance les invités qui n'ont pas rejoint la communauté. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "engagement-relance non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await db.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - ENGAGEMENT_DELAY_MS);

    const candidates = await withPrismaRetry(() =>
      db.member.findMany({
        where: {
          deletedAt: null,
          invitationStatus: "INVITED",
          communityStatus: { not: "JOINED" },
          invitedAt: { lte: cutoff },
          profileStatus: { not: "REFUSED" as never },
        },
        take: 50,
        orderBy: { invitedAt: "asc" },
        select: { id: true, email: true, firstName: true, invitationStatus: true },
      }),
    );

    // Exclure les membres blacklistés.
    const blacklisted = await withPrismaRetry(() =>
      db.memberBlacklist.findMany({
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { email: true },
      }),
    );
    const blacklistSet = new Set(blacklisted.map((b) => b.email.toLowerCase()));
    const eligible = candidates.filter((m) => !blacklistSet.has(m.email.toLowerCase()));

    // Anti-doublon : membres déjà relancés pour l'engagement.
    const logged = await withPrismaRetry(() =>
      memberIdsWithEmailLog(
        eligible.map((m) => m.id),
        "engagement",
      ),
    );
    const targets = eligible.filter((m) => !logged.has(m.id));

    const plan = await planBatch({ category: "marketing", requested: targets.length });
    const toSend = targets.slice(0, plan.allowed);

    let sent = 0;
    let errors = 0;

    for (let i = 0; i < toSend.length; i += plan.batchSize || 10) {
      const chunk = toSend.slice(i, i + (plan.batchSize || 10));
      const results = await Promise.allSettled(
        chunk.map(async (member) => {
          const res = await sendEngagementEmail({
            to: member.email,
            firstName: member.firstName || "toi",
          });
          if (res.ok) {
            sent += 1;
            await logMemberEmail({
              memberId: member.id,
              email: member.email,
              kind: "engagement",
              provider: res.provider,
              providerId: res.id,
              status: "sent",
            });
          } else {
            errors += 1;
            await logMemberEmail({
              memberId: member.id,
              email: member.email,
              kind: "engagement",
              status: "failed",
            });
          }
          return res;
        }),
      );
      for (const r of results) {
        if (r.status === "rejected") errors += 1;
      }
      if (i + (plan.batchSize || 10) < toSend.length) {
        await new Promise((r) => setTimeout(r, plan.delayMs || 200));
      }
    }

    try {
      await db.analyticsEvent.create({
        data: toServerEventData({
          type: "cron_engagement_relance",
          ref: `sent=${sent} errors=${errors} deferred=${targets.length - toSend.length}`,
          value: sent,
        }),
      });
    } catch {
      /* best-effort */
    }

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      targets: targets.length,
      sent,
      errors,
      deferred: targets.length - toSend.length,
      budget: { provider: plan.provider, level: plan.level },
    });
  } catch (err) {
    console.error("[cron/engagement-relance] error", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}