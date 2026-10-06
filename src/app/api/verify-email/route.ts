import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { requestEmailLink, confirmEmailLink, buildVerifyUrl } from "@/lib/verify-email";
import { sendVerificationLinkEmail } from "@/lib/mail";
import {
  AppError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

const sendSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  firstName: z.string().trim().max(40).optional().default(""),
});

/** POST /api/verify-email — envoie un lien magique 1-clic (public).
 * Anti-abus : 5 envois par IP toutes les 10 minutes + cooldown 60 s par email. */
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(`verify-email:${rateKey(req)}`, {
      capacity: 5,
      windowMs: 600000, // 10 minutes
    });
    if (!rl.ok) {
      throw new RateLimitError(
        "Trop de demandes. Réessaie dans quelques minutes.",
        rl.retryAfterMs,
      );
    }

    const body = await parseJsonBody(req);

    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Email invalide.", parsed.error.flatten());
    }
    const { email, firstName } = parsed.data;

    const requested = await requestEmailLink(email);
    if (requested.alreadyVerified) {
      // D34 — l'email est déjà vérifié. Répondre 200 et non 429 : un
      // rate-limit ferait réessayer l'utilisateur pendant 60 s alors que
      // l'utilisateur est déjà validé et qu'aucun envoi n'a eu lieu.
      return NextResponse.json({
        ok: true,
        verified: true,
        message: "Email déjà vérifié.",
      });
    }
    if (!requested.ok) {
      throw new AppError(
        `Lien déjà envoyé. Réessaie dans ${requested.cooldownSec ?? 60} secondes.`,
        {
          status: 429,
          code: "COOLDOWN",
          details: { retryInSec: requested.cooldownSec ?? 60 },
        },
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
  } catch (err) {
    return errorToResponse(err);
  }
}

/** GET /api/verify-email?token=xxx — vérifie le lien magique (public, usage unique).
 * Utilisé par la page /verify-email. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = (searchParams.get("token") || "").trim();
    if (!token) {
      throw new AppError("Lien invalide.", { status: 422, code: "INVALID_LINK" });
    }
    const rl = await rateLimit(`verify-email-verify:${rateKey(req)}`, {
      capacity: 10,
      windowMs: 600000,
    });
    if (!rl.ok) {
      throw new RateLimitError(
        "Trop de tentatives. Réessaie dans quelques minutes.",
        rl.retryAfterMs,
      );
    }
    const result = await confirmEmailLink(token);
    if (!result.ok) {
      const expired = result.reason === "expired";
      throw new AppError(
        expired
          ? "Lien expiré. Demande un nouveau lien."
          : "Lien invalide. Demande un nouveau lien.",
        { status: 422, code: expired ? "EXPIRED" : "INVALID_LINK" },
      );
    }
    return NextResponse.json({ ok: true, verified: true, email: result.email, message: "Email vérifié." });
  } catch (err) {
    return errorToResponse(err);
  }
}
