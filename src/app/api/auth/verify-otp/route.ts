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
import { audit } from "@/lib/admin-audit";
import {
  errorToResponse,
  parseJsonBody,
  RateLimitError,
  ValidationError,
  InvalidCodeError,
  LockedError,
} from "@/lib/errors";

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
  try {
    const rl = await rateLimit(`verify-otp:${rateKey(req)}`, {
      capacity: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      throw new RateLimitError(undefined, rl.retryAfterMs);
    }

    const body = await parseJsonBody(req);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Données invalides.", parsed.error.issues);
    }
    const { email, otp } = parsed.data;

    if (!isValidOtpFormat(otp)) {
      throw new ValidationError("Le code doit être composé de 6 chiffres.", {
        code: "INVALID_OTP_FORMAT",
      });
    }

    // Trouver le membre
    const member = await db.member.findUnique({
      where: { email },
      select: { id: true, deletedAt: true, invitationStatus: true },
    });
    if (!member || member.deletedAt) {
      // Anti-enumeration : même message que "code invalide"
      throw new InvalidCodeError();
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
      throw new InvalidCodeError();
    }

    // Trop de tentatives ?
    if (session.attempts >= MAX_OTP_ATTEMPTS) {
      // Révoquer la session pour forcer une nouvelle demande
      await db.memberSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new LockedError();
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
      if (revoke) {
        throw new LockedError();
      }
      throw new InvalidCodeError(undefined, MAX_OTP_ATTEMPTS - newAttempts);
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
            acceptedAt: new Date(),
            lastClickedAt: new Date(),
            invitationClicks: { increment: 1 },
          },
        });
        void audit("member.invite-accept", "member", member.id, {
          via: "verify-otp",
          inviteSession: session.userAgent,
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
  } catch (err) {
    return errorToResponse(err);
  }
}
