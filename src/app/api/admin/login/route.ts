import { NextRequest, NextResponse } from "next/server";
import { adminCookieHeader, issueAdminToken, getAdminPasscode, checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, RATE_LIMITS, retryAfterHeader } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";

export const runtime = "nodejs";

/** Verify a Cloudflare Turnstile token. Returns true if valid. */
async function verifyTurnstileToken(token: string | undefined): Promise<boolean> {
  if (!token) return true; // No captcha required if not triggered
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Fallback: no validation if no secret configured

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function auditLogin(ip: string, ref: "success" | "failure") {
  void audit("admin.login", "admin_key", undefined, { result: ref }, { type: "ip", ip });
}

/** POST /api/admin/login — verify passcode + Turnstile, issue admin cookie. */
export async function POST(req: NextRequest) {
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  let body: { passcode?: string; captchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }
  const passcode = (body.passcode ?? "").trim();
  const captchaToken = body.captchaToken;

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
    const expected = getAdminPasscode();
    const minLen = Math.min(passcode.length, expected.length);
    let diff = 0;
    for (let i = 0; i < minLen; i++) {
      diff |= passcode.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (passcode.length !== expected.length) {
      const longer = passcode.length > expected.length ? passcode : expected;
      for (let i = minLen; i < longer.length; i++) {
        diff |= longer.charCodeAt(i) ^ 0x00;
      }
      diff |= 1;
    }
    if (diff !== 0) {
      auditLogin(ip, "failure");
      return NextResponse.json(
        { error: "Passcode invalide.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    // Turnstile validation (only if captcha was required by client).
    if (captchaToken) {
      const captchaValid = await verifyTurnstileToken(captchaToken);
      if (!captchaValid) {
        auditLogin(ip, "failure");
        return NextResponse.json(
          { error: "Captcha invalide. Réessaie.", code: "CAPTCHA_INVALID" },
          { status: 401 },
        );
      }
    }

    const token = issueAdminToken("operator", ip);
    auditLogin(ip, "success");
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