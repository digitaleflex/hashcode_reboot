import { NextRequest, NextResponse } from "next/server";
import { checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, RATE_LIMITS, retryAfterHeader } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { auth } from "@/lib/auth";

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

/** POST /api/admin/login — sign in with Better Auth email/password (+ Turnstile). */
export async function POST(req: NextRequest) {
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
  }
  let body: { email?: string; password?: string; captchaToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
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
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email et mot de passe requis.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  try {
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

    // Delegate the credential check + session cookie issuance to Better Auth.
    const authRes = await auth.handler(
      new Request("https://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );

    if (!authRes.ok) {
      auditLogin(ip, "failure");
      return NextResponse.json(
        { error: "Email ou mot de passe invalide.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    // Ensure the signed-in user is actually an admin (env allow-list).
    const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_OPERATORS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.length === 0 || adminEmails.includes(email);
    if (!isAdmin) {
      auditLogin(ip, "failure");
      return NextResponse.json(
        { error: "Compte non autorisé pour l'espace admin.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    auditLogin(ip, "success");
    const setCookie = authRes.headers.get("set-cookie") ?? "";
    return NextResponse.json(
      { ok: true },
      { headers: { "Set-Cookie": setCookie } },
    );
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}