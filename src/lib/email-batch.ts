/**
 * HASHCODE REBOOT — envoi de masse avec pacing et garde-fou de quota.
 *
 * Remplace les boucles « paquets de 10 en parallèle » dupliquées dans chaque
 * route de lot (notifications d'événement, annonce, relance, invitations).
 * Une seule implémentation, donc un seul endroit où la prudence est appliquée.
 *
 * GARANTIE ANTI-PERTE / ANTI-DOUBLON
 *
 * Les destinataires reportés faute de budget sortent du lot **sans** que
 * l'appelant les considère comme servis : chaque route n'écrit son
 * `notifiedAt` (ou équivalent) que si `result.deferred === 0`. Le prochain
 * passage les reprend donc automatiquement. C'est ce qui rend le report sûr —
 * sans cette règle, un report ressemblerait à un envoi et les membres concernés
 * ne recevraient jamais rien.
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
        } else {
          failed.push(recipient);
        }
      }

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
