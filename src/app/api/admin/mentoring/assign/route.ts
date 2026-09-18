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

const assignSchema = z.object({
  mentorId: z.string().min(1),
  menteeId: z.string().min(1),
  frequency: z.enum(["weekly", "biweekly", "monthly"]).default("monthly"),
});

/**
 * POST /api/admin/mentoring/assign — assigne un mentor à un mentoré.
 *
 * Crée un Mentorship ACTIVE (409 si la paire est déjà suivie ou si
 * mentoré === mentor). 404 si l'un des deux est introuvable/supprimé.
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

  const rl = await rateLimit(`admin-mentoring-assign:${rateKey(req)}`, {
    capacity: 30,
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
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "mentorId, menteeId et frequency (weekly|biweekly|monthly) requis.", code: "INVALID" },
      { status: 422 },
    );
  }
  const { mentorId, menteeId, frequency } = parsed.data;

  if (mentorId === menteeId) {
    return NextResponse.json(
      { error: "Le mentor et le mentoré doivent être différents.", code: "INVALID" },
      { status: 422 },
    );
  }

  const [mentor, mentee] = await Promise.all([
    db.member.findUnique({ where: { id: mentorId }, select: { id: true, deletedAt: true } }),
    db.member.findUnique({ where: { id: menteeId }, select: { id: true, deletedAt: true } }),
  ]);
  if (!mentor || mentor.deletedAt || !mentee || mentee.deletedAt) {
    return NextResponse.json(
      { error: "Mentor ou mentoré introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const existing = await db.mentorship.findFirst({
    where: { mentorId, menteeId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ce suivi existe déjà.", code: "CONFLICT", mentorshipId: existing.id },
      { status: 409 },
    );
  }

  const mentorship = await db.mentorship.create({
    data: { mentorId, menteeId, frequency, status: "ACTIVE" },
    select: { id: true, status: true, frequency: true, startedAt: true },
  });

  await audit("mentoring.assign", "mentorship", mentorship.id, { mentorId, menteeId, frequency });
  return NextResponse.json({ ok: true, mentorship }, { status: 201 });
}
