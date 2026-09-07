import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const draftSchema = z.object({
  email: z.string().email().max(200),
  answers: z.unknown(),
  lastQuestionId: z.string().max(80).optional(),
});

/**
 * POST /api/profiling/draft — save partial profiling answers on abandon.
 * Enables the relance cron to re-engage users who left mid-flow.
 * Idempotent upsert per email.
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`draft:${rateKey(req)}`, {
    capacity: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }

  const { email, answers, lastQuestionId } = parsed.data;
  const emailLower = email.trim().toLowerCase();

  const firstName =
    typeof answers === "object" && answers !== null && "firstName" in answers
      ? String((answers as Record<string, unknown>).firstName)
      : "";

  try {
    await db.profilingDraft.upsert({
      where: { email: emailLower },
      update: {
        answers: JSON.stringify(answers ?? {}),
        ...(lastQuestionId ? { lastQuestionId } : {}),
        updatedAt: new Date(),
      },
      create: {
        email: emailLower,
        answers: JSON.stringify(answers ?? {}),
        lastQuestionId: lastQuestionId ?? null,
        firstName: firstName.slice(0, 40),
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}