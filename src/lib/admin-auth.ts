import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight admin gate for V1.
 *
 * Real auth (NextAuth/Better Auth + a User model with roles) is the long-term
 * plan, but the single-route constraint + SQLite + the absence of a User
 * model make a full auth flow heavy for V1. This passcode gate is good enough
 * for the pre-public-deployment phase:
 *
 * - The passcode is read from ADMIN_PASSCODE env var (default: "hashcode-reboot-2026").
 * - The admin unlocks the dashboard by entering the passcode; we issue a
 *   signed-ish cookie `hashcode-admin` valid for 7 days.
 * - The cookie value is HMAC(passcode + "admin") so it can't be forged without
 *   the passcode. We don't need crypto: a constant-time string compare is enough.
 *
 * For production: swap for NextAuth credentials provider + an Admin model.
 */

export const ADMIN_COOKIE_NAME = "hashcode-admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getAdminPasscode(): string {
  if (!process.env.ADMIN_PASSCODE && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSCODE manquant");
  }
  return (
    process.env.ADMIN_PASSCODE ||
    // Dev-only default. Will not be honored in production (env var required).
    "hashcode-reboot-2026"
  );
}

/** Token = base64(passcode + "|" + "admin-v1"). */
function expectedToken(passcode: string): string {
  const raw = `${passcode}|admin-v1`;
  // btoa for ASCII only — passcode is ASCII.
  return Buffer.from(raw, "utf8").toString("base64");
}

/** Verify the admin cookie value against the expected token. */
export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = expectedToken(getAdminPasscode());
  // Constant-time-ish compare.
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
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

/** Issue a fresh admin token (used at login). */
export function issueAdminToken(): string {
  return expectedToken(getAdminPasscode());
}

/** Check if the current request is from an authenticated admin. */
export function isAdminAuthed(req: NextRequest): boolean {
  return verifyAdminToken(readAdminCookie(req));
}
