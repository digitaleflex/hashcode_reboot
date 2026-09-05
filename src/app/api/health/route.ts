import { NextRequest, NextResponse } from "next/server";
import { checkDb, checkMail } from "@/lib/health";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health — sonde publique minimale.
 * Réponse identique pour public et admin : pas de fuite d'info infra
 * (DB latency, mail service, route manifest) — fix info disclosure. */
export async function GET(req: NextRequest) {
  // Anti-abus : 30 sondes par IP toutes les 10 minutes.
  const rl = await rateLimit(`health:${rateKey(req)}`, {
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
  const started = Date.now();
  const [dbCheck, mail] = await Promise.all([checkDb(), checkMail()]);
  const latencyMs = Date.now() - started;
  const status =
    !dbCheck.ok ? "down" : mail.status === "valid" ? "ok" : "degraded";
  const code = dbCheck.ok ? 200 : 503;
  // Réponse volontairement réduite (pas de détail infra exposé, ni pour l'admin).
  return NextResponse.json(
    { status, latencyMs },
    {
      status: code,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    },
  );
}
