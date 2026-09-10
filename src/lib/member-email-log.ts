import { db } from "@/lib/db";

/**
 * Traçage des envois d'emails par lot (anti-doublon).
 *
 * Chaque email de campagne effectivement envoyé à un membre est enregistré
 * dans MemberEmailLog. Les routes de lot (relance, annonce, import) doivent
 * exclure les membres déjà loggés pour le même `kind` avant d'envoyer.
 */
export type MemberEmailKind =
  | "invite"
  | "relance"
  | "annonce"
  | "rejoin"
  | "engagement";

/** Enregistre un envoi (best-effort : n'échoue jamais l'envoi parent). */
export async function logMemberEmail(input: {
  memberId: string;
  email: string;
  kind: MemberEmailKind;
  provider?: string;
  providerId?: string;
}): Promise<void> {
  try {
    await db.memberEmailLog.create({
      data: {
        memberId: input.memberId,
        email: input.email,
        kind: input.kind,
        provider: input.provider ?? null,
        providerId: input.providerId ?? null,
      },
    });
  } catch {
    /* best-effort */
  }
}

/** IDs des membres ayant déjà reçu un envoi de ce `kind`. */
export async function memberIdsWithEmailLog(
  memberIds: string[],
  kind: MemberEmailKind,
): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  try {
    const rows = await db.memberEmailLog.findMany({
      where: { memberId: { in: memberIds }, kind },
      select: { memberId: true },
    });
    return new Set(rows.map((r) => r.memberId));
  } catch {
    return new Set();
  }
}
