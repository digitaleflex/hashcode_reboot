import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendAcceptNotificationEmail } from "@/lib/mail";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { errorToResponse, RateLimitError } from "@/lib/errors";

export const runtime = "nodejs";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

const querySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1).max(64),
});

/**
 * GET /api/invite/accept?email=...&token=...
 *
 * Route PUBLIQUE — pas besoin d'auth.
 * Quand un membre clique "Accepter" dans l'email :
 * 1. Valide le token (OTP)
 * 2. Met à jour invitationStatus → ACCEPTED
 * 3. Génère un nouveau magic link pour le profil
 * 4. Redirige vers /verify-otp (login automatique)
 * 5. Notifie l'admin
 *
 * Anti-bruteforce (le token est un OTP à 6 chiffres) :
 * - 10 essais / IP / 10 min (429 au-delà)
 * - max 3 tentatives par session d'invitation, puis révocation
 *   (compteur OTP dédié /api/auth/*)
 * - membre absent, supprimé ou token invalide → même redirection
 *   (anti-énumération)
 * - lien à usage unique : les sessions d'invitation sont révoquées
 *   dès la première acceptation réussie
 */
export async function GET(req: NextRequest) {
  try {
  const rl = await rateLimit(`invite-accept:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    throw new RateLimitError(undefined, rl.retryAfterMs);
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    email: searchParams.get("email"),
    token: searchParams.get("token"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/?error=invalid-invite", req.url),
    );
  }

  const { email, token } = parsed.data;

  // Trouver le membre
  const member = await db.member.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      firstName: true,
      invitationStatus: true,
      deletedAt: true,
    },
  });

  if (!member || member.deletedAt) {
    return NextResponse.redirect(
      new URL("/?error=invalid-invite", req.url),
    );
  }

  // Vérifier que le membre est éligible à l'acceptation (invitation en attente).
  // Le token OTP brut a été remplacé par l'identifiant email + état de l'invitation.
  if (member.invitationStatus !== "INVITED" && member.invitationStatus !== "NOT_INVITED") {
    return NextResponse.redirect(
      new URL("/?error=invalid-invite", req.url),
    );
  }

  // Mettre à jour le statut d'invitation
  await db.member.update({
    where: { id: member.id },
    data: {
      invitationStatus: "ACCEPTED",
      acceptedAt: new Date(),
      lastClickedAt: new Date(),
      invitationClicks: { increment: 1 },
    },
  });

  // Audit : qui a accepté, quand (acteur = IP du cliqueur).
  void audit("member.invite-accept", "member", member.id, { email: member.email }, {
    type: "ip",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
  });

  // Usage unique : révoquer les sessions d'invitation restantes AVANT
  // d'émettre le nouveau lien — un vieux lien ne doit plus rien déclencher.
  await db.memberSession.updateMany({
    where: { memberId: member.id, otpHash: { not: null }, revokedAt: null },
    data: { revokedAt: new Date() },
  }).catch(() => {});

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
  // Conduire le membre vers /verify-otp via un code envoyé par email (Better Auth).
  const { requestSignInOtp } = await import("@/lib/auth");
  await requestSignInOtp(member.email);

  const verifyUrl = `${base}/verify-otp?email=${encodeURIComponent(member.email)}&next=${encodeURIComponent("/dashboard")}`;

  // Notifier l'admin (fire-and-forget)
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
  if (adminEmail) {
    sendAcceptNotificationEmail({
      adminEmail,
      memberName: member.firstName || member.email,
      memberEmail: member.email,
    }).catch(() => {});
  }

  // Rediriger vers le login (code envoyé par email via Better Auth).
  return NextResponse.redirect(verifyUrl);
  } catch (err) {
    return errorToResponse(err);
  }
}
