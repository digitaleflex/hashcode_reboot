import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  AppError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

const bulkSchema = z.object({
  ids: z.array(z.string().max(40)).min(1).max(10),
  action: z.enum(["approve", "invite", "waitlist", "reject", "delete"]),
});

/**
 * POST /api/members/bulk — apply a status change to multiple members at once
 * (admin-only). Used by the admin bulk-action bar.
 */
export async function POST(req: NextRequest) {
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  if (!(await requireAdminRole(req, "operator"))) {
    throw new ForbiddenError("Opérateur requis.");
  }
  // Anti-abus : 20 actions bulk par IP toutes les 10 minutes.
  const rl = await rateLimit(`admin-bulk:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    throw new RateLimitError(
      "Trop de requêtes. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
    );
  }
  const body = await parseJsonBody(req);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Données invalides.", parsed.error.flatten());
  }
  const { ids, action } = parsed.data;

  try {
    let affected = 0;
    if (action === "delete") {
      // Soft delete : marque les membres plutôt que suppression physique.
      const result = await db.member.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() },
      });
      affected = result.count;
    } else {
      const data: Record<string, string> = {};
      if (action === "approve") {
        data.profileStatus = "APPROVED";
        data.communityStatus = "INVITED";
        data.accessLane = "immediate";
      } else if (action === "invite") {
        data.communityStatus = "INVITED";
      } else if (action === "waitlist") {
        data.profileStatus = "WAITLIST";
      } else if (action === "reject") {
        data.profileStatus = "REJECTED";
      }
      const r = await db.member.updateMany({
        where: { id: { in: ids } },
        data,
      });
      affected = r.count;
      if (action === "approve") {
        // Horodate la validation (uniquement les vrais changements).
        await db.member.updateMany({
          where: { id: { in: ids }, profileStatus: "APPROVED", approvedAt: null },
          data: { approvedAt: new Date() },
        });
      }
      if (action === "invite") {
        // Ne pas écraser ACCEPTED/REFUSED/BOUNCED/EXPIRED : seuls les
        // NOT_INVITED deviennent INVITED côté suivi d'invitation.
        await db.member.updateMany({
          where: { id: { in: ids }, invitationStatus: "NOT_INVITED" },
          data: { invitationStatus: "INVITED", invitedAt: new Date() },
        });
      }
    }

    await audit(`member.bulk-${action}`, "member", ids.join(","), {
      count: affected,
      action,
    });

    // Audit event.
    try {
      await db.analyticsEvent.create({
        data: {
          type: "admin_bulk_action",
          ref: `${action}/${affected}`,
        },
      });
    } catch {
      /* ignore */
    }

    // Erreur partielle explicite : certains ids demandés n'existaient pas.
    if (affected < ids.length) {
      return NextResponse.json({
        ok: true,
        action,
        affected,
        ids,
        partial: true,
        missing: ids.length - affected,
        warning: `Action partielle : ${affected} sur ${ids.length} membres demandés. Certains ids sont introuvables.`,
      });
    }

    return NextResponse.json({ ok: true, action, affected, ids });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Erreur interne.", { status: 500, code: "INTERNAL_ERROR" });
  }
  } catch (err) {
    return errorToResponse(err);
  }
}
