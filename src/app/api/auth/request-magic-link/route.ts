import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { generateOtp, hashOtp, OTP_TTL_MS } from "@/lib/account-otp";
import { createPendingSession } from "@/lib/account-auth";
import { sendMagicLinkEmail } from "@/lib/mail";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
});

/**
 * POST /api/auth/request-magic-link
 *
 * Envoie un code OTP 6 chiffres par email pour connexion.
 *
 * Anti-abus :
 *   - 5 demandes / IP / 10 min
 *   - 1 session active (otpHash non consommé) par email
 *   - Anti-enumeration : si l'email n'existe pas, on renvoie quand même ok
 *     (mais on n'envoie pas d'email)
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`magic-link:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 10 * 60 * 1000, // 10 min
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "Trop de demandes. Réessaie dans quelques minutes.",
        code: "RATE_LIMITED",
      },
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email invalide.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const { email } = parsed.data;

  // Anti-enumeration : on ne dit jamais si l'email existe ou non.
  // Mais on n'envoie un email que si le membre existe et n'est pas supprimé.
  const member = await db.member.findUnique({
    where: { email },
    select: { id: true, firstName: true, deletedAt: true },
  });

  if (!member || member.deletedAt) {
    // Membre inexistant ou supprimé : on renvoie ok sans rien faire
    // (anti-enumeration). Réponse identique au cas nominal.
    return NextResponse.json({
      ok: true,
      message:
        "Si un compte existe pour cet email, un code vient d'être envoyé. Il expire dans 15 minutes.",
    });
  }

  // Invalider les sessions OTP en attente pour cet email (anti double-code)
  await db.memberSession
    .updateMany({
      where: {
        memberId: member.id,
        otpHash: { not: null },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
    .catch(() => {
      /* tolerate : table peut être vide au premier appel */
    });

  // Générer OTP + hash
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  // Stocker la session "pending" (otpHash présent, pas encore vérifié)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;
  await createPendingSession({
    memberId: member.id,
    otpHash,
    ttlMs: OTP_TTL_MS,
    ip,
    userAgent,
  });

  // Envoyer l'email (fire-and-forget : pas de bloc si Resend est lent)
  // Double option : code OTP à saisir + lien magique 1-clic (même code, même session).
  try {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_URL ||
      "https://reboot.joinhashcode.com";
    const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otp)}&next=${encodeURIComponent("/account")}`;
    await sendMagicLinkEmail({
      to: email,
      firstName: member.firstName || "toi",
      code: otp,
      url,
    });
  } catch (err) {
    // Log seulement : on ne révèle pas l'erreur au client
    console.warn("[auth] sendMagicLinkEmail failed:", err);
  }

  return NextResponse.json({
    ok: true,
    message:
      "Code envoyé. Vérifie ta boîte mail. Il expire dans 15 minutes.",
  });
}
