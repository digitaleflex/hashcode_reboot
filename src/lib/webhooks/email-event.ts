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

/**
 * Extrait l'adresse PURE d'une valeur d'expéditeur.
 *
 * `EMAIL_FROM` / `BREVO_EMAIL_FROM` sont des valeurs **d'affichage** :
 * `"HASHCODE REBOOT <reboot@reboot.joinhashcode.com>"`. C'est valide comme
 * `from` chez Resend, et Brevo le scinde lui-même (`sendViaBrevo`, mail.ts:193).
 * Mais la même chaîne utilisée comme **destinataire** produit
 * `to: ["HASHCODE REBOOT <reboot@…>"]` → adresse invalide, et l'envoi échoue
 * sans laisser de trace exploitable côté appelant.
 *
 * D08 — c'est exactement ce qui arrivait aux notifications admin :
 * `ADMIN_EMAIL || EMAIL_FROM` servait de destinataire, `ADMIN_EMAIL` n'existant
 * pas dans `.env.example`. Résultat : les notifications de bounce n'étaient
 * jamais délivrées, et l'appel était en `.catch(() => {})`.
 *
 * Sans chevrons, la valeur est renvoyée telle quelle (trimée) : une adresse pure
 * reste une adresse pure. Fonction PURE — aucun effet de bord, aucun env lu à
 * l'intérieur — donc testable sans aucun setup.
 *
 * Placée ici parce que le module est déjà le point de partage des webhooks
 * email (cf. D04) et qu'il est déjà importé par la route Brevo : un seul point
 * de vérité, sans nouveau fichier ni nouveau import à câbler.
 */
export function extractEmailAddress(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  // Ancre sur la fin de la chaîne : on isole le dernier couple de chevrons
  // (`Nom <a@b>`), y compris quand le display name est lui-même entre guillemets
  // (`"Reboot, equipe" <a@b>`). Un `Nom <a@b> <c@d>` ne doit pas non plus être
  // tronqué par le premier chevron.
  const match = trimmed.match(/<([^>]+)>\s*$/);
  return match ? match[1].trim() : trimmed;
}

/**
 * Adresse de destination des notifications **internes** (bounce, et tout ce qui
 * remonte à l'équipe).
 *
 * `ADMIN_EMAIL` est prioritaire et doit le rester : c'est la seule variable qui
 * ne soit pas ambiguë. `EMAIL_FROM` n'est qu'un repli, et il est passé dans
 * l'extracteur — un `ADMIN_EMAIL` mal copié depuis un `.env` peut lui aussi
 * contenir un display name, et on ne veut pas que ça redevienne un envoi perdu.
 */
export function adminNotificationEmail(): string {
  return extractEmailAddress(process.env.ADMIN_EMAIL || process.env.EMAIL_FROM);
}