import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRelanceEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RELANCE_DELAY_MS = 24 * 60 * 60 * 1000; // 24h après le premier abandon

/** GET /api/cron/relance — envoie la relance aux profils abandonnés (cron-job.org). */
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
    const cutoff = new Date(Date.now() - RELANCE_DELAY_MS);
    const drafts = await db.profilingDraft.findMany({
      where: {
        completedAt: null,
        relanceSentAt: null,
        createdAt: { lte: cutoff },
        email: { not: "" },
      },
      take: 50,
      orderBy: { createdAt: "asc" },
    });

    let sent = 0;
    let errors = 0;

    for (const draft of drafts) {
      let firstName = draft.firstName ?? "";
      try {
        const answers = JSON.parse(draft.answers) as Record<string, unknown>;
        if (!firstName && typeof answers.firstName === "string") {
          firstName = answers.firstName;
        }
      } catch {
        /* ignore — answers json may be empty */
      }

      const res = await sendRelanceEmail({
        to: draft.email,
        firstName,
        lastQuestionId: draft.lastQuestionId ?? undefined,
      });

      if (res.ok) {
        await db.profilingDraft.update({
          where: { id: draft.id },
          data: { relanceSentAt: new Date() },
        });
        sent += 1;
      } else {
        errors += 1;
      }
    }

    return NextResponse.json({ ok: true, sent, errors, scanned: drafts.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "erreur inconnue" },
      { status: 500 },
    );
  }
}