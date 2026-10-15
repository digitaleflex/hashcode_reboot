/**
 * HASHCODE REBOOT — politique de rétention (#153).
 *
 * Principe : aucune donnée d'acquisition ne s'accumule sans borne.
 * Les durées ci-dessous sont la SOURCE DE VÉRITÉ versionnée (cf.
 * docs/data-inventory-2026-10-15.md) — les modifier, c'est modifier la
 * politique : mettre à jour l'inventaire en même temps.
 *
 * Périmètre purgeable (données techniques/transitoires) :
 *   - brouillons complétés (donnée reprise dans Member) → 30 j ;
 *   - brouillons abandonnés relancés (relance faite, sans conversion) → 90 j ;
 *   - événements analytics bruts → 13 mois (standard CNIL mesures d'audience) ;
 *   - logs d'emails unitaires → 13 mois ;
 *   - métriques fournisseur brutes → 13 mois (les agrégats dashboard restent).
 *
 * JAMAIS purgé par ce mécanisme (traçabilité / droits) :
 *   - AuditLog (preuve légale), Consent/Qualification (preuves + historique),
 *     Member (soft-delete + droits via /api/account).
 *
 * Fonctions pures (testées sans DB dans tests/retention.test.ts) +
 * `purgeExpired` injectable (faux `db` structurel en test).
 */

export const RETENTION = {
  /** Brouillon converti en Member : redondant passé ce délai. */
  draftCompletedDays: 30,
  /** Brouillon abandonné dont la relance est partie : sans conversion. */
  draftAbandonedRelancedDays: 90,
  /** Mesures brutes : 13 mois. */
  analyticsDays: 395,
  emailLogDays: 395,
  providerMetricDays: 395,
} as const;

export interface PurgeCutoffs {
  /** Brouillons complétés créés avant → supprimables. */
  draftsCompletedBefore: Date;
  /** Brouillons abandonnés+relancés créés avant → supprimables. */
  draftsAbandonedBefore: Date;
  /** Événements/logs/métriques créés avant → supprimables. */
  eventsBefore: Date;
}

/** Bornes calculées depuis `now` (injecté pour les tests). */
export function purgeCutoffs(now: Date = new Date()): PurgeCutoffs {
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  return {
    draftsCompletedBefore: daysAgo(RETENTION.draftCompletedDays),
    draftsAbandonedBefore: daysAgo(RETENTION.draftAbandonedRelancedDays),
    eventsBefore: daysAgo(RETENTION.analyticsDays),
  };
}

/** Sous-ensemble Prisma utilisé (faux injectable en test). */
export interface PurgeDb {
  profilingDraft: { deleteMany(a: unknown): Promise<{ count: number }> };
  analyticsEvent: { deleteMany(a: unknown): Promise<{ count: number }> };
  memberEmailLog: { deleteMany(a: unknown): Promise<{ count: number }> };
  emailProviderMetric: { deleteMany(a: unknown): Promise<{ count: number }> };
}

export interface PurgeCounts {
  drafts: number;
  analytics: number;
  emailLogs: number;
  providerMetrics: number;
}

/**
 * Exécute la purge. Ne touche jamais : AuditLog, Consent, Qualification,
 * Member, RateLimit (compteurs vivants), Verification/Session (auth).
 */
export async function purgeExpired(
  db: PurgeDb,
  now: Date = new Date(),
): Promise<PurgeCounts> {
  const cut = purgeCutoffs(now);
  const [draftsCompleted, draftsAbandoned, analytics, emailLogs, providerMetrics] =
    await Promise.all([
      // Convertis : la donnée vit dans Member.
      db.profilingDraft.deleteMany({
        where: { completedAt: { not: null, lt: cut.draftsCompletedBefore } },
      }),
      // Abandonnés relancés : la relance est partie depuis longtemps.
      // Jamais les éligibles relance (completedAt NULL + relanceSentAt NULL).
      db.profilingDraft.deleteMany({
        where: {
          completedAt: null,
          relanceSentAt: { not: null, lt: cut.draftsAbandonedBefore },
        },
      }),
      db.analyticsEvent.deleteMany({
        where: { createdAt: { lt: cut.eventsBefore } },
      }),
      db.memberEmailLog.deleteMany({
        where: { createdAt: { lt: cut.eventsBefore } },
      }),
      db.emailProviderMetric.deleteMany({
        // `date` (jour métrique), pas `createdAt` : un backfill a un
        // createdAt récent pour un jour ancien.
        where: { date: { lt: cut.eventsBefore } },
      }),
    ]);
  return {
    drafts: draftsCompleted.count + draftsAbandoned.count,
    analytics: analytics.count,
    emailLogs: emailLogs.count,
    providerMetrics: providerMetrics.count,
  };
}
