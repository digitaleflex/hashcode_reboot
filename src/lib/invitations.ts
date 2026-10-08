/**
 * HASHCODE REBOOT — Expiration paresseuse des invitations (#213).
 *
 * Constat : `invitationStatus = "EXPIRED"` (preuve `handoff_failure`,
 * lue par `deriveState` → `HANDOFF_FAILED`) n'avait AUCUN écrivain —
 * seule la lecture existait (`src/lib/acquisition-state.ts`). Ce module
 * fournit l'écriture manquante, sans toucher ni `GET /api/community/join`
 * ni les crons : le balayage est déclenché par la lecture admin
 * (`GET /api/admin/invitations`, qui affiche le compteur EXPIRED),
 * best-effort, jamais bloquant.
 *
 * - TTL = 72 h, calé sur le lien magique d'invitation (même valeur que
 *   `INVITE_TTL_MS` dans `src/app/api/invite/relance/route.ts` et
 *   `src/app/api/admin/import-invite/route.ts` — duplication assumée,
 *   ces routes restent inchangées).
 * - N'expire que les lignes INVITED datées (`invitedAt` non nul et plus
 *   vieux que le TTL), jamais un membre JOINED, jamais un soft-deleted.
 * - `Member` reste la source d'écriture : aucun événement analytics émis
 *   ici (analytics = preuve, jamais vérité) ; aucune table créée,
 *   aucune migration.
 */

import { db } from "@/lib/db";

/** TTL du lien d'invitation : 72 h (lien magique 1-clic). */
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * Pur : une invitation est périmée si `invitedAt` est renseigné et plus
 * vieux que le TTL. `invitedAt` nul = âge improuvable → jamais périmé.
 */
export function isInvitationStale(
  invitedAt: Date | string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!invitedAt) return false;
  const t = invitedAt instanceof Date ? invitedAt.getTime() : new Date(invitedAt).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t > INVITE_TTL_MS;
}

/**
 * Balayage paresseux best-effort : INVITED datés de plus de 72 h →
 * EXPIRED. Idempotent (garde `invitationStatus: "INVITED"`, rejouable
 * sans doublon). Ne lève jamais (retourne 0 en cas d'échec DB).
 */
export async function expireStaleInvitations(now: Date = new Date()): Promise<number> {
  try {
    const cutoff = new Date(now.getTime() - INVITE_TTL_MS);
    const res = await db.member.updateMany({
      where: {
        invitationStatus: "INVITED",
        invitedAt: { lt: cutoff },
        communityStatus: { not: "JOINED" },
        deletedAt: null,
      },
      data: { invitationStatus: "EXPIRED" },
    });
    return res.count;
  } catch {
    return 0;
  }
}
