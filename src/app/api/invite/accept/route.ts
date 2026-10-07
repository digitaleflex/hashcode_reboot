import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const querySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1).max(64),
});

/**
 * GET /api/invite/accept?email=...&token=...
 *
 * Route PUBLIQUE — pas besoin d'auth.
 * Désactivée : le flux d'invitation réel utilise /verify-otp?email=&code=&next=
 * avec OTP envoyé séparément par Better Auth.
 * Toutes les requêtes renvoient une erreur générique pour éviter l'énumération
 * et préserver le taux de limitation.
 */
export async function GET(req: NextRequest) {
  // Rate limiting pour protéger contre le bruteforce (10 req/IP/10min)
  const rl = await rateLimit(`invite-accept:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.redirect(
      new URL("/?error=invalid-invite", req.url),
    );
  }

  // Toujours rediriger vers la même erreur pour éviter l'énumération d'emails
  // Le token est parsé seulement pour valider la forme du schéma Zod
  // mais n'est utilisé nulle part (route délibérément inerte)
  const { searchParams } = new URL(req.url);
  querySchema.safeParse({
    email: searchParams.get("email"),
    token: searchParams.get("token"),
  });

  return NextResponse.redirect(
    new URL("/?error=invalid-invite", req.url),
  );
}