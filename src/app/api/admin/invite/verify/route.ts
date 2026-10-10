import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/admin/invite/verify?token=xxx — valide un jeton d'invitation.
 *
 * Route PUBLIQUE (aucune session) : c'est le lien reçu par email qui fait
 * office d'authentification. Ne renvoie que le strict nécessaire au
 * formulaire (email masqué partiellement, rôle) — jamais le token ni
 * d'information sur les autres invitations.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token || token.length < 32) {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  try {
    const invitation = await db.adminInvitation.findUnique({
      where: { tokenHash },
      select: {
        email: true,
        name: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (invitation.acceptedAt) {
      return NextResponse.json({ ok: false, error: "ALREADY_ACCEPTED" }, { status: 410 });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "EXPIRED" }, { status: 410 });
    }

    return NextResponse.json({
      ok: true,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role === "operator" ? "operator" : "viewer",
      expiresAt: invitation.expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "UNAVAILABLE" }, { status: 503 });
  }
}
