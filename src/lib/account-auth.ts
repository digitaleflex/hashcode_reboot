/**
 * Authentification membre — pont vers Better Auth.
 *
 * Les membres se connectent via Better Auth (cookie
 * `better-auth.session_token`, tables Session/User/Verification).
 * Ce module expose `getSession()` dans la forme historique attendue par les
 * pages/routes serveurs (`session.member`, `session.memberId`, …).
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth, getMemberFromRequest } from "@/lib/auth";
import { isEmailBlacklisted } from "@/lib/blacklist";

export const SESSION_COOKIE_NAME = "better-auth.session_token";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

/**
 * Lit la session Better Auth courante (via les headers de la requête, ou
 * de `next/headers` si pas d'objet NextRequest). Renvoie un objet compatible
 * avec l'ancien `MemberSession` quand la session est valide et le membre actif.
 */
export async function getSession(req?: NextRequest) {
  // Fast path: resolve the member through the shared helper.
  if (req) {
    const member = await getMemberFromRequest(req);
    if (!member || member.deletedAt) return null;

    // Tue les sessions antérieures au blacklistage : un email blacklisté après
    // connexion perd l'accès dès le prochain appel, même avec un cookie valide.
    // Note perf assumée : getSession() est le chemin chaud de l'app (chaque
    // page dashboard) — on ajoute 1 lecture point sur la colonne `email`
    // @unique (indexée) de MemberBlacklist. Sécurité > micro-perf : ce coût
    // est accepté tel quel, sans cache qui masquerait un déblacklistage.
    // Fail-closed : en cas d'erreur DB, on refuse la session (doute = refus).
    try {
      if (await isEmailBlacklisted(member.email)) return null;
    } catch {
      return null;
    }

    // Session metadata (id, expiry, ip/UA) for the historical shape.
    const authSession = await auth.api
      .getSession({ headers: Object.fromEntries(req.headers.entries()) as any })
      .catch(() => null);

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

  let headersObj: Record<string, string> = {};
  try {
    const { headers } = await import("next/headers");
    headersObj = Object.fromEntries((await headers()).entries());
  } catch {
    return null;
  }

  const authSession = await auth.api
    .getSession({ headers: headersObj as any })
    .catch(() => null);
  const email = authSession?.user?.email;
  if (!email) return null;

  const member = await db.member.findUnique({ where: { email } }).catch(() => null);
  if (!member || member.deletedAt) return null;

  // Tue les sessions antérieures au blacklistage : un email blacklisté après
  // connexion perd l'accès dès le prochain appel, même avec un cookie valide.
  // Note perf assumée : getSession() est le chemin chaud de l'app (chaque
  // page dashboard) — on ajoute 1 lecture point sur la colonne `email`
  // @unique (indexée) de MemberBlacklist. Sécurité > micro-perf : ce coût
  // est accepté tel quel, sans cache qui masquerait un déblacklistage.
  // Fail-closed : en cas d'erreur DB, on refuse la session (doute = refus).
  try {
    if (await isEmailBlacklisted(email)) return null;
  } catch {
    return null;
  }

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

/** Révoque une session Better Auth (logout). */
export async function destroySession(sessionId: string): Promise<void> {
  try {
    await db.session.delete({ where: { id: sessionId } });
  } catch {
    /* ignore : peut déjà être supprimée */
  }
}

/** Révoque toutes les sessions Better Auth d'un membre. */
export async function destroyAllSessions(memberId: string): Promise<number> {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { email: true },
  });
  if (!member?.email) return 0;
  const res = await db.session.deleteMany({ where: { user: { email: member.email } } });
  return res.count;
}
