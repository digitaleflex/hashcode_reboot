import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  MAX_OTP_ATTEMPTS,
} from "@/lib/account-otp";
import { createPendingSession } from "@/lib/account-auth";
import { sendAcceptNotificationEmail } from "@/lib/mail";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 min pour compléter le profil

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
 *   (même compteur que /api/auth/verify-otp)
 * - membre absent, supprimé ou token invalide → même redirection
 *   (anti-énumération)
 * - lien à usage unique : les sessions d'invitation sont révoquées
 *   dès la première acceptation réussie
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimit(`invite-accept:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
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

  // Vérifier qu'une session avec cet OTP existe et est valide
  const sessions = await db.memberSession.findMany({
    where: {
      memberId: member.id,
      otpHash: { not: null },
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Seules les sessions non épuisées sont testées.
  const candidates = sessions.filter(
    (s) => s.otpHash && s.attempts < MAX_OTP_ATTEMPTS,
  );

  // Vérifier si le token correspond à l'un des OTPs
  let matchedSession: (typeof sessions)[number] | null = null;
  for (const session of candidates) {
    if (session.otpHash && (await verifyOtpHash(token, session.otpHash))) {
      matchedSession = session;
      break;
    }
  }

  if (!matchedSession) {
    // Chaque échec consomme une tentative sur toutes les candidates ;
    // les sessions épuisées sont révoquées (forcent une nouvelle demande).
    if (candidates.length > 0) {
      const ids = candidates.map((s) => s.id);
      await db.memberSession.updateMany({
        where: { id: { in: ids } },
        data: { attempts: { increment: 1 } },
      });
      const exhausted = candidates
        .filter((s) => s.attempts + 1 >= MAX_OTP_ATTEMPTS)
        .map((s) => s.id);
      if (exhausted.length > 0) {
        await db.memberSession.updateMany({
          where: { id: { in: exhausted } },
          data: { revokedAt: new Date() },
        });
      }
    }
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
  });

  // Générer un nouveau magic link pour le login
  const newOtp = generateOtp();
  const newOtpHash = await hashOtp(newOtp);
  await createPendingSession({
    memberId: member.id,
    otpHash: newOtpHash,
    ttlMs: SESSION_TTL_MS,
    ip: req.headers.get("x-forwarded-for") || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  // Notifier l'admin (fire-and-forget)
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
  if (adminEmail) {
    sendAcceptNotificationEmail({
      adminEmail,
      memberName: member.firstName || member.email,
      memberEmail: member.email,
    }).catch(() => {});
  }

  // Rediriger vers le login avec le magic link
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
  const verifyUrl = `${base}/verify-otp?email=${encodeURIComponent(member.email)}&code=${encodeURIComponent(newOtp)}&next=${encodeURIComponent("/dashboard")}`;

  return NextResponse.redirect(verifyUrl);
}
