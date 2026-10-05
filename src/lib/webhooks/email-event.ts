import { db } from "@/lib/db";

/**
 * Helpers partagés par les webhooks email (Resend et Brevo).
 *
 * D04 — existaient avant sous forme de fonctions privées dupliquées :
 * Resend réimplémentait `findMember` / `logEvent` / `blacklist` à l'identique
 * de Brevo, mais **sans** la résolution de `memberId`. Conséquence : les 4
 * `db.emailEvent.create` de `webhooks/resend/route.ts` écrivaient `email`,
 * `type`, `category` mais **jamais `memberId`**. Or :
 *
 *   - `/api/admin/email-log` enrichit chaque ligne via
 *     `where: { memberId: { in: memberIds } }` (route.ts:119)
 *   - `/api/admin/member-emails` fait de même (route.ts:54)
 *
 * → **tout le trafic Resend était invisible** dans les vues engagement.
 * Le webhook Brevo écrivait bien `memberId`, d'où une asymétrie invisible à
 * l'œil : les open/click rates ne mesuraient qu'une fraction du trafic, avec un
 * biais systématique.
 *
 * La différence clé : ici `memberId` est résolu par `recordEmailEvent` LUI-MÊME.
 * L'appelant ne peut plus l'oublier — c'est la seule façon d'empêcher que le
 * bug se reproduise.
 */

/**
 * Résout le membre par email. Normalise en minuscules (les providers
 * fournissent des adresses de casse variable).
 *
 * `firstName` est inclus car le webhook Brevo le utilise pour ses
 * notifications à l'admin : c'est un `select` de scalaires, sans jointure.
 */
export async function findMember(
  email: string,
): Promise<{ id: string; email: string; firstName: string } | null> {
  try {
    return await db.member.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, firstName: true },
    });
  } catch {
    return null;
  }
}

/**
 * Enregistre un événement email dans `EmailEvent`, en résolvant `memberId`
 * automatiquement. Best-effort : ne lève jamais (un webhook ne doit pas faire
 * échouer l'appel provider, qui réessaierait).
 */
export async function recordEmailEvent({
  email,
  type,
  category,
  metadata,
}: {
  email: string;
  type: string;
  category: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const member = await findMember(email);
    await db.emailEvent.create({
      data: {
        email,
        // D04 : résolu ici, donc jamais omis.
        memberId: member?.id ?? null,
        type,
        category,
        metadata: metadata ? JSON.stringify(metadata).slice(0, 2000) : null,
      },
    });
  } catch {
    // Silent — best effort
  }
}

/**
 * Ajoute l'email à la blacklist de manière idempotente (upsert) : un webhook
 * rejoué ne duplique pas l'entrée et ne change pas la date de première
 * insertion.
 */
export async function blacklistEmail({
  email,
  reason,
  note,
}: {
  email: string;
  reason: string;
  note: string;
}): Promise<void> {
  try {
    const normalized = email.toLowerCase();
    await db.memberBlacklist.upsert({
      where: { email: normalized },
      create: {
        email: normalized,
        reason,
        note: note.slice(0, 500),
        autoAdded: true,
      },
      update: { reason, note: note.slice(0, 500), autoAdded: true },
    });
  } catch {
    // Silent — best effort
  }
}