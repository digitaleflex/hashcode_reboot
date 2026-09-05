import bcrypt from "bcryptjs";
import { createHmac, randomUUID } from "node:crypto";
import { db } from "./db";
import { getAdminPasscode } from "./admin-auth";

const SALT_ROUNDS = 12;

/** Hash a passcode for persistent storage (bcrypt). */
export async function hashPasscodeForStorage(passcode: string): Promise<string> {
  return bcrypt.hash(passcode, SALT_ROUNDS);
}

/** Verify a passcode against a stored bcrypt hash. */
export async function verifyStoredPasscode(
  passcode: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(passcode, hash);
  } catch {
    return false;
  }
}

/**
 * HMAC-based passcode hashing for session signing (NOT for storage).
 * This is used by admin-auth.ts for HMAC-SHA256 token signing — kept here
 * for reference. The bcrypt-based hashPasscodeForStorage is for stored keys.
 */
export function hmacPasscode(passcode: string): string {
  return createHmac("sha256", getAdminPasscode())
    .update(passcode)
    .digest("base64url");
}

/**
 * Rotate admin keys: revoke all current active keys, create new one with bcrypt hash.
 */
export async function rotateAdminKey(
  newPasscode: string,
): Promise<{ kid: string; ok: boolean }> {
  const kid = `kid-${randomUUID().slice(0, 8)}`;
  const passcodeHash = await hashPasscodeForStorage(newPasscode);

  await db.$transaction([
    db.adminKey.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.adminKey.create({
      data: {
        kid,
        passcodeHash,
        createdAt: new Date(),
        expiresAt: null,
        revokedAt: null,
      },
    }),
  ]);

  return { kid, ok: true };
}
