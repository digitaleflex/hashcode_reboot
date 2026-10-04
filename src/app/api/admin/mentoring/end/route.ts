import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { audit } from "@/lib/admin-audit";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  errorToResponse,
} from "@/lib/errors";

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
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  if (!(await requireAdminRole(req, "operator"))) {
    throw new ForbiddenError("Accès refusé.");
  }
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

  const rl = await rateLimit(`admin-mentoring-end:${rateKey(req)}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("mentorshipId requis.", parsed.error.flatten());
  }

  const existing = await db.mentorship.findUnique({
    where: { id: parsed.data.mentorshipId },
    select: { id: true, status: true, endedAt: true },
  });
  if (!existing) {
    throw new NotFoundError("Suivi introuvable.");
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
  } catch (err) {
    return errorToResponse(err);
  }
}
