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

const contactedSchema = z.object({ memberId: z.string().min(1) });

/**
 * POST /api/admin/mentoring/contacted — marque un lead comme contacté.
 *
 * Pose mentorContactedAt (idempotent : réécrit la date). L'UI affiche
 * « Contacté le … » et le bouton WhatsApp reste disponible.
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

  const rl = await rateLimit(`admin-mentoring-contacted:${rateKey(req)}`, {
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
  const parsed = contactedSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("memberId requis.", parsed.error.flatten());
  }

  const member = await db.member.findUnique({
    where: { id: parsed.data.memberId },
    select: { id: true, deletedAt: true },
  });
  if (!member || member.deletedAt) {
    throw new NotFoundError("Membre introuvable.");
  }

  const updated = await db.member.update({
    where: { id: member.id },
    data: { mentorContactedAt: new Date() },
    select: { id: true, mentorContactedAt: true },
  });

  await audit("mentoring.contacted", "member", member.id, {});
  return NextResponse.json({ ok: true, member: updated });
  } catch (err) {
    return errorToResponse(err);
  }
}
