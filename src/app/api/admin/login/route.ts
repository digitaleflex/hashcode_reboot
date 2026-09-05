import { NextRequest, NextResponse } from "next/server";
import { adminCookieHeader, issueAdminToken, getAdminPasscode } from "@/lib/admin-auth";
import { rateLimit, rateKey, RATE_LIMITS, retryAfterHeader } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function auditLogin(ref: string) {
  try {
    await db.analyticsEvent.create({
      data: { type: "community_cta_clicked", ref },
    });
  } catch {
    /* ignore — l'audit ne casse jamais l'auth */
  }
}

/** POST /api/admin/login — verify passcode, issue admin cookie. */
export async function POST(req: NextRequest) {
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
  const rl = rateLimit(`admin-login:${ip}`, RATE_LIMITS.login);
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
    // Constant-time compare.
    const expected = getAdminPasscode();
    if (passcode.length !== expected.length) {
      await auditLogin("admin-login:failure");
      return NextResponse.json(
        { error: "Passcode invalide.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    let diff = 0;
    for (let i = 0; i < passcode.length; i++) {
      diff |= passcode.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff !== 0) {
      await auditLogin("admin-login:failure");
      return NextResponse.json(
        { error: "Passcode invalide.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    const token = issueAdminToken();
    await auditLogin("admin-login:success");
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