import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { verifyOtpHash, isValidOtpFormat, MAX_OTP_ATTEMPTS } from "@/lib/account-otp";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  setSessionCookieOnResponse,
} from "@/lib/account-auth";

export const runtime = "nodejs";

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  otp: z.string().trim(),
});

/**
 * POST /api/auth/verify-otp
 *
 * Vérifie le code OTP soumis, et si OK crée une session active :
 *   - Marque la session pending comme vérifiée (otpHash = null)
 *   - Refresh expiresAt à +30 jours
 *   - Set le cookie hashcode_session
 *
 * Anti-bruteforce : 10 tentatives / IP / 10 min
 * Anti-abus membre : max 3 tentatives par session (incrémenté en DB)
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`verify-otp:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "Trop de tentatives. Réessaie dans quelques minutes.",
        code: "RATE_LIMITED",
      },
      { status: 429 },
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

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const { email, otp } = parsed.data;

  if (!isValidOtpFormat(otp)) {
    return NextResponse.json(
      {
        error: "Le code doit être composé de 6 chiffres.",
        code: "INVALID_OTP_FORMAT",
      },
      { status: 422 },
    );
  }

  // Trouver le membre
  const member = await db.member.findUnique({
    where: { email },
    select: { id: true, deletedAt: true, invitationStatus: true },
  });
  if (!member || member.deletedAt) {
    // Anti-enumeration : même message que "code invalide"
    return NextResponse.json(
      { error: "Code invalide ou expiré.", code: "INVALID_CODE" },
      { status: 401 },
    );
  }

  // Trouver la session pending la plus récente
  const session = await db.memberSession.findFirst({
    where: {
      memberId: member.id,
      otpHash: { not: null },
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!session || !session.otpHash) {
    return NextResponse.json(
      { error: "Code invalide ou expiré.", code: "INVALID_CODE" },
      { status: 401 },
    );
  }

  // Trop de tentatives ?
  if (session.attempts >= MAX_OTP_ATTEMPTS) {
    // Révoquer la session pour forcer une nouvelle demande
    await db.memberSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json(
      {
        error: "Trop de tentatives. Demande un nouveau code.",
        code: "LOCKED",
      },
      { status: 401 },
    );
  }

  // Vérifier le code
  const ok = await verifyOtpHash(otp, session.otpHash);
  if (!ok) {
    // Incrémenter les tentatives (et révoquer si > MAX)
    const newAttempts = session.attempts + 1;
    const revoke = newAttempts >= MAX_OTP_ATTEMPTS;
    await db.memberSession.update({
      where: { id: session.id },
      data: {
        attempts: newAttempts,
        ...(revoke ? { revokedAt: new Date() } : {}),
      },
    });
    return NextResponse.json(
      revoke
        ? {
            error: "Trop de tentatives. Demande un nouveau code.",
            code: "LOCKED",
          }
        : {
            error: "Code invalide ou expiré.",
            code: "INVALID_CODE",
            remaining: MAX_OTP_ATTEMPTS - newAttempts,
          },
      { status: 401 },
    );
  }

  // Succès : activer la session (otpHash = null, refresh expiresAt)
  const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.memberSession.update({
    where: { id: session.id },
    data: {
      otpHash: null,
      attempts: 0,
      expiresAt: newExpiresAt,
      lastSeenAt: new Date(),
    },
  });

  // Les liens magiques envoyés par les campagnes d'invitation contournent
  // /api/invite/accept. Marquer l'invitation comme acceptée ici, sinon le
  // dashboard reste figé sur INVITED alors que le membre s'est connecté.
  const isInviteLogin =
    session.userAgent === "admin-import-invite" ||
    session.userAgent === "admin-invite-relance";
  if (
    isInviteLogin &&
    (member.invitationStatus === "INVITED" ||
      member.invitationStatus === "NOT_INVITED")
  ) {
    try {
      await db.member.update({
        where: { id: member.id },
        data: {
          invitationStatus: "ACCEPTED",
          lastClickedAt: new Date(),
          invitationClicks: { increment: 1 },
        },
      });
    } catch {
      // Best-effort : la connexion reste valide même si le statut échoue.
    }
  }

  // Construire la réponse avec le cookie
  const res = NextResponse.json({
    ok: true,
    message: "Connexion réussie.",
    redirect: "/dashboard",
  });
  setSessionCookieOnResponse(res, session.id, newExpiresAt);
  return res;
}
