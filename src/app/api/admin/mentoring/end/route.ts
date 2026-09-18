import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { audit } from "@/lib/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const endSchema = z.object({ mentorshipId: z.string().min(1) });

/**
 * POST /api/admin/mentoring/end — termine un suivi (ACTIVE/PAUSED → ENDED).
 *
 * Idempotent : un suivi déjà ENDED est retourné tel quel.
 *
 * AUTH : admin operator. Garde TESTING active (écriture).
 */
export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

  const rl = await rateLimit(`admin-mentoring-end:${rateKey(req)}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "mentorshipId requis.", code: "INVALID" },
      { status: 422 },
    );
  }

  const existing = await db.mentorship.findUnique({
    where: { id: parsed.data.mentorshipId },
    select: { id: true, status: true, endedAt: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Suivi introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }
  if (existing.status === "ENDED") {
    return NextResponse.json({ ok: true, mentorship: existing });
  }

  const mentorship = await db.mentorship.update({
    where: { id: existing.id },
    data: { status: "ENDED", endedAt: new Date() },
    select: { id: true, status: true, endedAt: true },
  });

  await audit("mentoring.end", "mentorship", mentorship.id, {});
  return NextResponse.json({ ok: true, mentorship });
}
