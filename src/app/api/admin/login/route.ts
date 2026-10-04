import { NextRequest, NextResponse } from "next/server";
import { adminAllowList, checkCSRF } from "@/lib/admin-auth";
import { rateLimit, rateKey, RATE_LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/admin-audit";
import { auth } from "@/lib/auth";
import {
  errorToResponse,
  parseJsonBody,
  AuthError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

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
  try {
    if (!checkCSRF(req)) {
      throw new ForbiddenError("CSRF validation failed.");
    }

    const rawBody = await parseJsonBody(req);
    const body = (rawBody ?? {}) as { email?: string; password?: string; captchaToken?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const captchaToken = body.captchaToken;

    const ip = rateKey(req);
    const rl = await rateLimit(`admin-login:${ip}`, RATE_LIMITS.login);
    if (!rl.ok) {
      throw new RateLimitError(undefined, rl.retryAfterMs);
    }
    if (!email || !password) {
      throw new ValidationError("Email et mot de passe requis.");
    }

    // Turnstile validation (only if captcha was required by client).
    if (captchaToken) {
      const captchaValid = await verifyTurnstileToken(captchaToken);
      if (!captchaValid) {
        auditLogin(ip, "failure");
        throw new AuthError("Captcha invalide. Réessaie.", "CAPTCHA_INVALID");
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
      throw new AuthError("Email ou mot de passe invalide.", "UNAUTHORIZED");
    }

    // Ensure the signed-in user is actually an admin (env allow-list).
    // Fail-closed : une liste vide signifie « personne n'est admin ».
    // Avant, `adminEmails.length === 0` ouvrait l'espace admin à TOUT compte
    // Better Auth valide dès que ADMIN_EMAILS/ADMIN_OPERATORS manquaient.
    if (!adminAllowList().includes(email)) {
      auditLogin(ip, "failure");
      throw new ForbiddenError("Compte non autorisé pour l'espace admin.");
    }

    auditLogin(ip, "success");
    const setCookie = authRes.headers.get("set-cookie") ?? "";
    return NextResponse.json(
      { ok: true },
      { headers: { "Set-Cookie": setCookie } },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
