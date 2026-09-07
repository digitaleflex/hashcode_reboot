/**
 * Génération + hash + vérification d'OTP pour les sessions membre (magic link).
 *
 * - OTP : 6 chiffres, généré via crypto.randomInt (uniformément distribué)
 * - Hash : bcrypt (12 rounds)
 * - Durée de vie : 15 minutes
 * - Max 3 tentatives par session (incrémenté côté DB par le caller)
 *
 * Pourquoi un hash bcrypt et pas un simple SHA-256 : si la DB fuite,
 * les OTP hashed restent résistants au bruteforce.
 */

import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 15 * 60 * 1000; // 15 min
export const MAX_OTP_ATTEMPTS = 3;

/** Génère un OTP en clair (6 chiffres). À envoyer par email, jamais à stocker tel quel. */
export function generateOtp(): string {
  // randomInt(min, max+1) → uniformément distribué dans [min, max+1[
  // On veut 100000..999999 → randomInt(100000, 1000000) qui exclut 1000000.
  return String(randomInt(100_000, 1_000_000));
}

/** Hash un OTP. À stocker dans la DB avant d'envoyer l'email. */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 12);
}

/**
 * Compare un OTP en clair à un hash bcrypt. Résistant au timing attack.
 * Renvoie false si l'un des inputs est vide (sécurité).
 */
export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  if (!otp || !hash) return false;
  try {
    return await bcrypt.compare(otp, hash);
  } catch {
    return false;
  }
}

/** Valide le format d'un OTP soumis par l'utilisateur (6 chiffres). */
export function isValidOtpFormat(otp: unknown): otp is string {
  return typeof otp === "string" && /^\d{6}$/.test(otp.trim());
}
