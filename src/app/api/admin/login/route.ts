import { NextRequest, NextResponse } from "next/server";
import { adminCookieHeader, issueAdminToken, getAdminPasscode, checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, RATE_LIMITS, retryAfterHeader } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function auditLogin(ref: string) {
  try {
    await db.analyticsEvent.create({
      data: { type: "admin_login_attempt", ref },
    });
  } catch {
    /* ignore — l'audit ne casse jamais l'auth */
  }
}

/** POST /api/admin/login — verify passcode, issue admin cookie. */
export async function POST(req: NextRequest) {
  // CSRF protection: ensure same-origin request (defense in depth alongside SameSite=Lax)
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  // Read body once.
  let body: { passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }
  const passcode = (body.passcode ?? "").trim();

  // Anti-brute-force : 10 tentatives par IP toutes les 10 secondes.
  // Key = `${ip}` for login (passcode not yet known at rate-limit stage).
  const ip = rateKey(req);
  const rl = await rateLimit(`admin-login:${ip}`, RATE_LIMITS.login);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }
  if (!passcode) {
    return NextResponse.json(
      { error: "Passcode requis.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  try {
    // Constant-time comparison: single pass handling both length mismatch and XOR
    const expected = getAdminPasscode();
    const minLen = Math.min(passcode.length, expected.length);
    let diff = 0;

    // XOR up to the common length
    for (let i = 0; i < minLen; i++) {
      diff |= passcode.charCodeAt(i) ^ expected.charCodeAt(i);
    }

    // Penalize length mismatch: XOR extra chars from the longer side,
    // ensuring execution time is proportional to max(lenA, lenB)
    if (passcode.length !== expected.length) {
      const longer = passcode.length > expected.length ? passcode : expected;
      for (let i = minLen; i < longer.length; i++) {
        diff |= longer.charCodeAt(i) ^ 0x00;
      }
      diff |= 1; // Ensure diff is non-zero
    }

    if (diff !== 0) {
      await auditLogin("failure");
      return NextResponse.json(
        { error: "Passcode invalide.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const token = issueAdminToken("operator", ip);
    await auditLogin("success");
    return NextResponse.json(
      { ok: true },
      { headers: { "Set-Cookie": adminCookieHeader(token) } },
    );
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}