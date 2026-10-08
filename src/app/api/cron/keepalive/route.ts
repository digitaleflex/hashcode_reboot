import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { checkDb } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/cron/keepalive — ping interne de santé. */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "keepalive non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const dbCheck = await checkDb();
  return NextResponse.json({ ok: dbCheck.ok, latencyMs: dbCheck.latencyMs });
}
