import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminRole, getAdminIdentity, checkCSRF } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { segmentDefinitionSchema } from "@/lib/segments";
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
  name: z.string().trim().min(1).max(120).optional(),
  definition: segmentDefinitionSchema.optional(),
});

/** GET /api/admin/segments/[id] — détail. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const { id } = await params;
    const segment = await db.segment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundError("Segment introuvable.");
    return NextResponse.json({ segment });
  } catch (err) {
    return errorToResponse(err);
  }
}

/** PATCH — renommer et/ou redéfinir (version+1, audité). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success || (!parsed.data.name && !parsed.data.definition)) {
      throw new ValidationError("Rien à modifier (name et/ou definition).", parsed.error?.issues);
    }

    const { id } = await params;
    const existing = await db.segment.findUnique({
      where: { id },
      select: { id: true, version: true, name: true },
    });
    if (!existing) throw new NotFoundError("Segment introuvable.");

    try {
      const updated = await db.segment.update({
        where: { id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.definition
            ? { definition: parsed.data.definition as object, version: existing.version + 1 }
            : {}),
        },
      });
      await audit("segment.update", "segment", id, {
        fromVersion: existing.version,
        toVersion: updated.version,
        by: await getAdminIdentity(req),
      });
      return NextResponse.json({ segment: updated });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError("Nom déjà utilisé.", { status: 409, code: "NAME_TAKEN" });
      }
      throw e;
    }
  } catch (err) {
    return errorToResponse(err);
  }
}

/** DELETE — suppression (auditée). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const rl = await rateLimit(`admin-segments-write:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const { id } = await params;
    const existing = await db.segment.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundError("Segment introuvable.");
    await db.segment.delete({ where: { id } });
    await audit("segment.delete", "segment", id, {
      name: existing.name,
      by: await getAdminIdentity(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
