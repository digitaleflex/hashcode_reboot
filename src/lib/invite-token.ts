import crypto from "crypto";

/**
 * Jeton signé pour le refus d'invitation (sans état en base).
 * HMAC-SHA256 de l'email avec un secret dédié — vérifiable côté serveur.
 */
const SECRET =
  process.env.INVITE_REFUSE_SECRET ||
  process.env.CRON_SECRET ||
  "invite-refuse-fallback";

export function makeRefuseToken(email: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(email.trim().toLowerCase())
    .digest("base64url");
}

export function verifyRefuseToken(email: string, token: string): boolean {
  const expected = makeRefuseToken(email);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}

export function buildRefuseUrl(email: string, base: string): string {
  const token = makeRefuseToken(email);
  return `${base.replace(/\/$/, "")}/invite/refuse?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
}