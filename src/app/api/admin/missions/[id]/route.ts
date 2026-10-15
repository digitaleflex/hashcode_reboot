import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole, getAdminIdentity } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import {
  missionDomainSchema,
  missionLevelSchema,
  missionStatusSchema,
  type MissionStatus,
} from "@/lib/missions/types";
import { canTransitionMission } from "@/lib/missions/engine";
import {
  AppError,
  errorToResponse,
  ForbiddenError,
  NotFoundError,
  parseJsonBody,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  domain: missionDomainSchema.optional(),
  level: missionLevelSchema.optional(),
  sourceRef: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  status: missionStatusSchema.optional(),
});

/** GET /api/admin/missions/[id] — détail + compteurs par statut. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdminRole(_req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const { id } = await params;
    const mission = await db.mission.findUnique({ where: { id } });
    if (!mission) throw new NotFoundError("Mission introuvable.");
    const [assignments, submissions] = await Promise.all([
      db.missionAssignment.groupBy({
        by: ["status"],
        where: { missionId: id },
        _count: true,
      }),
      db.missionSubmission.groupBy({
        by: ["status"],
        where: { missionId: id },
        _count: true,
      }),
    ]);
    return NextResponse.json({ mission, assignments, submissions });
  } catch (err) {
    return errorToResponse(err);
  }
}

/** PATCH /api/admin/missions/[id] — édition + transitions éditoriales (moteur). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    const tooLarge = bodyLimit(req);
    if (tooLarge) return tooLarge;

    const rl = await rateLimit(`admin-missions-write:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const body = await parseJsonBody(req);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Données invalides.", parsed.error.issues);
    }

    const { id } = await params;
    const mission = await db.mission.findUnique({
      where: { id },
      select: { id: true, status: true, slug: true },
    });
    if (!mission) throw new NotFoundError("Mission introuvable.");

    if (
      parsed.data.status &&
      parsed.data.status !== (mission.status as MissionStatus) &&
      !canTransitionMission(mission.status as MissionStatus, parsed.data.status)
    ) {
      throw new AppError(
        `Transition interdite : ${mission.status} → ${parsed.data.status}.`,
        { status: 422, code: "INVALID_TRANSITION" },
      );
    }

    const updated = await db.mission.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.domain !== undefined ? { domain: parsed.data.domain } : {}),
        ...(parsed.data.level !== undefined ? { level: parsed.data.level } : {}),
        ...(parsed.data.sourceRef !== undefined
          ? { sourceRef: parsed.data.sourceRef }
          : {}),
        ...(parsed.data.sortOrder !== undefined
          ? { sortOrder: parsed.data.sortOrder }
          : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
      },
    });
    await audit("mission.update", "mission", id, {
      slug: mission.slug,
      by: await getAdminIdentity(req),
    });
    return NextResponse.json({ mission: updated });
  } catch (err) {
    return errorToResponse(err);
  }
}
