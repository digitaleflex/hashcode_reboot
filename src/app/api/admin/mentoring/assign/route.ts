import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { audit } from "@/lib/admin-audit";
import { ConflictError, NotFoundError, RateLimitError, ValidationError, errorToResponse } from "@/lib/errors";

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
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  await requireAdminOrThrow(req, "operator");
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;

  const rl = await rateLimit(`admin-mentoring-assign:${rateKey(req)}`, {
    capacity: 30,
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
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      "mentorId, menteeId et frequency (weekly|biweekly|monthly) requis.",
      parsed.error.flatten(),
    );
  }
  const { mentorId, menteeId, frequency } = parsed.data;

  if (mentorId === menteeId) {
    throw new ValidationError("Le mentor et le mentoré doivent être différents.");
  }

  const [mentor, mentee] = await Promise.all([
    db.member.findUnique({ where: { id: mentorId }, select: { id: true, deletedAt: true } }),
    db.member.findUnique({ where: { id: menteeId }, select: { id: true, deletedAt: true } }),
  ]);
  if (!mentor || mentor.deletedAt || !mentee || mentee.deletedAt) {
    throw new NotFoundError("Mentor ou mentoré introuvable.");
  }

  const existing = await db.mentorship.findFirst({
    where: { mentorId, menteeId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("Ce suivi existe déjà.");
  }

  const mentorship = await db.mentorship.create({
    data: { mentorId, menteeId, frequency, status: "ACTIVE" },
    select: { id: true, status: true, frequency: true, startedAt: true },
  });

  await audit("mentoring.assign", "mentorship", mentorship.id, { mentorId, menteeId, frequency });
  return NextResponse.json({ ok: true, mentorship }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
