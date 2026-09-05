import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

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
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
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
      // Cascade analytics events, then members — atomique.
      const [, deletedMembers] = await db.$transaction([
        db.analyticsEvent.deleteMany({ where: { memberId: { in: ids } } }),
        db.member.deleteMany({ where: { id: { in: ids } } }),
      ]);
      affected = deletedMembers.count;
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

    // Audit event.
    try {
      await db.analyticsEvent.create({
        data: {
          type: "community_cta_clicked",
          ref: `admin-bulk-${action}:${affected}`,
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
