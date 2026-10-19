import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;

/**
 * Rate-limit par type d'action (avant : 5 requêtes / 10 min / IP pour TOUT
 * `/api/auth/*`, y compris la lecture de session et le retour Google — un
 * membre qui se trompe de code, ou un réseau partagé, se retrouvait bloqué ;
 * et le dépassement levait une exception : réponse 500 au lieu de 429).
 *
 * - envoi / vérification du code : 20 / 10 min / IP (le nombre d'essais par
 *   code est déjà borné par Better Auth) ;
 * - envoi du code : en plus 5 / 10 min / email (anti « email bombing » d'un
 *   tiers, quel que soit le nombre d'IP) ;
 * - tout le reste (session, déconnexion, callbacks) : 120 / 10 min / IP.
 */
const OTP_PATH = /\/(email-otp\/|sign-in\/email-otp)/;
const OTP_SEND_PATH = /\/email-otp\/send-verification-otp$/;

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Trop de tentatives. Réessaie dans quelques minutes." },
    { status: 429, headers: { "Retry-After": retryAfterHeader(retryAfterMs) } },
  );
}

async function guarded(req: NextRequest) {
  const { pathname } = new URL(req.url);
  const ip = rateKey(req);
  const isOtp = OTP_PATH.test(pathname);

  const rl = await rateLimit(`auth-${isOtp ? "otp" : "other"}:${ip}`, {
    capacity: isOtp ? 20 : 120,
    windowMs: WINDOW_MS,
  });
  if (!rl.ok) return tooMany(rl.retryAfterMs);

  if (req.method === "POST" && OTP_SEND_PATH.test(pathname)) {
    // `clone()` : le corps reste lisible par le handler Better Auth.
    const body = (await req.clone().json().catch(() => null)) as {
      email?: unknown;
    } | null;
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email) {
      const byEmail = await rateLimit(`auth-otp-email:${email}`, {
        capacity: 5,
        windowMs: WINDOW_MS,
      });
      if (!byEmail.ok) return tooMany(byEmail.retryAfterMs);
    }
  }

  return auth.handler(req);
}

export async function GET(req: NextRequest) {
  return guarded(req);
}

export async function POST(req: NextRequest) {
  return guarded(req);
}
