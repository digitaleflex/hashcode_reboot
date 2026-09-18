/**
 * HASHCODE REBOOT — envoi de masse avec pacing et garde-fou de quota.
 *
 * Remplace les boucles « paquets de 10 en parallèle » dupliquées dans chaque
 * route de lot (notifications d'événement, annonce, relance, invitations).
 * Une seule implémentation, donc un seul endroit où la prudence est appliquée.
 *
 * GARANTIE ANTI-PERTE / ANTI-DOUBLON
 *
 * `markSent` n'est appelé QUE pour un envoi réellement accepté par le provider.
 * Les destinataires reportés faute de budget ne sont donc jamais marqués : le
 * prochain passage les reprend automatiquement. C'est ce qui rend le report
 * sûr — sans cette règle, un report ressemblerait à un envoi et les membres
 * concernés ne recevraient jamais rien.
 */

import {
  type BatchPlan,
  type EmailCategory,
  planBatch,
} from "@/lib/email-budget";

export interface BatchRecipient {
  memberId?: string;
  email: string;
  firstName: string;
}

export interface BatchResult {
  /** Envois acceptés par le provider. */
  sent: number;
  /** Envois tentés et refusés (erreur provider). */
  failed: number;
  /** Destinataires non tentés faute de budget — à reprendre au prochain passage. */
  deferred: number;
  plan: BatchPlan;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envoie un lot en respectant le budget du provider et le pacing recommandé.
 *
 * Enveloppe `planBatch` (mesure du quota) et applique la taille de lot ainsi
 * que la pause décidées par le niveau de budget. Ne lève jamais : une erreur
 * d'envoi individuelle incrémente `failed` et n'interrompt pas le lot.
 */
export async function sendPacedBatch<T extends BatchRecipient>(opts: {
  category: EmailCategory;
  recipients: T[];
  /** Envoi unitaire. Doit retourner { ok } (cf. SendEmailResult). */
  send: (recipient: T) => Promise<{ ok: boolean }>;
  /**
   * Marque l'envoi (ex. logMemberEmail). Appelé uniquement si `ok === true`.
   * Une erreur ici ne remet pas en cause l'envoi : elle est avalée.
   */
  markSent?: (recipient: T) => Promise<void>;
  /** Appelé après chaque destinataire traité (progression). */
  onProgress?: (done: number, total: number) => void;
}): Promise<BatchResult> {
  const plan = await planBatch({
    category: opts.category,
    requested: opts.recipients.length,
  });

  const sent: T[] = [];
  const failed: T[] = [];
  const queue = opts.recipients.slice(0, plan.allowed);
  const deferred = opts.recipients.length - queue.length;

  // `batchSize` vaut 0 quand le budget est épuisé : rien à envoyer.
  if (plan.batchSize > 0) {
    for (let i = 0; i < queue.length; i += plan.batchSize) {
      const chunk = queue.slice(i, i + plan.batchSize);

      const results = await Promise.allSettled(
        chunk.map((recipient) => opts.send(recipient)),
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const recipient = chunk[j];
        if (r.status === "fulfilled" && r.value.ok) {
          sent.push(recipient);
          if (opts.markSent) {
            try {
              await opts.markSent(recipient);
            } catch {
              /* le marquage est best-effort : l'email est déjà parti */
            }
          }
        } else {
          failed.push(recipient);
        }
      }

      opts.onProgress?.(sent.length + failed.length, queue.length);
      // Pas de pause après le dernier paquet.
      if (i + plan.batchSize < queue.length) await sleep(plan.delayMs);
    }
  }

  return {
    sent: sent.length,
    failed: failed.length,
    deferred,
    plan,
  };
}

/**
 * Message lisible quand des destinataires ont été reportés — destiné à
 * l'admin, jamais silencieux.
 */
export function deferredNotice(result: BatchResult): string | null {
  if (result.deferred === 0) return null;
  const level = result.plan.level;
  const reason =
    level === "blocked"
      ? `quota ${result.plan.provider} épuisé pour aujourd'hui`
      : `quota ${result.plan.provider} presque épuisé (${level})`;
  return (
    `${result.deferred} destinataire(s) reporté(s) : ${reason}. ` +
    `Ils ne sont pas marqués comme servis et seront repris automatiquement ` +
    `au prochain passage (le quota se réinitialise à 00:00 UTC).`
  );
}
