import { NextRequest, NextResponse } from "next/server";
import { adminCookieHeader, issueAdminToken, getAdminPasscode } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** POST /api/admin/login — verify passcode, issue admin cookie. */
export async function POST(req: NextRequest) {
  // Anti-brute-force : 10 tentatives par IP toutes les 10 minutes.
  const rl = rateLimit(`admin-login:${rateKey(req)}`, {
    capacity: 10,
    refillPerSec: 1 / 60,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }
  let body: { passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const passcode = (body.passcode ?? "").trim();
  if (!passcode) {
    return NextResponse.json({ error: "Passcode requis." }, { status: 422 });
  }
  // Constant-time compare.
  const expected = getAdminPasscode();
  if (passcode.length !== expected.length) {
    return NextResponse.json({ error: "Passcode invalide." }, { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < passcode.length; i++) {
    diff |= passcode.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return NextResponse.json({ error: "Passcode invalide." }, { status: 401 });
  }
  const token = issueAdminToken();
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": adminCookieHeader(token) } },
  );
}
