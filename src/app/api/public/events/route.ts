import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { listPublicEvents, normalizeEventFilters } from "@/lib/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/public/events — événements à venir de HASHCODE REBOOT (PUBLIC).
 *
 * Volontairement séparé de /api/events (qui exige un membre connecté ou un
 * admin) pour ne pas affaiblir son contrat :
 * - n'expose QUE les événements `scheduled` / `live` à venir ;
 * - n'expose AUCUNE donnée personnelle : uniquement des compteurs agrégés ;
 * - ignore `status=all` et `memberId` (pas de fuite de RSVP individuels).
 *
 * `interestCount` = signaux d'intérêt anonymes (« ça m'intéresse ») enregistrés
 * via /api/analytics (type `event_interest`).
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimit(`public-events:${rateKey(req)}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const url = new URL(req.url);
  const filters = normalizeEventFilters({
    type: url.searchParams.get("type"),
    domain: url.searchParams.get("domain"),
    limit: Number(url.searchParams.get("limit") || "20"),
  });

  try {
    const events = await listPublicEvents(filters);
    return NextResponse.json({ ok: true, events });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
