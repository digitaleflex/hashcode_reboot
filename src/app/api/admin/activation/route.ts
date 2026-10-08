import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import {
  getActivationCurve,
  getActivationRate,
  getInactive7d,
} from "@/lib/activation";
import {
  ForbiddenError,
  RateLimitError,
  errorToResponse,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/activation — suivi activation premier challenge (#120, v1 SIMPLE).
 *
 * AUTH   : admin operator (+ rate-limit sur le modèle workshops/stats).
 * OUTPUT : { rate, activated, eligible, curve: [{ date, count }], inactifs: [...] }
 * ERRORS : 403, 429.
 *
 * Query optionnelle : ?days=N (1..90, défaut 30) pour la courbe.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdminRole(req, "operator"))) {
      throw new ForbiddenError("Accès refusé.");
    }

    const rl = await rateLimit(`admin-activation:${rateKey(req)}`, {
      capacity: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      throw new RateLimitError("Trop de requêtes.", rl.retryAfterMs);
    }

    const rawDays = Number(req.nextUrl.searchParams.get("days") ?? "30");
    const days = Number.isFinite(rawDays)
      ? Math.max(1, Math.min(90, Math.floor(rawDays)))
      : 30;

    const [{ rate, activated, eligible }, curve, inactifs] = await Promise.all([
      getActivationRate(),
      getActivationCurve(days),
      getInactive7d(),
    ]);

    return NextResponse.json({ rate, activated, eligible, curve, inactifs });
  } catch (err) {
    return errorToResponse(err);
  }
}
