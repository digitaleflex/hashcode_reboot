import { NextResponse } from "next/server";
import { getSession } from "@/lib/account-auth";
import { buildAccountData } from "@/lib/account-data";

export const runtime = "nodejs";

/**
 * GET /api/account/me
 *
 * Retourne les infos complètes du membre connecté pour la page /account :
 *   - Identité (firstName, lastName, email, phone, country, city, gender)
 *   - Profil généré (archetype, tags) si créé
 *   - Statut (profileStatus, communityStatus, accessLane)
 *   - Métadonnées (createdAt)
 *
 * Exclut : deletedAt, otpHash, données sensibles admin.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const data = buildAccountData(session.member);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
