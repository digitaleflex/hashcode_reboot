import { NextResponse } from "next/server";
import { getSession } from "@/lib/account-auth";
import { buildAccountData } from "@/lib/account-data";
import { AuthError, errorToResponse } from "@/lib/errors";

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
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
    }

    const data = buildAccountData(session.member);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
