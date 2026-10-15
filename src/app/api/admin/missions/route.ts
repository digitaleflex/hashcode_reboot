import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminRole, getAdminIdentity } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import {
  missionDomainSchema,
  missionLevelSchema,
  missionStatusSchema,
} from "@/lib/missions/types";
import {
  AppError,
  errorToResponse,
  ForbiddenError,
  parseJsonBody,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  domain: missionDomainSchema.optional(),
  level: missionLevelSchema.optional(),
  sourceRef: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

/**
 * GET /api/admin/missions — référentiel (opérateurs).
 * Filtres whitelistés : status, domain. Limit bornée.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const rl = await rateLimit(`admin-missions-list:${rateKey(req)}`, {
      capacity: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const domain = searchParams.get("domain");
    if (status && !missionStatusSchema.safeParse(status).success) {
      throw new AppError("Statut invalide.", { status: 422, code: "INVALID_STATUS" });
    }
    if (domain && !missionDomainSchema.safeParse(domain).success) {
      throw new AppError("Domaine invalide.", { status: 422, code: "INVALID_DOMAIN" });
    }
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(1, Number(rawLimit) || 1), 200) : 50;

    const missions = await db.mission.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(domain ? { domain } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        _count: { select: { assignments: true, submissions: true } },
      },
    });
    return NextResponse.json({ missions, total: missions.length });
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * POST /api/admin/missions — créer (DRAFT). Auditée (qui crée quoi).
 */
export async function POST(req: NextRequest) {
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Données invalides.", parsed.error.issues);
    }

    let mission;
    try {
      mission = await db.mission.create({
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          domain: parsed.data.domain ?? "web",
          level: parsed.data.level ?? "beginner",
          sourceRef: parsed.data.sourceRef ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
          status: "DRAFT",
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError("Slug déjà utilisé.", { status: 409, code: "SLUG_TAKEN" });
      }
      throw e;
    }
    await audit("mission.create", "mission", mission.id, {
      slug: mission.slug,
      by: await getAdminIdentity(req),
    });
    return NextResponse.json({ mission }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
