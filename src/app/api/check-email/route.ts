import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

/** GET /api/check-email?email=... — used for "already started" detection
 * before submitting, so the UI can offer a resume / status view. */
export async function GET(req: NextRequest) {
  // Anti-abus : 10 vérifications par IP toutes les 10 minutes (réduit de 30).
  const rl = await rateLimit(`check-email:${rateKey(req)}`, {
    capacity: 10,  // Réduit de 30 pour ralentir l'énumération
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

  // Timing normalization: always do a dummy hash comparison for invalid emails
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    const dummy = Buffer.from("dummy");
    const dummy2 = Buffer.from("dummy");
    timingSafeEqual(dummy, dummy2); // Normalize timing for invalid emails
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
