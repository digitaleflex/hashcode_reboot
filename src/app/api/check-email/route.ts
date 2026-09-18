import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** GET /api/check-email?email=... — sonde de santé technique.
 *
 * F4 : cette route renvoyait { exists: true/false } — un oracle
 * d'énumération des emails inscrits (un booléen suffit à moissonner).
 * Aucune interface ne consomme ce champ : la reprise de profil passe par
 * ?resume=1 + brouillon local, et seul le manifeste de santé référence ce
 * chemin. La réponse est donc constante, sans requête DB, sans oracle.
 * Le rate-limit est conservé en défense en profondeur.
 */
export async function GET(req: NextRequest) {
  // Anti-abus : 10 vérifications par IP toutes les 10 minutes.
  const rl = await rateLimit(`check-email:${rateKey(req)}`, {
    capacity: 10,
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
  return NextResponse.json({ exists: false });
}
