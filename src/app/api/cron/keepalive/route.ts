import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkDb } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/cron/keepalive — ping externe anti-veille Neon (cron-job.org). */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "keepalive non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const dbCheck = await checkDb();
  return NextResponse.json({ ok: dbCheck.ok, latencyMs: dbCheck.latencyMs });
}
