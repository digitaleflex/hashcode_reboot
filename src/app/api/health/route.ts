import { NextRequest, NextResponse } from "next/server";
import { ROUTES, checkDb, checkMail } from "@/lib/health";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health — sonde publique minimale ; détails réservés à l'admin. */
export async function GET(req: NextRequest) {
  // Anti-abus : 30 sondes par IP toutes les 10 minutes.
  const rl = rateLimit(`health:${rateKey(req)}`, {
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
  // Réponse publique volontairement réduite (pas de détail infra exposé).
  // Les checks détaillés (db/mail/routes) sont servis uniquement à l'admin.
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ status, latencyMs }, { status: code });
  }
  return NextResponse.json(
    {
      status,
      checks: {
        db: { ok: dbCheck.ok, latencyMs: dbCheck.latencyMs },
        mail: { status: mail.status, detail: mail.detail },
        routes: { expected: ROUTES.length, list: ROUTES },
      },
      latencyMs,
    },
    { status: code },
  );
}
