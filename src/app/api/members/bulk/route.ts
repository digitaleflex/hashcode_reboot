import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { requireAdminRole } from "@/lib/admin-auth";
import { canTransition, deriveState, profileStatusToState } from "@/lib/acquisition-state";
import { getLatestAcquisitionQualifications } from "@/lib/qualification";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
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

    // Garde machine à états #158 (même garde que PATCH /api/members/[id]) :
    // les actions qui changent profileStatus sont rejetées en bloc si l'un
    // des membres visés est dans un état terminal (BOUNCED/HANDOFF) ou si la
    // transition est incohérente. Mappings approve/invite/waitlist/reject
    // inchangés ; invite (communityStatus seul) et delete non gardés.
    if (action === "approve" || action === "waitlist" || action === "reject") {
      const targetStatus =
        action === "approve"
          ? "APPROVED"
          : action === "waitlist"
            ? "WAITLIST"
            : "REJECTED";
      const to = profileStatusToState(targetStatus);
      const currents = await db.member.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          profileStatus: true,
          communityStatus: true,
          invitationStatus: true,
        },
      });
      // Preuves qualification #211 (une requête pour tous les visés) : même
      // garde enrichie que PATCH /api/members/[id] — sans snapshot, un
      // membre QUALIFIED retomberait à LEAD_CAPTURED et fausserait la garde.
      const qualifications = await getLatestAcquisitionQualifications(
        currents.map((m) => m.id),
      );
      const illegal = currents
        .filter(
          (m) =>
            !canTransition(
              deriveState({
                member: m,
                qualification: qualifications.get(m.id) ?? null,
              }),
              to,
            ),
        )
        .map((m) => m.id);
      if (illegal.length > 0) {
        throw new ValidationError(
          "Transition de statut illégale pour certains membres.",
          { ids: illegal, action, target: targetStatus },
        );
      }
    }

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
            data: {
              invitedAt: new Date(),
            },
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
          data: toServerEventData({
            type: "admin_bulk_action",
            ref: `${action}/${affected}`,
          }),
        });
      } catch {
        /* ignore */
      }

      // Erreur partielle explicite : certains ids demandés n'existaient pas.
      if (affected < ids.length) {
        return NextResponse.json({
          ok: true,
          message: `Partial success: ${affected}/${ids.length} processed.`,
          affected,
          requested: ids.length,
        });
      }

      return NextResponse.json({
        ok: true,
        message: `Successfully processed ${affected} members.`,
        affected,
      });
    } catch (err) {
      throw errorToResponse(err);
    }
  } catch (err) {
    return errorToResponse(err);
  }
}