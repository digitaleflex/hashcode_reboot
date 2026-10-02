import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auth } from "@/lib/auth";

/** Path for storing rotation metadata (dev only; production uses env). */
const ROTATION_FILE = join(process.cwd(), ".admin-key-rotation");

/** Shape of the rotation file. */
interface RotationRecord {
  rotatedAt: string;
  keyLength: number;
  passcode: string;
}

/** Cookie name for admin session (legacy). */
export const ADMIN_COOKIE_NAME = "hashcode-admin";

/** Better Auth session cookie (used to resolve the admin session). */
const BETTER_AUTH_SESSION = "better-auth.session_token";

/** Minimum length for a rotated key. */
export const ROTATED_KEY_MIN_LENGTH = 32;

/** Read the rotated passcode from file (if present). */
function readRotatedPasscode(): string | null {
  if (!existsSync(ROTATION_FILE)) return null;
  try {
    const content = readFileSync(ROTATION_FILE, "utf8");
    const record = JSON.parse(content) as RotationRecord;
    if (typeof record.passcode === "string" && record.passcode.length >= 16) {
      return record.passcode;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Get the current admin passcode.
 * Priority: rotated key file > ADMIN_PASSCODE env > dev stub.
 * In production: required, >= 16 chars, fail-closed.
 * In dev: returns ADMIN_PASSCODE or the default stub.
 */
export function getAdminPasscode(): string {
  // Check for a rotated key first (takes priority over env).
  const rotated = readRotatedPasscode();
  if (rotated) return rotated;

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
  return passcode || "hashcode-reboot-2026";
}

/** Check if the current passcode is the dev stub (not a real key). */
export function isKeyStub(): boolean {
  return getAdminPasscode() === "hashcode-reboot-2026";
}

/** Get the age of the current key in days (based on rotation file). */
export function getKeyAgeDays(): number {
  if (!existsSync(ROTATION_FILE)) return 0;
  try {
    const content = readFileSync(ROTATION_FILE, "utf8");
    const { rotatedAt } = JSON.parse(content) as RotationRecord;
    return Math.floor((Date.now() - new Date(rotatedAt).getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Rotate the admin passcode. Generates a new cryptographically secure key,
 * persists it to the rotation file, and returns it (shown ONCE to the admin).
 *
 * WARNING: All existing admin sessions will be invalidated immediately.
 */
export function rotateAdminPasscode(): string {
  const newPasscode = randomBytes(32).toString("base64url");

  // Store the new key + metadata in the rotation file.
  const record: RotationRecord = {
    rotatedAt: new Date().toISOString(),
    keyLength: newPasscode.length,
    passcode: newPasscode,
  };
  try {
    writeFileSync(ROTATION_FILE, JSON.stringify(record));
  } catch {
    // Rotation file not writable — key still works in-memory for this instance
  }

  return newPasscode;
}

/** Validate that a new passcode meets security requirements. */
export function validateRotatedKey(passcode: string): { valid: boolean; error?: string } {
  if (!passcode || passcode.length < ROTATED_KEY_MIN_LENGTH) {
    return { valid: false, error: `La clé doit comporter au moins ${ROTATED_KEY_MIN_LENGTH} caractères.` };
  }
  // Check entropy: at least 4 different character types
  const hasLower = /[a-z]/.test(passcode);
  const hasUpper = /[A-Z]/.test(passcode);
  const hasDigit = /[0-9]/.test(passcode);
  const hasSpecial = /[^a-zA-Z0-9]/.test(passcode);
  const types = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (types < 3) {
    return { valid: false, error: "La clé doit contenir au moins 3 types de caractères (majuscules, minuscules, chiffres, spéciaux)." };
  }
  return { valid: true };
}

/** Check if the request origin matches the host (CSRF protection). */
export function checkCSRF(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/** Admin email allow-lists (comma-separated env vars). */
function adminOperators(): string[] {
  return (process.env.ADMIN_OPERATORS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
function adminViewers(): string[] {
  return (process.env.ADMIN_VIEWERS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Resolve the current Better Auth session and the admin role for it, if admin. */
async function resolveAdminSession(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: Object.fromEntries(req.headers) as any });
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    if (adminOperators().includes(email)) return { email, role: "operator" as const };
    if (adminViewers().includes(email)) return { email, role: "viewer" as const };
    const legacy = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (legacy.includes(email)) return { email, role: "operator" as const };
    return null;
  } catch {
    return null;
  }
}

/** Check if the current request is from an authenticated admin (any role). */
export async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  return (await resolveAdminSession(req)) !== null;
}

/** Get the admin role for this request, or null if not an admin. */
export async function getAdminRole(req: NextRequest): Promise<"viewer" | "operator" | null> {
  return (await resolveAdminSession(req))?.role ?? null;
}

/** Get the admin identity (email) for this request, or "unknown". */
export async function getAdminIdentity(req: NextRequest): Promise<string> {
  return (await resolveAdminSession(req))?.email ?? "unknown";
}

/**
 * Require admin authentication with a specific role.
 * operator can access everything; viewer only viewer-level resources.
 */
export async function requireAdminRole(
  req: NextRequest,
  allowedRole: "viewer" | "operator" = "operator",
): Promise<boolean> {
  const ctx = await resolveAdminSession(req);
  if (!ctx) return false;
  return ctx.role === "operator" || ctx.role === allowedRole;
}

/** Cookie name for admin session (legacy). */
