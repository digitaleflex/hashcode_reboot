import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { requestEmailCode } from "@/lib/verify-email";
import { sendVerificationEmail } from "@/lib/mail";

export const runtime = "nodejs";

const sendSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  firstName: z.string().trim().max(40).optional().default(""),
});

/** POST /api/verify-email — envoie un code OTP à 6 chiffres (public).
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

  const requested = await requestEmailCode(email);
  if (!requested.ok) {
    return NextResponse.json(
      {
        error: `Code déjà envoyé. Réessaie dans ${requested.cooldownSec ?? 60} secondes.`,
        code: "COOLDOWN",
        retryInSec: requested.cooldownSec ?? 60,
      },
      { status: 429 },
    );
  }

  // Envoi fire-and-forget : on répond ok même si Resend échoue,
  // le client pourra redemander après le cooldown.
  try {
    await sendVerificationEmail({
      to: email,
      firstName: firstName || "toi",
      code: requested.code,
    });
  } catch {
    /* email must never break the flow */
  }

  return NextResponse.json({ ok: true, message: "Code envoyé. Vérifie ta boîte mail." });
}
