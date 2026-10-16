import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import {
  compileSegmentWhere,
  parseSegmentDefinition,
} from "@/lib/segments";
import {
  AppError,
  errorToResponse,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/segments/[id]/preview — population du segment (#104, #101).
 * Compte + échantillon (limit bornée, ordre stable par id). Zéro PII
 * superflue : id/email/prénom/pays/domaine/statut (nécessaire au ciblage).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }
    const rl = await rateLimit(`admin-segments:${rateKey(req)}`, {
      capacity: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const { id } = await params;
    const segment = await db.segment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundError("Segment introuvable.");

    const parsed = parseSegmentDefinition(segment.definition);
    if (!parsed.success) {
      throw new AppError("Définition obsolète (revalider le segment).", {
        status: 422,
        code: "STALE_DEFINITION",
      });
    }
    const where = compileSegmentWhere(parsed.data);
    const rawLimit = new URL(req.url).searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(1, Number(rawLimit) || 1), 200) : 20;
    const [total, sample] = await Promise.all([
      db.member.count({ where }),
      db.member.findMany({
        where,
        orderBy: { id: "asc" },
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          country: true,
          primaryDomain: true,
          profileStatus: true,
        },
      }),
    ]);
    return NextResponse.json({ total, sample, version: segment.version });
  } catch (err) {
    return errorToResponse(err);
  }
}
