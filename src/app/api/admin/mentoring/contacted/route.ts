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

  const rl = await rateLimit(`admin-mentoring-contacted:${rateKey(req)}`, {
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
  const parsed = contactedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "memberId requis.", code: "INVALID" },
      { status: 422 },
    );
  }

  const member = await db.member.findUnique({
    where: { id: parsed.data.memberId },
    select: { id: true, deletedAt: true },
  });
  if (!member || member.deletedAt) {
    return NextResponse.json(
      { error: "Membre introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const updated = await db.member.update({
    where: { id: member.id },
    data: { mentorContactedAt: new Date() },
    select: { id: true, mentorContactedAt: true },
  });

  await audit("mentoring.contacted", "member", member.id, {});
  return NextResponse.json({ ok: true, member: updated });
}
