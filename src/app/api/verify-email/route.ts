import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { requestEmailLink, confirmEmailLink, buildVerifyUrl } from "@/lib/verify-email";
import { sendVerificationLinkEmail } from "@/lib/mail";

export const runtime = "nodejs";

const sendSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  firstName: z.string().trim().max(40).optional().default(""),
});

/** POST /api/verify-email — envoie un lien magique 1-clic (public).
 * Anti-abus : 5 envois par IP toutes les 10 minutes + cooldown 60 s par email. */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`verify-email:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email invalide.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const { email, firstName } = parsed.data;

  const requested = await requestEmailLink(email);
  if (!requested.ok) {
    return NextResponse.json(
      {
        error: `Lien déjà envoyé. Réessaie dans ${requested.cooldownSec ?? 60} secondes.`,
        code: "COOLDOWN",
        retryInSec: requested.cooldownSec ?? 60,
      },
      { status: 429 },
    );
  }

  // Envoi fire-and-forget : on répond ok même si Resend échoue,
  // le client pourra redemander après le cooldown.
  try {
    await sendVerificationLinkEmail({
      to: email,
      firstName: firstName || "toi",
      url: buildVerifyUrl(requested.token),
    });
  } catch {
    /* email must never break the flow */
  }

  return NextResponse.json({ ok: true, message: "Lien envoyé. Vérifie ta boîte mail (1 clic)." });
}

/** GET /api/verify-email?token=xxx — vérifie le lien magique (public, usage unique).
 * Utilisé par la page /verify-email. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  if (!token) {
    return NextResponse.json(
      { error: "Lien invalide.", code: "INVALID_LINK" },
      { status: 422 },
    );
  }
  const rl = await rateLimit(`verify-email-verify:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 600000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }
  const result = await confirmEmailLink(token);
  if (!result.ok) {
    const expired = result.reason === "expired";
    return NextResponse.json(
      {
        error: expired
          ? "Lien expiré. Demande un nouveau lien."
          : "Lien invalide. Demande un nouveau lien.",
        code: expired ? "EXPIRED" : "INVALID_LINK",
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ ok: true, verified: true, email: result.email, message: "Email vérifié." });
}
