import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { listPublicEvents, normalizeEventFilters } from "@/lib/public-events";
import { AppError, RateLimitError, errorToResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

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
  try {
  const rl = await rateLimit(`public-events:${rateKey(req)}`, {
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
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
  } catch (err) {
    throw new AppError("Erreur interne.", { status: 500, code: "INTERNAL_ERROR" });
  }
  } catch (err) {
    return errorToResponse(err);
  }
}
