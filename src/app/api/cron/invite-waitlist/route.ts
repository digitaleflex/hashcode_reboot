import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import { sendRejoinEmail } from "@/lib/email/builders";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";
import { planBatch } from "@/lib/email-budget";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Clé fixe de sérialisation des runs de ce cron. */
const ADVISORY_LOCK_KEY = 123461;

/** GET /api/cron/invite-waitlist — invite les membres en attente (file d'attente). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "invite-waitlist non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await db.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`,
  );
  try {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_URL ||
      "https://reboot.joinhashcode.com";

    const candidates = await withPrismaRetry(() =>
      db.member.findMany({
        where: {
          deletedAt: null,
          profileStatus: "PENDING",
          invitationStatus: "NOT_INVITED",
        },
        take: 50,
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, firstName: true },
      }),
    );

    const logged = await withPrismaRetry(() =>
      memberIdsWithEmailLog(
        candidates.map((m) => m.id),
        "invite",
      ),
    );
    const targets = candidates.filter((m) => !logged.has(m.id));

    const plan = await planBatch({ category: "marketing", requested: targets.length });
    const toSend = targets.slice(0, plan.allowed);

    let sent = 0;
    let errors = 0;

    for (let i = 0; i < toSend.length; i += plan.batchSize || 10) {
      const chunk = toSend.slice(i, i + (plan.batchSize || 10));
      const results = await Promise.allSettled(
        chunk.map(async (member) => {
          const { requestSignInOtp } = await import("@/lib/auth");
          await requestSignInOtp(member.email);

          const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&next=${encodeURIComponent("/dashboard")}`;

          const res = await sendRejoinEmail({
            to: member.email,
            firstName: member.firstName || "toi",
            url,
            forceProvider: plan.provider,
          });

          if (res.ok) {
            sent += 1;
            await db.member.update({
              where: { id: member.id },
              data: { invitationStatus: "INVITED", invitedAt: new Date() },
            });
            await logMemberEmail({
              memberId: member.id,
              email: member.email,
              kind: "invite",
              provider: res.provider,
              providerId: res.id,
              status: "sent",
            });
          } else {
            errors += 1;
            await logMemberEmail({
              memberId: member.id,
              email: member.email,
              kind: "invite",
              status: "failed",
            });
          }
          return res;
        }),
      );
      // Compte les rejets inattendus.
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
          type: "cron_invite_waitlist",
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
    console.error("[cron/invite-waitlist] error", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}