import { AppError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";

/** POST /api/verify-email/confirm — déprécié (ancien OTP 6 chiffres).
 * La vérification se fait maintenant par lien magique 1-clic via GET /api/verify-email?token=xxx. */
export async function POST() {
  try {
    throw new AppError(
      "Vérification par code supprimée. Demande un lien magique (1 clic).",
      { status: 410, code: "DEPRECATED" },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
