import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminRole, getAdminIdentity, checkCSRF } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import {
  compileSegmentWhere,
  parseSegmentDefinition,
  segmentDefinitionSchema,
} from "@/lib/segments";
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
  name: z.string().trim().min(1).max(120),
  definition: segmentDefinitionSchema,
});

/** GET /api/admin/segments — liste (opérateurs), avec taille live. */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const rl = await rateLimit(`admin-segments:${rateKey(req)}`, {
      capacity: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const segments = await db.segment.findMany({
      orderBy: { updatedAt: "desc" },
    });
    const withSizes = await Promise.all(
      segments.map(async (s) => {
        // Une définition stockée peut ne plus valider (schéma évolué) :
        // la ligne reste listée, taille nulle, au lieu de casser la liste.
        const parsed = parseSegmentDefinition(s.definition);
        if (!parsed.success) return { ...s, size: null, invalid: true };
        const size = await db.member.count({
          where: compileSegmentWhere(parsed.data),
        });
        return { ...s, size };
      }),
    );
    return NextResponse.json({ segments: withSizes });
  } catch (err) {
    return errorToResponse(err);
  }
}

/** POST /api/admin/segments — créer (v1). Nom unique, auditée. */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    // CSRF : même garde que les autres écritures admin (origine = hôte).
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    const tooLarge = bodyLimit(req);
    if (tooLarge) return tooLarge;

    const rl = await rateLimit(`admin-segments-write:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const body = await parseJsonBody(req);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Définition invalide.", parsed.error.issues);
    }

    let segment;
    try {
      segment = await db.segment.create({
        data: {
          name: parsed.data.name,
          definition: parsed.data.definition as object,
          createdBy: await getAdminIdentity(req),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError("Nom déjà utilisé.", { status: 409, code: "NAME_TAKEN" });
      }
      throw e;
    }
    await audit("segment.create", "segment", segment.id, {
      name: segment.name,
      by: await getAdminIdentity(req),
    });
    return NextResponse.json({ segment }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
