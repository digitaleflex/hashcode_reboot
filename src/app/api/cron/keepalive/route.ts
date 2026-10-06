import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkDb } from "@/lib/health";
import { AuthError, errorToResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/cron/keepalive — ping externe anti-veille Neon (cron-job.org). */
export async function GET(req: NextRequest) {
  try {
  if (!process.env.CRON_SECRET) {
    // D26 — même 401 que `cron/collect-metrics`, seul `ok: false` disparaît.
    throw new AuthError(
      "keepalive non configuré (CRON_SECRET manquant)",
      "UNAUTHORIZED",
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
  }
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(a, b)) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
  }
  const dbCheck = await checkDb();
  return NextResponse.json({ ok: dbCheck.ok, latencyMs: dbCheck.latencyMs });
  } catch (err) {
    return errorToResponse(err);
  }
}
