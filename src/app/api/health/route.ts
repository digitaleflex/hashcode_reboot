import { NextResponse } from "next/server";
import { ROUTES, checkDb, checkMail } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health — sonde publique (DB + mails + manifeste routes). */
export async function GET() {
  const started = Date.now();
  const [dbCheck, mail] = await Promise.all([checkDb(), checkMail()]);
  const latencyMs = Date.now() - started;
  const status =
    !dbCheck.ok ? "down" : mail.status === "valid" ? "ok" : "degraded";
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
    { status: dbCheck.ok ? 200 : 503 },
  );
}
