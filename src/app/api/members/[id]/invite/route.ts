import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole, readAdminCookie, getAdminRoleFromToken } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";

export const runtime = "nodejs";

/**
 * POST /api/members/[id]/invite — admin marks the member as INVITED (community
 * status) and APPROVED (profile status). Records an analytics event. Returns
 * a site-tracked join link (via /api/community/join) that the admin can
 * copy/paste into a personal message — never the raw WhatsApp URL, so every
 * join is visible on the admin dashboard.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Opérateur requis.", code: "FORBIDDEN" },
      { status: 403 },
    );
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
    select: { id: true, firstName: true, email: true, profileStatus: true, communityStatus: true, invitationStatus: true },
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
      ...(member.profileStatus !== "APPROVED" ? { approvedAt: new Date() } : {}),
      ...(member.invitationStatus === "NOT_INVITED"
        ? { invitationStatus: "INVITED", invitedAt: new Date() }
        : {}),
    },
  });

  void audit(
    "member.invite",
    "member",
    id,
    { email: member.email },
    { type: "admin", role: getAdminRoleFromToken(readAdminCookie(req)) ?? "operator" },
  );

  try {
    await db.analyticsEvent.create({
      data: {
        type: "admin_invite",
        memberId: id,
        ref: `member.invite:${id}`,
      },
    });
  } catch {
    /* ignore */
  }

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";
  const joinUrl = `${siteBase.replace(/\/$/, "")}/login?next=${encodeURIComponent("/api/community/join")}`;

  return NextResponse.json({
    ok: true,
    member: updated,
    joinUrl,
    inviteMessage:
      `Bonjour ${member.firstName}, tu fais partie des premiers membres du Reboot HASHCODE. Rejoins la communauté officielle ici :`,
  });
}
