import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { bodyLimit } from "@/lib/body-limit";
import { blockIfTesting } from "@/lib/test-guard";

export const runtime = "nodejs";

/** Borne réaliste : un brouillon de profiling tient en quelques Ko. */
const MAX_DRAFT_JSON_BYTES = 32 * 1024;
const MAX_DRAFT_KEYS = 60;

const draftAnswerValue = z.union([
  z.string().max(1000),
  z.array(z.string().max(200)).max(20),
  z.number(),
  z.boolean(),
  z.null(),
]);

const draftSchema = z.object({
  email: z.string().email().max(200),
  // F1 : answers était z.unknown() sans borne — n'importe quel JSON
  // arbitraire pouvait être stocké en base via cette route publique.
  // Le brouillon réel ne contient que des chaînes / tableaux de chaînes
  // (questions texte, email, pays, choix uniques/multiples).
  answers: z
    .record(z.string().max(80), draftAnswerValue)
    .refine(
      (o) => Object.keys(o).length <= MAX_DRAFT_KEYS,
      "Trop de réponses.",
    )
    .refine(
      (o) => JSON.stringify(o).length <= MAX_DRAFT_JSON_BYTES,
      "Brouillon trop volumineux.",
    ),
  lastQuestionId: z.string().max(80).optional(),
  // #210 p2 : rattachement du draft abandonné à son parcours.
  // Reçus du client (analytics.ts : getOrCreateSessionId / source persistée).
  // Optionnels : les anciens clients ne les envoient pas encore.
  sessionId: z.string().max(64).optional(),
  sourceUTM: z.string().trim().max(120).optional(),
});

/**
 * POST /api/profiling/draft — save partial profiling answers on abandon.
 * Enables the relance cron to re-engage users who left mid-flow.
 * Idempotent upsert per email.
 */
export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
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
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

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

  const { email, answers, lastQuestionId, sessionId, sourceUTM } = parsed.data;
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
        // Ne jamais écraser avec du vide : seuls les clients à jour envoient
        // sessionId/sourceUTM (les anciens beacons n'ont que email/answers).
        ...(sessionId ? { sessionId } : {}),
        ...(sourceUTM ? { sourceUTM } : {}),
        updatedAt: new Date(),
      },
      create: {
        email: emailLower,
        answers: JSON.stringify(answers ?? {}),
        lastQuestionId: lastQuestionId ?? null,
        sessionId: sessionId ?? null,
        sourceUTM: sourceUTM ?? null,
        firstName: firstName.slice(0, 40),
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
