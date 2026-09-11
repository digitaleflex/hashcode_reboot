import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRelanceEmail } from "@/lib/mail";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Délais des relances en milliseconds
const RELANCE_7_JOURS_MS = 7 * 24 * 60 * 60 * 1000;
const RELANCE_15_JOURS_MS = 15 * 24 * 60 * 60 * 1000;
const RELANCE_30_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

/** GET /api/cron/relance — envoie les relances aux profils abandonnés (cron-job.org). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "relance non configuré (CRON_SECRET manquant)" },
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

  try {
    const now = new Date();

    const drafts = await db.profilingDraft.findMany({
      where: {
        completedAt: null,
        email: { not: "" },
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
    });

    // J+7 : envois réels (reprise du profil). J+15/J+30 : estimations.
    const targets7 = drafts.filter((d) => {
      const ageMs = now.getTime() - d.createdAt.getTime();
      return ageMs >= RELANCE_7_JOURS_MS && !d.relanceSentAt;
    });

    // Anti-doublon : membres déjà relancés (log d'envoi).
    const memberByEmail = new Map(
      (
        await db.member.findMany({
          where: { email: { in: targets7.map((d) => d.email.toLowerCase()) } },
          select: { id: true, email: true, firstName: true },
        })
      ).map((m) => [m.email.toLowerCase(), m]),
    );
    const loggedRelance = await memberIdsWithEmailLog(
      [...memberByEmail.values()].map((m) => m.id),
      "relance",
    );

    let sent7 = 0;
    let errors = 0;
    const sentIds7: string[] = [];

    for (let i = 0; i < targets7.length; i += 10) {
      const chunk = targets7.slice(i, i + 10);
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
      await db.profilingDraft.updateMany({
        where: { id: { in: sentIds7 } },
        data: { relanceSentAt: new Date() },
      });
    }

    // Heartbeat : dernier passage visible au dashboard.
    try {
      await db.analyticsEvent.create({
        data: {
          type: "cron_relance",
          ref: `sent7=${sent7} errors=${errors} scanned=${drafts.length}`,
          value: sent7,
        },
      });
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
  }
}