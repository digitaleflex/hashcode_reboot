/**
 * Authentification des membres (non-admin) via magic link.
 *
 * - Cookie `hashcode_session` (httpOnly, Secure en prod, SameSite=Lax)
 * - Durée 30 jours, sliding window (refresh à chaque requête)
 * - Le cookie contient le sessionId, le reste est en DB
 *
 * Fonctions principales :
 *   - createSession() : crée une session après OTP vérifié
 *   - getSession() : lit le cookie, vérifie la session en DB
 *   - setSessionCookie() / clearSessionCookie() : manipulation cookie
 *   - destroySession() : soft-revoke (logout)
 *
 * Note : ce module est utilisé côté serveur (API routes, middleware, server
 * components). Pas d'import depuis des fichiers "use client".
 */

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const SESSION_COOKIE_NAME = "hashcode_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

const isProd = process.env.NODE_ENV === "production";

/** Construit les options du cookie de session. */
function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

/** Set le cookie de session sur la réponse (utilisé dans les API routes). */
export function setSessionCookieOnResponse(
  res: Response,
  sessionId: string,
  expiresAt: Date,
): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Path=/`,
    `Expires=${expiresAt.toUTCString()}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (isProd) parts.push("Secure");
  res.headers.append("Set-Cookie", parts.join("; "));
}

/** Set le cookie de session dans Next.js (utilisé dans server actions / pages). */
export async function setSessionCookie(sessionId: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    ...cookieOptions(expiresAt),
  });
}

/** Supprime le cookie (logout). */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Crée une session en DB et retourne son id + expiration. */
export async function createSession(args: {
  memberId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await db.memberSession.create({
    data: {
      memberId: args.memberId,
      otpHash: null, // OTP déjà consommé
      expiresAt,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
    },
  });
  return { id: session.id, expiresAt };
}

/**
 * Crée une session "en attente d'OTP" (otpHash présent, pas encore vérifié).
 * Renvoie la session créée.
 */
export async function createPendingSession(args: {
  memberId: string;
  otpHash: string;
  ttlMs: number;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const expiresAt = new Date(Date.now() + args.ttlMs);
  return db.memberSession.create({
    data: {
      memberId: args.memberId,
      otpHash: args.otpHash,
      expiresAt,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
    },
  });
}

/**
 * Lit la session active depuis le cookie de la requête.
 * Renvoie null si :
 *   - pas de cookie
 *   - session introuvable
 *   - session expirée
 *   - session révoquée
 *   - membre soft-deleted
 *
 * Met à jour lastSeenAt (sliding window) si la session est valide.
 */
export async function getSession(req?: NextRequest) {
  // Member authentication now uses Better Auth (session cookie
  // `better-auth.session_token`). Keep the legacy return shape so all
  // existing server routes / pages continue to work: they only rely on
  // `session.member`, `session.memberId`, `session.id`, `lastSeenAt`...
  let headersObj: Record<string, string> = {};
  if (req) {
    headersObj = Object.fromEntries(req.headers.entries());
  } else {
    try {
      const { headers } = await import("next/headers");
      headersObj = Object.fromEntries((await headers()).entries());
    } catch {
      return null;
    }
  }

  const authSession = await auth.api
    .getSession({ headers: headersObj as any })
    .catch(() => null);
  const email = authSession?.user?.email;
  if (!email) return null;

  const member = await db.member.findUnique({ where: { email } }).catch(() => null);
  if (!member || member.deletedAt) return null;

  return {
    id: authSession?.session?.id ?? member.id,
    memberId: member.id,
    member,
    createdAt: member.createdAt,
    lastSeenAt: new Date(),
    expiresAt: authSession?.session?.expiresAt ?? new Date(Date.now() + SESSION_TTL_MS),
    revokedAt: null as Date | null,
    otpHash: null as string | null,
    ip: authSession?.session?.ipAddress ?? null,
    userAgent: authSession?.session?.userAgent ?? null,
  };
}

/** Révoque une session (logout). */
export async function destroySession(sessionId: string): Promise<void> {
  await db.memberSession
    .update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    })
    .catch(() => {
      /* swallow : la session peut déjà être supprimée */
    });
}

/** Révoque toutes les sessions actives d'un membre (utilisé par "déconnecter partout"). */
export async function destroyAllSessions(memberId: string): Promise<number> {
  const res = await db.memberSession.updateMany({
    where: { memberId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
