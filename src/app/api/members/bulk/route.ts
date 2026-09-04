import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

const bulkSchema = z.object({
  ids: z.array(z.string().max(40)).min(1).max(100),
  action: z.enum(["approve", "invite", "waitlist", "reject", "delete"]),
});

/**
 * POST /api/members/bulk — apply a status change to multiple members at once
 * (admin-only). Used by the admin bulk-action bar.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides.", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const { ids, action } = parsed.data;

  let affected = 0;
  if (action === "delete") {
    // Cascade analytics events, then members.
    await db.analyticsEvent.deleteMany({ where: { memberId: { in: ids } } });
    const r = await db.member.deleteMany({ where: { id: { in: ids } } });
    affected = r.count;
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

  return NextResponse.json({ ok: true, action, affected });
}
