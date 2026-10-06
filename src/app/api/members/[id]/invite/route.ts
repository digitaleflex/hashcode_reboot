import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminOrThrow } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { errorToResponse, NotFoundError, RateLimitError } from "@/lib/errors";

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
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  // D24 : session renvoyée par le garde, réutilisée par `audit()` — une seule
  // résolution de session par requête (cf. D28).
  const admin = await requireAdminOrThrow(req, "operator");
  // Anti-abus : 20 invitations par IP toutes les 10 minutes.
  const rl = await rateLimit(`admin-invite:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    throw new RateLimitError("Trop de requêtes. Réessaie dans quelques minutes.", rl.retryAfterMs);
  }
  const { id } = await params;
  const member = await db.member.findUnique({
    where: { id },
    select: { id: true, firstName: true, email: true, profileStatus: true, communityStatus: true, invitationStatus: true },
  });
  if (!member) {
    throw new NotFoundError("Membre introuvable.");
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
    { type: "admin", role: admin.role },
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
  } catch (err) {
    return errorToResponse(err);
  }
}
