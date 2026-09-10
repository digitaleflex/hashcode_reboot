import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { WHATSAPP_URL } from "@/lib/profiling/auto-controls";
import { audit } from "@/lib/admin-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/community/join — point d'entrée unique et tracé vers WhatsApp.
 *
 * Tout accès membre au groupe passe par ici :
 * 1. Vérifie la session membre (sinon → /login avec retour ici après connexion).
 * 2. Marque communityStatus → JOINED + événement analytics.
 * 3. Redirige vers le groupe WhatsApp officiel.
 *
 * Les liens WhatsApp directs ne doivent plus être exposés aux membres
 * (emails, dashboard, account) : utiliser cette route à la place.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);

  if (!session) {
    const loginUrl = `/login?next=${encodeURIComponent("/api/community/join")}`;
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  const memberId = session.member.id;

  // Traçage best-effort : ne bloque jamais l'accès au groupe.
  try {
    await db.member.updateMany({
      where: { id: memberId, communityStatus: { not: "JOINED" } },
      data: {
        communityStatus: "JOINED",
        joinedAt: new Date(),
        lastClickedAt: new Date(),
      },
    });
  } catch {
    /* ignore */
  }

  void audit("member.community-join", "member", memberId);

  try {
    await db.analyticsEvent.create({
      data: {
        type: "whatsapp_join_clicked",
        memberId,
        ref: "community-join",
      },
    });
  } catch {
    /* ignore */
  }

  return NextResponse.redirect(WHATSAPP_URL);
}
