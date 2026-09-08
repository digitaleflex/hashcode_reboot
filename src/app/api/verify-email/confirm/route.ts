import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** POST /api/verify-email/confirm — déprécié (ancien OTP 6 chiffres).
 * La vérification se fait maintenant par lien magique 1-clic via GET /api/verify-email?token=xxx. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Vérification par code supprimée. Demande un lien magique (1 clic).",
      code: "DEPRECATED",
    },
    { status: 410 },
  );
}
