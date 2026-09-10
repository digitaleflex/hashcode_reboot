import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateOtp, hashOtp } from "@/lib/account-otp";
import { createPendingSession } from "@/lib/account-auth";
import { sendAcceptNotificationEmail } from "@/lib/mail";
import { audit } from "@/lib/admin-audit";

export const runtime = "nodejs";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 min pour compléter le profil

const querySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
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
 */
export async function GET(req: NextRequest) {
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
    select: { id: true, email: true, firstName: true, invitationStatus: true },
  });

  if (!member) {
    return NextResponse.redirect(
      new URL("/?error=member-not-found", req.url),
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

  // Vérifier si le token correspond à l'un des OTPs
  let matched = false;
  for (const session of sessions) {
    if (session.otpHash) {
      const bcrypt = await import("bcryptjs");
      const ok = await bcrypt.compare(token, session.otpHash);
      if (ok) {
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    return NextResponse.redirect(
      new URL("/?error=invalid-token", req.url),
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
