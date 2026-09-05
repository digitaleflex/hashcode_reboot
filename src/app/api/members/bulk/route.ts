import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";

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
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Opérateur requis.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  // Anti-abus : 20 actions bulk par IP toutes les 10 minutes.
  const rl = await rateLimit(`admin-bulk:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides.", code: "INVALID_PAYLOAD", issues: parsed.error.issues },
      { status: 422 },
    );
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
    }

    await audit("member.bulk-soft-delete", "member", ids.join(","), {
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
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
