/**
 * HASHCODE REBOOT — Email blacklist.
 *
 * Gère la liste des emails bloqués à l'inscription.
 * - isEmailBlacklisted : check rapide (utilisé à l'inscription)
 * - addToBlacklist : ajoute (idempotent : si l'email existe déjà, on update expiresAt/note)
 * - removeFromBlacklist : retire
 * - getBlacklist : liste paginée
 *
 * Raisons autorisées (string libre, mais on documente les standards) :
 *   - "spammer"   : envois de spam / multi-comptes
 *   - "harassment": harcèlement d'un autre membre
 *   - "duplicate" : doublon d'identité
 *   - "abuser"    : usage abusif de la plateforme
 *   - "admin"     : décision manuelle de l'admin
 *   - "other"     : autre raison (note obligatoire)
 *
 * Pas de wildcards (*@gmail.com) — trop dangereux. Un email = une ligne.
 */

import { db } from "@/lib/db";

export const BLACKLIST_REASONS = [
  "spammer",
  "harassment",
  "duplicate",
  "abuser",
  "admin",
  "other",
] as const;

export type BlacklistReason = (typeof BLACKLIST_REASONS)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valide et normalise un email (lowercase, trim). Throw si invalide. */
export function normalizeEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) {
    throw new Error("Email invalide.");
  }
  if (trimmed.length > 254) {
    throw new Error("Email trop long (max 254 caractères).");
  }
  return trimmed;
}

/**
 * Vérifie si un email est blacklisté (actif = non expiré).
 * Rapide : une seule requête DB avec un index sur email.
 * Renvoie null si pas blacklisté, ou { reason, expiresAt } si oui.
 */
export async function isEmailBlacklisted(
  emailRaw: string,
): Promise<{ reason: string; expiresAt: Date | null } | null> {
  let email: string;
  try {
    email = normalizeEmail(emailRaw);
  } catch {
    return null;
  }
  const row = await db.memberBlacklist.findUnique({
    where: { email },
    select: { reason: true, expiresAt: true },
  });
  if (!row) return null;
  // Si expiré, on l'ignore (et on pourrait cleanup en cron, mais pas critique)
  if (row.expiresAt && row.expiresAt < new Date()) return null;
  return row;
}

/**
 * Ajoute un email à la blacklist (upsert : si l'email existe déjà, on update).
 * Renvoie l'entrée créée/mise à jour.
 */
export async function addToBlacklist(args: {
  email: string;
  reason: string;
  note?: string | null;
  expiresAt?: Date | null;
  autoAdded?: boolean;
}): Promise<{ id: string; email: string }> {
  const email = normalizeEmail(args.email);
  const note = args.note?.slice(0, 500) ?? null;
  const reason = args.reason || "other";
  if (!BLACKLIST_REASONS.includes(reason as BlacklistReason)) {
    throw new Error(`Raison invalide : "${reason}".`);
  }
  const row = await db.memberBlacklist.upsert({
    where: { email },
    create: {
      email,
      reason,
      note,
      expiresAt: args.expiresAt ?? null,
      autoAdded: args.autoAdded ?? false,
    },
    update: {
      reason,
      note,
      expiresAt: args.expiresAt ?? null,
      autoAdded: args.autoAdded ?? false,
    },
    select: { id: true, email: true },
  });
  return row;
}

/** Retire un email de la blacklist (no-op si l'email n'existe pas). */
export async function removeFromBlacklist(
  emailRaw: string,
): Promise<{ removed: boolean }> {
  let email: string;
  try {
    email = normalizeEmail(emailRaw);
  } catch {
    return { removed: false };
  }
  try {
    await db.memberBlacklist.delete({ where: { email } });
    return { removed: true };
  } catch {
    return { removed: false };
  }
}

/** Liste paginée de la blacklist (admin). */
export async function getBlacklist(args: {
  page: number;
  perPage: number;
  reason?: string;
  onlyActive?: boolean;
  search?: string;
}) {
  const where: Record<string, unknown> = {};
  if (args.reason) where.reason = args.reason;
  if (args.search) {
    where.email = { contains: args.search.toLowerCase() };
  }
  if (args.onlyActive) {
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ];
  }
  const [items, total] = await Promise.all([
    db.memberBlacklist.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.perPage,
      take: args.perPage,
    }),
    db.memberBlacklist.count({ where }),
  ]);
  return { items, total, page: args.page, perPage: args.perPage };
}
