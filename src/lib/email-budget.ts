/**
 * HASHCODE REBOOT — garde-fou de quota d'envoi email.
 *
 * POURQUOI CE MODULE EXISTE
 *
 * Les envois de masse (notifications d'événement, annonces, relances,
 * invitations) partaient par paquets de 10 en parallèle, sans aucune
 * conscience du quota des providers. Deux conséquences :
 *
 * 1. Un lot trop large peut dépasser le quota du jour. Le provider répond
 *    alors 429, et `sendEmail` bascule automatiquement sur l'autre provider
 *    (BREVO_FALLBACK_ON_429) — donc on peut épuiser les DEUX quotas d'affilée
 *    sans qu'aucune alerte ne se déclenche.
 * 2. 10 requêtes concurrentes dégradent la délivrabilité bien avant la limite.
 *
 * COMMENT ÇA MARCHE
 *
 * `EmailEvent` reçoit une ligne à chaque envoi réellement accepté, avec le
 * provider qui l'a accepté : c'est le seul registre temps réel dont dispose le
 * code. On compte donc les envois du jour par provider, et on en déduit un
 * niveau :
 *
 *   ok       < 70 %  → lot de 10, aucune pause
 *   warn      70–90 % → lot de 5,   pause 200 ms
 *   critical  90–100 % → lot de 1,   pause 1 s
 *   blocked  ≥ 100 % → aucun envoi
 *
 * PRINCIPE DE PRUDENCE
 *
 * En `blocked`, les destinataires non servis ne sont PAS marqués comme envoyés
 * (aucune écriture dans MemberEmailLog). Le lot suivant les reprend donc
 * automatiquement : rien n'est perdu, rien n'est dupliqué. C'est le pattern
 * idempotent déjà utilisé par /api/cron/relance, généralisé.
 *
 * On ne bascule PAS sur l'autre provider : la bascule masquerait une dérive de
 * volume, qui est précisément ce qu'on veut voir.
 */

import { db } from "@/lib/db";

export type EmailProvider = "resend" | "brevo";
export type BudgetLevel = "ok" | "warn" | "critical" | "blocked";

/** Catégories de `sendEmail` (voir le routage dans src/lib/mail.ts). */
export type EmailCategory = "marketing" | "notification" | "code" | "transactional";

export interface EmailBudget {
  provider: EmailProvider;
  /** Quota journalier du provider. */
  cap: number;
  /**
   * Envois imputés à ce provider pour la décision : envois attribués +
   * envois non attribués. On compte les non attribués contre CHAQUE provider
   * (voir `getBudget`) : un envoi dont on ne connaît pas le provider a pu
   * passer par celui-ci, donc l'ignorer rendrait le garde-fou aveugle.
   */
  used: number;
  /** Envois explicitement attribués à ce provider. */
  attributed: number;
  /** Envois du jour sans provider identifié (lignes historiques). */
  unattributed: number;
  remaining: number;
  /** used / cap, borné à [0, 1] pour l'affichage. */
  ratio: number;
  level: BudgetLevel;
  /** Prochain passage à 00:00 UTC (les quotas provider se réinitialisent à la journée). */
  resetsAt: string;
}

export interface BatchPlan {
  provider: EmailProvider;
  level: BudgetLevel;
  /** Envois autorisés tout de suite. */
  allowed: number;
  /** Envois reportés — à NE PAS marquer comme envoyés. */
  deferred: number;
  /** Taille de lot recommandée. */
  batchSize: number;
  /** Pause entre deux envois, en ms (pacing : protège la délivrabilité). */
  delayMs: number;
}

/** Début de la journée UTC — granularité des quotas provider. */
export function startOfUtcDay(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Prochain minuit UTC. */
export function nextUtcMidnight(now = new Date()): Date {
  const d = startOfUtcDay(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Quota journalier d'un provider.
 * Surchargeable par env pour suivre l'évolution du plan sans redéployer le code.
 */
export function capFor(provider: EmailProvider): number {
  const raw =
    provider === "brevo"
      ? process.env.BREVO_DAILY_CAP
      : process.env.RESEND_DAILY_CAP;
  const fallback = provider === "brevo" ? 300 : 100;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function levelFor(used: number, cap: number): BudgetLevel {
  if (cap <= 0) return "blocked";
  const ratio = used / cap;
  if (ratio >= 1) return "blocked";
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.7) return "warn";
  return "ok";
}

/** Réglages de lot par niveau — c'est ici que le code « s'ajuste ». */
const PACING: Record<BudgetLevel, { batchSize: number; delayMs: number }> = {
  ok: { batchSize: 10, delayMs: 0 },
  warn: { batchSize: 5, delayMs: 200 },
  critical: { batchSize: 1, delayMs: 1000 },
  blocked: { batchSize: 0, delayMs: 0 },
};

/** Envois du jour sans provider identifié (lignes antérieures à la colonne). */
export async function countUnattributed(now = new Date()): Promise<number> {
  try {
    return await db.emailEvent.count({
      where: {
        type: "email.sent",
        provider: null,
        createdAt: { gte: startOfUtcDay(now) },
      },
    });
  } catch {
    return 0;
  }
}

/** Budget courant d'un provider, mesuré sur les envois réellement acceptés. */
export async function getBudget(
  provider: EmailProvider,
  now = new Date(),
): Promise<EmailBudget> {
  const start = startOfUtcDay(now);
  const cap = capFor(provider);

  let attributed = 0;
  let unattributed = 0;
  try {
    [attributed, unattributed] = await Promise.all([
      db.emailEvent.count({
        where: { type: "email.sent", provider, createdAt: { gte: start } },
      }),
      countUnattributed(now),
    ]);
  } catch {
    // En cas d'échec de lecture, on ne bloque PAS les envois : un compteur
    // indisponible ne doit pas interrompre le service. Le prochain passage
    // corrigera la mesure.
    attributed = 0;
    unattributed = 0;
  }

  // Conservateur : un envoi non attribué est imputé à chaque provider, car il
  // a pu passer par celui-ci. Sous-compter reviendrait à laisser le garde-fou
  // franchir la limite qu'il est censé protéger.
  const used = attributed + unattributed;
  const remaining = Math.max(0, cap - used);
  return {
    provider,
    cap,
    used,
    attributed,
    unattributed,
    remaining,
    ratio: cap > 0 ? Math.min(1, used / cap) : 1,
    level: levelFor(used, cap),
    resetsAt: nextUtcMidnight(now).toISOString(),
  };
}

/** Budgets des deux providers + envois non attribuables (lignes historiques). */
export async function getAllBudgets(now = new Date()): Promise<{
  budgets: EmailBudget[];
  unattributed: number;
}> {
  const [resend, brevo] = await Promise.all([
    getBudget("resend", now),
    getBudget("brevo", now),
  ]);
  // Les deux budgets portent la même valeur : on en expose une seule.
  return { budgets: [resend, brevo], unattributed: resend.unattributed };
}

/**
 * Provider principal d'une catégorie — réplique du routage de `sendEmail`
 * (src/lib/mail.ts). Le garde-fou doit viser le provider qui recevra
 * réellement l'envoi, sinon il protège le mauvais quota.
 *
 * **Règle projet** : les lots de plus de 20 destinataires passent toujours
 * par Brevo (quota 300/jour vs 100/jour pour Resend), quelle que soit la
 * catégorie. Resend est réservé aux envois ponctuels et transactionnels.
 */
export function providerForBatch(
  category: EmailCategory,
  requested: number,
): EmailProvider {
  const BREVO_THRESHOLD = 20;
  if (requested > BREVO_THRESHOLD) return "brevo";
  if (category === "notification" || category === "code") return "resend";
  if (category === "marketing") return "brevo";
  return process.env.EMAIL_PROVIDER === "brevo" ? "brevo" : "resend";
}

/**
 * Décide combien d'emails peuvent partir maintenant, et à quel rythme.
 *
 * `requested` = taille du lot demandé. Ne lève jamais : en cas d'erreur de
 * mesure, on laisse passer (prudence ≠ paralysie du service).
 */
export async function planBatch(input: {
  category: EmailCategory;
  requested: number;
  provider?: EmailProvider;
  now?: Date;
}): Promise<BatchPlan> {
  const provider =
    input.provider ?? providerForBatch(input.category, input.requested);
  const requested = Math.max(0, Math.floor(input.requested));

  let budget: EmailBudget;
  try {
    budget = await getBudget(provider, input.now ?? new Date());
  } catch {
    const pacing = PACING.ok;
    return {
      provider,
      level: "ok",
      allowed: requested,
      deferred: 0,
      batchSize: pacing.batchSize,
      delayMs: pacing.delayMs,
    };
  }

  const pacing = PACING[budget.level];
  const allowed = Math.min(requested, budget.remaining);

  return {
    provider,
    level: budget.level,
    allowed,
    deferred: requested - allowed,
    batchSize: pacing.batchSize,
    delayMs: pacing.delayMs,
  };
}

/**
 * Combien de lots complets il reste possible d'envoyer aujourd'hui — sert à
 * l'affichage admin (« capacité restante en vagues de N »).
 */
export async function remainingBatches(
  provider: EmailProvider,
  batchSize: number,
  now = new Date(),
): Promise<number> {
  if (batchSize <= 0) return 0;
  const budget = await getBudget(provider, now);
  return Math.floor(budget.remaining / batchSize);
}

/** Débit des `minutes` dernières minutes (envois acceptés). */
export async function recentThroughput(
  minutes = 60,
  now = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - minutes * 60_000);
  try {
    return await db.emailEvent.count({
      where: { type: "email.sent", createdAt: { gte: since } },
    });
  } catch {
    return 0;
  }
}
