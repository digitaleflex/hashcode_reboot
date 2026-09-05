import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin gate : passcode partagé + cookie de session stateless à expiration
 * vérifiée serveur.
 *
 * - Le passcode est lu depuis ADMIN_PASSCODE (en production : obligatoire et
 *   >= 16 caractères, sinon l'app plante au boot — fail closed).
 * - Au login, on émet un token `base64url(expiryEpochMs).base64url(signature)`
 *   où signature = HMAC-SHA256(passcode, expiryEpochMs). La vérification
 *   contrôle le format, la signature (timingSafeEqual) ET l'expiration.
 *   Durée de session : 12h, alignée sur le Max-Age du cookie.
 * - Pas de stockage serveur : la révocation d'une session = rotation du
 *   passcode (tous les tokens existants deviennent invalides d'un coup,
 *   puisqu'ils sont signés avec l'ancien passcode).
 * - Ne jamais logger ni retourner le passcode ou un token.
 * - Token de niveau rôle : admin-operator (émis avec rôle claim pour RBAC)
 */

export const ADMIN_COOKIE_NAME = "hashcode-admin";
/** Durée de session admin : 12h (émission + Max-Age cookie). */
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
export const ADMIN_COOKIE_MAX_AGE = ADMIN_SESSION_MS / 1000; // 12h en secondes

export function getAdminPasscode(): string {
  const passcode = process.env.ADMIN_PASSCODE;
  if (process.env.NODE_ENV === "production") {
    if (!passcode) {
      throw new Error(
        "ADMIN_PASSCODE manquant : définis un passcode admin (>= 16 caractères) avant le boot.",
      );
    }
    if (passcode.length < 16) {
      throw new Error(
        "ADMIN_PASSCODE trop faible : 16 caractères minimum requis en production.",
      );
    }
    return passcode;
  }
  return (
    passcode ||
    // Dev-only default. Will not be honored in production (env var required).
    "hashcode-reboot-2026"
  );
}

/** 
 * Token = base64url(expiryEpochMs).base64url(role).base64url(signature)
 * where signature = HMAC-SHA256(passcode, `${expiryB64}.${roleB64}`)
 */
function sign(passcode: string, data: string): string {
    return createHmac("sha256", passcode).update(data, "utf8").digest("base64url");
}

/** Verify the admin cookie value: format + signature + expiration. Never throws. */
export function verifyAdminToken(token: string | undefined | null): boolean {
    if (!token) return false;
    try {
        const firstDot = token.indexOf(".");
        if (firstDot <= 0) return false;
        const secondDot = token.indexOf(".", firstDot + 1);
        if (secondDot <= firstDot + 1 || secondDot === token.length - 1) return false;
        
        const expB64 = token.slice(0, firstDot);
        const roleB64 = token.slice(firstDot + 1, secondDot);
        const sigB64 = token.slice(secondDot + 1);
        
        const expiryStr = Buffer.from(expB64, "base64url").toString("utf8");
        if (!/^\d+$/.test(expiryStr)) return false;
        const expiry = Number(expiryStr);
        if (!Number.isSafeInteger(expiry) || expiry <= Date.now()) return false;
        
        const dataToSign = `${expB64}.${roleB64}`;
        const expectedSig = sign(getAdminPasscode(), dataToSign);
        
        const a = Buffer.from(sigB64, "utf8");
        const b = Buffer.from(expectedSig, "utf8");
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
    } catch {
        // If ADMIN_PASSCODE is not configured (e.g. production without env var),
        // getAdminPasscode() throws. We catch it and return false instead of
        // crashing the whole page render.
        return false;
    }
}

/** Read the admin cookie from a request. */
export function readAdminCookie(req: NextRequest): string | undefined {
  return req.cookies.get(ADMIN_COOKIE_NAME)?.value;
}

/** Build a Set-Cookie header value for the admin token (login) or clear (logout). */
export function adminCookieHeader(token: string | null): string {
  // Local dev runs over http — Secure only in production.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (token === null) {
    return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
  }
  return `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${ADMIN_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

/** Issue a fresh admin token, expiring 12h from now (used at login). */
export function issueAdminToken(role: "viewer" | "operator" = "operator"): string {
    const expiryStr = String(Date.now() + ADMIN_SESSION_MS);
    const expB64 = Buffer.from(expiryStr, "utf8").toString("base64url");
    const roleB64 = Buffer.from(role, "utf8").toString("base64url");
    const dataToSign = `${expB64}.${roleB64}`;
    const sigB64 = sign(getAdminPasscode(), dataToSign);
    return `${expB64}.${roleB64}.${sigB64}`;
}

/** Check if the current request is from an authenticated admin. */
export function isAdminAuthed(req: NextRequest): boolean {
  return verifyAdminToken(readAdminCookie(req));
}

/** Extract role from token (internal helper). Returns null if token is malformed/invalid. */
function extractRoleFromToken(token: string): string | null {
  try {
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const rest = token.slice(dot + 1);
    const secondDot = rest.indexOf(".");
    if (secondDot < 0) return null;
    const roleB64 = rest.slice(secondDot + 1);
    return Buffer.from(roleB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** Return the role from the admin token if valid, otherwise null. */
export function getAdminRoleFromToken(token: string | undefined | null): "viewer" | "operator" | null {
  if (!token) return null;
  if (!verifyAdminToken(token)) return null;
  const roleStr = extractRoleFromToken(token);
  if (!roleStr) return null;
  if (roleStr === "viewer" || roleStr === "operator") return roleStr as "viewer" | "operator";
  return null;
}
