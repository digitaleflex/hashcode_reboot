import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { ForbiddenError, RateLimitError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/mentoring/mentors — mentors potentiels.
 *
 * Membres validés intéressés par le mentorat, avec leur charge actuelle
 * (mentorés actifs). L'admin choisit le mentor à assigner.
 *
 * AUTH : admin operator (403 sinon).
 */
export async function GET(req: NextRequest) {
  try {
  if (!(await requireAdminRole(req, "operator"))) {
    throw new ForbiddenError("Accès refusé.");
  }

  const rl = await rateLimit(`admin-mentoring-mentors:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
  }

  const mentors = await db.member.findMany({
    where: {
      deletedAt: null,
      profileStatus: "APPROVED",
      mentoringInterest: "yes",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      country: true,
      primaryDomain: true,
      domainSpecialty: true,
      level: true,
      profileArchetype: true,
      mentoringFrequency: true,
      mentoringTypes: true,
      _count: {
        select: {
          mentorshipsAsMentor: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    mentors: mentors.map((m) => ({
      ...m,
      activeMentees: m._count.mentorshipsAsMentor,
      _count: undefined,
    })),
    total: mentors.length,
  });
  } catch (err) {
    return errorToResponse(err);
  }
}
