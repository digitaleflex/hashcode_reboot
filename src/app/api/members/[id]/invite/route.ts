import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { WHATSAPP_URL } from "@/lib/profiling/auto-controls";

export const runtime = "nodejs";

/**
 * POST /api/members/[id]/invite — admin marks the member as INVITED (community
 * status) and APPROVED (profile status). Records an analytics event. Returns
 * the WhatsApp community URL the admin can copy/paste into a personal message.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  // Anti-abus : 20 invitations par IP toutes les 10 minutes.
  const rl = await rateLimit(`admin-invite:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }
  const { id } = await params;
  const member = await db.member.findUnique({
    where: { id },
    select: { id: true, firstName: true, email: true, profileStatus: true, communityStatus: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  }

  const updated = await db.member.update({
    where: { id },
    data: {
      profileStatus: "APPROVED",
      communityStatus: "INVITED",
      accessLane: "immediate",
    },
  });

  try {
    await db.analyticsEvent.create({
      data: {
        type: "community_cta_clicked",
        memberId: id,
        ref: "admin-invite",
      },
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    ok: true,
    member: updated,
    whatsappUrl: WHATSAPP_URL,
    inviteMessage:
      `Bonjour ${member.firstName}, tu fais partie des premiers membres du Reboot HASHCODE. Rejoins la communauté officielle ici :`,
  });
}
