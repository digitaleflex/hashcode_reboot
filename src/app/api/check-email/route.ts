import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** GET /api/check-email?email=... — used for "already started" detection
 * before submitting, so the UI can offer a resume / status view. */
export async function GET(req: NextRequest) {
  // Anti-abus : 30 vérifications par IP toutes les 10 minutes.
  const rl = await rateLimit(`check-email:${rateKey(req)}`, {
    capacity: 30,
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
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ exists: false });
  }
  const existing = await db.member.findUnique({
    where: { email },
    select: { id: true },
  });
  // Anti-énumération : on garde { exists } pour l'UX reprise, mais on ne
  // renvoie AUCUNE donnée membre (ni id, ni prénom, ni statuts) — un attaquant
  // ne peut plus moissonner la base email par email.
  if (!existing) return NextResponse.json({ exists: false });
  return NextResponse.json({ exists: true });
}
