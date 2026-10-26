import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole, getAdminIdentity, checkCSRF } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { classifyPair } from "@/lib/dedup";
import { mergeMembers } from "@/lib/dedup-merge";
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

const mergeSchema = z.object({
  loserId: z.string().min(1).max(64),
  winnerId: z.string().min(1).max(64),
  /** Exigé pour AMBIGU (contrôle humain explicite). */
  acknowledgeAmbiguous: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/duplicates/merge — fusion choisie par un humain (#103).
 * EXACT : fusion directe. AMBIGU : `acknowledgeAmbiguous: true` exigé, sinon
 * 422. Rejouer après fusion → 409 (perdant soft-deleted). Auditée avant/après.
 */
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

    const rl = await rateLimit(`admin-duplicates-write:${rateKey(req)}`, {
      capacity: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);

    const body = await parseJsonBody(req);
    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Paramètres invalides.", parsed.error.issues);
    }
    const { loserId, winnerId, acknowledgeAmbiguous } = parsed.data;
    if (loserId === winnerId) {
      throw new AppError("Perdant et gagnant identiques.", {
        status: 422,
        code: "SAME_MEMBER",
      });
    }

    const [loser, winner] = await Promise.all([
      db.member.findUnique({ where: { id: loserId } }),
      db.member.findUnique({ where: { id: winnerId } }),
    ]);
    if (!loser || loser.deletedAt) {
      throw new AppError("Perdant introuvable ou déjà fusionné.", {
        status: 409,
        code: "ALREADY_MERGED",
      });
    }
    if (!winner || winner.deletedAt) {
      throw new NotFoundError("Gagnant introuvable.");
    }

    const kind = classifyPair(
      { email: loser.email, phone: loser.phone },
      { email: winner.email, phone: winner.phone },
    );
    if (!kind) {
      throw new AppError("Aucun doublon avéré entre ces deux membres.", {
        status: 422,
        code: "NOT_DUPLICATES",
      });
    }
    if (kind === "AMBIGUOUS" && !acknowledgeAmbiguous) {
      throw new AppError("Cas ambigu : confirmation explicite exigée.", {
        status: 422,
        code: "NEEDS_ACK",
      });
    }

    let summary;
    try {
      summary = await mergeMembers(db, loserId, winnerId);
    } catch (e) {
      if (e instanceof Error && (e.message === "LOSER_GONE" || e.message === "WINNER_GONE")) {
        throw new AppError("Fusion impossible (état changé entre-temps).", {
          status: 409,
          code: "ALREADY_MERGED",
        });
      }
      throw e;
    }
    // Audit awaitée (pas fire-and-forget) : la trace de fusion est une
    // garantie admin, et les tests l'assertent sans course.
    await audit("member.merge", "member", winnerId, {
      loser: loserId,
      loserEmail: loser.email,
      kind,
      filled: summary.filled,
      moved: summary.moved,
      deletedConflicts: summary.deletedConflicts,
      by: await getAdminIdentity(req),
    });
    return NextResponse.json({ ok: true, kind, ...summary });
  } catch (err) {
    return errorToResponse(err);
  }
}
