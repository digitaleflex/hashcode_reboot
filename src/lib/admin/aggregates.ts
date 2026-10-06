/**
 * D29 - agregats du dashboard admin 360, a UN SEUL endroit.
 *
 * POURQUOI CE MODULE
 * ------------------
 * `src/app/api/admin/dashboard/route.ts` etait un monolithe de 512 lignes qui
 * contenait 7 fonctions d'agregation ET la route HTTP. Chaque fonction etait un
 * copie-colle d'un endpoint deja existant (`/api/stats`, `/api/analytics`,
 * `/api/email-stats`, `/api/admin/email-deliverability`, `/api/admin/email-ops`,
 * `/api/admin/cron-health`, `getAudience()` de `/api/admin/email-log`), avec la
 * MEME formule (memes `groupBy`, memes filtres, meme fenetre : "tout l'historique",
 * aucun `createdAt` borne). Deux implementations d'une meme notion : des que
 * l'une est corrigee, l'autre ment.
 *
 * CE QUE CE MODULE NE FAIT PAS (a lire avant de re-factoriser)
 * ------------------------------------------------------------
 *  - Il ne compose PAS via HTTP. Un dashboard qui appellerait 7 URLs ferait 7
 *    allers-retours et rejouerait 7 fois les mêmes requêtes DB. Ici, un seul point
 *    d'entrée appelle des FONCTIONS partagées : le nombre de requêtes DB est
 *    inchange (41 avant, 41 apres - verifie par `tests/dashboard-aggregates.test.cjs`).
 *  - Il n'a pas supprime la duplication cote endpoints. Les 6 endpoints
 *    ci-dessus etaient hors perimetre D29 (deux autres agents travaillaient en
 *    parallele sur `src/app/api/admin/**`). Chacun n'a plus qu'a remplacer sa
 *    copie locale par un import d'ici : c'est le travail de tache suivant.
 *
 * Les predicats sont repris a l'identique, les fenetres aussi : un agregat donne
 * renvoie la MEME valeur qu'avant le deplacement. Aucun arrondi, aucun
 * `Math.min`, aucun ordre de tri n'a ete touche.
 */

import { db } from "@/lib/db";
import {
  getAllBudgets,
  recentThroughput,
  remainingBatches,
  type EmailBudget,
} from "@/lib/email-budget";
import {
  EMAIL_SEMANTIC_CATEGORIES,
  PROFILE_RELANC_CATEGORY,
} from "@/lib/email-categories";

// D03 - la liste vient de `@/lib/email-categories` (source unique, partagee avec
// les producteurs de `mail.ts`) : consommateurs et producteurs ne peuvent plus
// diverger.
const CATEGORIES = EMAIL_SEMANTIC_CATEGORIES;

/**
 * Crons et lots admin surveilles. Cette liste etait dupliquee mot pour mot dans
 * `/api/admin/cron-health` ET dans la route dashboard (voir la tache suivante).
 */
export const CRONS = [
  { key: "cron_relance", label: "Relance profils (J+7)", expectedEveryH: 24 },
  { key: "cron_email_alerts", label: "Alertes délivrabilité", expectedEveryH: 24 },
  { key: "cron_collect_metrics", label: "Collecte métriques", expectedEveryH: 24 },
  { key: "cron_event_reminders", label: "Relances evenements (J-3/J-1/H-1)", expectedEveryH: 1 },
  { key: "admin_announce_dashboard", label: "Annonce espace (manuel)", expectedEveryH: null },
  { key: "admin_invite_relance", label: "Relance invitations (manuel)", expectedEveryH: null },
  { key: "admin_import_invite", label: "Import invitations (manuel)", expectedEveryH: null },
] as const;

/** Providers dont la délivrabilité est suivie (fenetre de 30 jours par defaut). */
export const DELIVERABILITY_PROVIDERS = ["resend", "brevo"] as const;

// -- Fonctions pures (testables sans base) ------------------------------------

/**
 * Fusionne les entrees `source` en double (ex: NULL -> "direct" + "direct" stocke).
 * Cause racine du `duplicate key: direct` cote Breakdown.
 */
export function mergeBySource(
  entries: { source: string; count: number }[],
): { source: string; count: number }[] {
  const merged = new Map<string, number>();
  for (const { source, count } of entries) {
    const key = (source ?? "").trim() || "direct";
    merged.set(key, (merged.get(key) ?? 0) + count);
  }
  return [...merged.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/** Statut d'un cron : jamais vu / manuel / dans les temps / perime. */
export type CronStatus = "ok" | "stale" | "never" | "manual";

/**
 * Statut déduit du DERNIER passage et de la fréquence attendue. Un cron manuel
 * (`expectedEveryH === null`) n'est jamais "stale" : il ne se declenche pas tout
 * seul, donc son age ne prouve rien.
 *
 * `nowMs` est injectable pour que le test puisse fixer le "maintenant" - sinon
 * cette fonction serait impossible a tester de maniere deterministe.
 */
export function cronStatus(
  last: { createdAt: Date } | null | undefined,
  expectedEveryH: number | null,
  nowMs: number,
): CronStatus {
  if (!last) return "never";
  if (expectedEveryH === null) return "manual";
  const ageMs = nowMs - last.createdAt.getTime();
  return ageMs <= expectedEveryH * 2 * 3600 * 1000 ? "ok" : "stale";
}

/** Une ligne d'evenement analytics vue par la surveillance des crons. */
export interface CronLastRun {
  createdAt: Date;
  ref: string | null;
}

/** Entree de la liste `CRONS`, en version non-`readonly` (pratique pour typer). */
export interface CronSpec {
  key: string;
  label: string;
  expectedEveryH: number | null;
}

/** Ligne de sortie de la surveillance des crons (forme consommee par le front). */
export interface CronHealthRow {
  key: string;
  label: string;
  expectedEveryH: number | null;
  lastRun: Date | null;
  summary: string | null;
  status: CronStatus;
}

/** Assemble une ligne de surveillance a partir du dernier passage. */
export function buildCronHealthRow(
  cron: CronSpec,
  last: CronLastRun | null,
  nowMs: number,
): CronHealthRow {
  return {
    key: cron.key,
    label: cron.label,
    expectedEveryH: cron.expectedEveryH,
    lastRun: last?.createdAt ?? null,
    summary: last?.ref ?? null,
    status: cronStatus(last, cron.expectedEveryH, nowMs),
  };
}

export interface DropoffRow {
  questionId: string;
  answered: number;
  abandoned: number;
  dropRate: number;
}

/** Abandon par question : repondus vs abandonnes, tries par taux decroissant. */
export function buildDropoff(
  answeredRows: { ref: string | null; _count: number }[],
  abandonedRows: { ref: string | null; _count: number }[],
): DropoffRow[] {
  const answeredMap = new Map<string, number>();
  for (const r of answeredRows) if (r.ref) answeredMap.set(r.ref, r._count);
  const abandonedMap = new Map<string, number>();
  for (const r of abandonedRows) if (r.ref) abandonedMap.set(r.ref, r._count);
  const allIds = new Set([...answeredMap.keys(), ...abandonedMap.keys()]);
  return [...allIds]
    .map((id) => {
      const answered = answeredMap.get(id) ?? 0;
      const abandoned = abandonedMap.get(id) ?? 0;
      const t = answered + abandoned;
      return {
        questionId: id,
        answered,
        abandoned,
        dropRate: t === 0 ? 0 : Math.round((abandoned / t) * 100),
      };
    })
    .sort((a, b) => b.dropRate - a.dropRate);
}

export interface TimingRow {
  questionId: string;
  samples: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
}

/** Temps de reponse par question (p50 / p95), tries par moyenne decroissante. */
export function buildTiming(
  rows: { ref: string | null; value: number | null }[],
): TimingRow[] {
  const byQuestion = new Map<string, number[]>();
  for (const r of rows) {
    if (r.ref && r.value !== null && r.value > 0) {
      const arr = byQuestion.get(r.ref) ?? [];
      arr.push(r.value);
      byQuestion.set(r.ref, arr);
    }
  }
  return [...byQuestion.entries()]
    .map(([id, vals]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      return {
        questionId: id,
        samples: sorted.length,
        avgMs: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
        p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
      };
    })
    .sort((a, b) => b.avgMs - a.avgMs);
}

/**
 * Ligne d'agregat journalier d'un provider (`EmailProviderMetric`), en version
 * typee. Avant D29 c'etait `any[]` : la forme de retour du JSON etait donc
 * seulement verifiee a l'execution.
 */
export interface ProviderMetricRow {
  date: Date;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  opened: number;
  clicked: number;
  uniqueOpened: number;
  uniqueClicked: number;
  // `Float?` en base : un jour de collecte incomplet laisse ces colonnes a null.
  // Le type suit la colonne, sinon il faudrait les convertir - et la reponse
  // JSON changerait de forme.
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
}

export interface ProviderTotals {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  opened: number;
  clicked: number;
  uniqueOpened: number;
  uniqueClicked: number;
}

const EMPTY_TOTALS: ProviderTotals = {
  sent: 0,
  delivered: 0,
  bounced: 0,
  complained: 0,
  unsubscribed: 0,
  opened: 0,
  clicked: 0,
  uniqueOpened: 0,
  uniqueClicked: 0,
};

/**
 * Fenêtre d'analyse de la délivrabilité : `days` jours glissants, bornes au
 * jour UTC. `end` est le jour courant a 23:59:59.999, `start` le jour a
 * minuit. Sans ces deux `setUTCHours`, la fenetreGLISSait d'une requete a
 * l'autre sur une série de jours.
 */
export function deliverabilityWindow(
  days: number,
  now: Date,
): { start: Date; end: Date } {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

/**
 * Totaux + taux d'un provider sur la fenetre, plus la comparaison 7 jours
 * contre 7 jours precedents.
 *
 * Les taux sont des RATIOS (0.05 = 5 %), arrondis a l'affichage par le front -
 * ne pas appliquer `Math.round` ici, sinon deux arrondis s'additionneraient.
 *
 * La comparaison porte sur `sent`/`delivered` des 7 derniers jours contre les
 * 7 precedents : elle est donc elle-meme une fenetre glissante, independante de
 * `days`.
 */
export function summarizeProvider(
  provider: string,
  metrics: ProviderMetricRow[],
  now: Date,
): {
  provider: string;
  totals: ProviderTotals;
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    complaintRate: number;
  };
  comparison: { volumeChange: number; deliveryChange: number };
  daysWithData: number;
} {
  const totals = metrics.reduce(
    (acc, m) => ({
      sent: acc.sent + m.sent,
      delivered: acc.delivered + m.delivered,
      bounced: acc.bounced + m.bounced,
      complained: acc.complained + m.complained,
      unsubscribed: acc.unsubscribed + m.unsubscribed,
      opened: acc.opened + m.opened,
      clicked: acc.clicked + m.clicked,
      uniqueOpened: acc.uniqueOpened + m.uniqueOpened,
      uniqueClicked: acc.uniqueClicked + m.uniqueClicked,
    }),
    { ...EMPTY_TOTALS },
  );

  const deliveryRate = totals.sent > 0 ? totals.delivered / totals.sent : 0;
  const openRate = totals.delivered > 0 ? totals.uniqueOpened / totals.delivered : 0;
  const clickRate = totals.delivered > 0 ? totals.uniqueClicked / totals.delivered : 0;
  const bounceRate = totals.sent > 0 ? totals.bounced / totals.sent : 0;
  const complaintRate = totals.delivered > 0 ? totals.complained / totals.delivered : 0;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last7 = metrics.filter((m) => m.date >= sevenDaysAgo);
  const prev7 = metrics.filter((m) => m.date >= fourteenDaysAgo && m.date < sevenDaysAgo);
  const sumLast7 = last7.reduce(
    (a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }),
    { sent: 0, delivered: 0 },
  );
  const sumPrev7 = prev7.reduce(
    (a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }),
    { sent: 0, delivered: 0 },
  );
  const volumeChange = sumPrev7.sent > 0 ? (sumLast7.sent - sumPrev7.sent) / sumPrev7.sent : 0;
  const deliveryChange =
    sumPrev7.delivered > 0 && sumLast7.delivered > 0
      ? sumLast7.delivered / sumLast7.sent - sumPrev7.delivered / sumPrev7.sent
      : 0;

  return {
    provider,
    totals,
    rates: { deliveryRate, openRate, clickRate, bounceRate, complaintRate },
    comparison: { volumeChange, deliveryChange },
    daysWithData: metrics.length,
  };
}

/** Séries temporelles du graphique de délivrabilité (une entrée par jour). */
export function providerChart(provider: string, metrics: ProviderMetricRow[]) {
  return {
    provider,
    data: metrics.map((m) => ({
      date: m.date.toISOString().split("T")[0],
      sent: m.sent,
      delivered: m.delivered,
      bounced: m.bounced,
      opened: m.opened,
      clicked: m.clicked,
      uniqueOpened: m.uniqueOpened,
      uniqueClicked: m.uniqueClicked,
      deliveryRate: m.deliveryRate,
      openRate: m.openRate,
      clickRate: m.clickRate,
      bounceRate: m.bounceRate,
      complaintRate: m.complaintRate,
    })),
  };
}

export type CategoryStats = Record<string, { sent: number; opened: number; clicked: number }>;

/**
 * Engagement par categorie semantique. Les categories sans eveni sont
 * pre-initialisees a zero pour que le graphique n'ait pas de trou, et une
 * categorie inconnue du au moment de la lecture n'est pas perdue.
 */
export function buildCategoryStats(
  rows: { category: string | null; type: string; _count: number }[],
): CategoryStats {
  const result: CategoryStats = {};
  for (const cat of CATEGORIES) result[cat] = { sent: 0, opened: 0, clicked: 0 };
  for (const r of rows) {
    const cat = (r.category ?? "other") as string;
    if (!result[cat]) result[cat] = { sent: 0, opened: 0, clicked: 0 };
    if (r.type === "email.sent") result[cat].sent = r._count;
    else if (r.type === "email.opened") result[cat].opened = r._count;
    else if (r.type === "email.clicked") result[cat].clicked = r._count;
  }
  return result;
}

/** Categories reellement actives (au moins un envoi) : c'est ce qu'on affiche. */
export function engagedCategories(byCategory: CategoryStats): string[] {
  return Object.keys(byCategory).filter((c) => byCategory[c].sent > 0);
}

/** Compte les evenements d'un type pour un ensemble d'emails. */
export function countByTypeAndEmails(
  events: { email: string; type: string }[],
  type: string,
  emails: Set<string>,
): number {
  return events.filter((e) => e.type === type && emails.has(e.email.toLowerCase())).length;
}

/** Message d'alerte de quota, par niveau. L'admin doit voir le probleme, pas un graphe. */
export interface OpsAlert {
  level: "warn" | "critical";
  provider?: string;
  message: string;
}

/** Traduit les niveaux de quota en alertes lisibles. */
export function buildOpsAlerts(
  providers: EmailBudget[],
  unattributed: number,
): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  for (const b of providers) {
    if (b.level === "blocked") {
      alerts.push({
        level: "critical",
        provider: b.provider,
        message:
          `Quota ${b.provider} épuisé : ${b.used}/${b.cap} envois aujourd'hui. ` +
          `Les envois sont suspendus jusqu'a 00:00 UTC ; les destinataires non ` +
          `servis seront repris automatiquement.`,
      });
    } else if (b.level === "critical") {
      alerts.push({
        level: "critical",
        provider: b.provider,
        message:
          `Quota ${b.provider} presque épuisé : ${b.used}/${b.cap} ` +
          `(${Math.round(b.ratio * 100)} %). Les lots sont réduits à 1 envoi ` +
          `avec une pause d'1 s.`,
      });
    } else if (b.level === "warn") {
      alerts.push({
        level: "warn",
        provider: b.provider,
        message:
          `Quota ${b.provider} a ${Math.round(b.ratio * 100)} % ` +
          `(${b.used}/${b.cap}). Taille de lot reduite a 5 avec pause de 200 ms.`,
      });
    }
  }
  if (unattributed > 0) {
    alerts.push({
      level: "warn",
      message:
        `${unattributed} envoi(s) aujourd'hui sans provider identifie ` +
        `(lignes anterieures a l'ajout de la colonne). Ils ne sont pas comptes ` +
        `dans les quotas ci-dessus.`,
    });
  }
  return alerts;
}

// -- Agregats (acces base) --------------------------------------------------

/**
 * Compteurs membres + ventilations + engagement email.
 * Copie de la branche "all-time" de `/api/stats` (meme fenetre : aucune borne
 * de date, seulement `deletedAt: null`).
 */
export async function fetchStats() {
  const [
    total, approved, pending, waitlist, rejected,
    registered, invited,
    web, cyber, ai, mentoring,
    byCountry, byLevel, byAvailability, byBudget, byArchetype, bySource,
    emailSent, emailOpened, emailClicked,
  ] = await Promise.all([
    db.member.count({ where: { deletedAt: null } }),
    db.member.count({ where: { deletedAt: null, profileStatus: "APPROVED" } }),
    db.member.count({ where: { deletedAt: null, profileStatus: "PENDING" } }),
    db.member.count({ where: { deletedAt: null, profileStatus: "WAITLIST" } }),
    db.member.count({ where: { deletedAt: null, profileStatus: "REJECTED" } }),
    db.member.count({ where: { deletedAt: null, invitationStatus: "NOT_INVITED" } }),
    db.member.count({ where: { deletedAt: null, invitationStatus: { not: "NOT_INVITED" } } }),
    db.member.count({ where: { deletedAt: null, primaryDomain: "web" } }),
    db.member.count({ where: { deletedAt: null, primaryDomain: "cybersecurity" } }),
    db.member.count({ where: { deletedAt: null, primaryDomain: "ai" } }),
    db.member.count({ where: { deletedAt: null, mentoringInterest: "yes" } }),
    db.member.groupBy({ by: ["country"], _count: true, orderBy: { _count: { country: "desc" } }, take: 12, where: { deletedAt: null } }),
    db.member.groupBy({ by: ["level"], _count: true, where: { deletedAt: null } }),
    db.member.groupBy({ by: ["availability"], _count: true, where: { deletedAt: null } }),
    db.member.groupBy({ by: ["budgetRange"], _count: true, where: { deletedAt: null } }),
    db.member.groupBy({ by: ["profileArchetype"], _count: true, orderBy: { _count: { profileArchetype: "desc" } }, where: { deletedAt: null } }),
    db.member.groupBy({ by: ["source"], _count: true, orderBy: { _count: { source: "desc" } }, take: 10, where: { deletedAt: null } }),
    db.emailEvent.count({ where: { type: "email.sent" } }),
    db.emailEvent.count({ where: { type: "email.opened" } }),
    db.emailEvent.count({ where: { type: "email.clicked" } }),
  ]);

  return {
    totals: { total, approved, pending, waitlist, rejected },
    invitations: { registered, invited },
    domains: { web, cyber, ai },
    mentoring,
    byCountry: byCountry.map((c) => ({ country: c.country, count: c._count })),
    byLevel: byLevel.map((l) => ({ level: l.level, count: l._count })),
    byAvailability: byAvailability.map((a) => ({ availability: a.availability, count: a._count })),
    byBudget: byBudget.map((b) => ({ budget: b.budgetRange, count: b._count })),
    byArchetype: byArchetype.flatMap((a) =>
      a.profileArchetype
        ? [{ archetype: String(a.profileArchetype), count: a._count }]
        : [],
    ),
    bySource: mergeBySource(
      bySource.flatMap((s) =>
        s.source
          ? [{ source: String(s.source), count: s._count }]
          : [{ source: "direct", count: s._count }],
      ),
    ),
    email: {
      sent: emailSent,
      opened: emailOpened,
      clicked: emailClicked,
      openRate: emailSent === 0 ? 0 : Math.round((emailOpened / emailSent) * 100),
      clickRate: emailSent === 0 ? 0 : Math.round((emailClicked / emailSent) * 100),
    },
  };
}

/**
 * Entonnoir de profiling + abandons + temps de reponse.
 * Copie de la branche "all-time" de `/api/analytics` GET (meme fenetre).
 */
export async function fetchFunnel() {
  const [
    rows, total, startedSessions, completedSessions, whatsappClicks,
    answeredRows, abandonedRows, timedRows,
  ] = await Promise.all([
    db.analyticsEvent.groupBy({ by: ["type"], _count: true, orderBy: { _count: { type: "desc" } } }),
    db.analyticsEvent.count(),
    db.analyticsEvent.groupBy({ by: ["sessionId"], where: { type: "profiling_started" } }),
    db.analyticsEvent.groupBy({ by: ["sessionId"], where: { type: "profiling_completed" } }),
    db.analyticsEvent.count({ where: { type: "whatsapp_join_clicked" } }),
    db.analyticsEvent.groupBy({ by: ["ref"], _count: true, where: { type: "profiling_question_answered", ref: { not: null } } }),
    db.analyticsEvent.groupBy({ by: ["ref"], _count: true, where: { type: "profiling_abandoned", ref: { not: null } } }),
    db.analyticsEvent.findMany({
      where: { type: "profiling_question_timed", ref: { not: null }, value: { not: null } },
      select: { ref: true, value: true },
      take: 5000,
    }),
  ]);

  return {
    total,
    events: rows.map((r) => ({ type: r.type, count: r._count })),
    funnel: {
      sessionsStarted: startedSessions.length,
      sessionsCompleted: completedSessions.length,
      whatsappClicks,
      completionRate:
        startedSessions.length === 0
          ? 0
          : Math.round((completedSessions.length / startedSessions.length) * 100),
    },
    dropoff: buildDropoff(answeredRows, abandonedRows),
    timing: buildTiming(timedRows),
  };
}

/**
 * Engagement email par categorie + tunnel de relance.
 * Copie de `/api/email-stats` (meme fenetre : tout l'historique, plafonds
 * `take: 20000` / `take: 10000`).
 */
export async function fetchEmailEngagement() {
  const [allEvents, byCategory, draftStats, relanceEmails] = await Promise.all([
    db.emailEvent.findMany({
      select: { email: true, type: true, category: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 20000,
    }),
    db.emailEvent
      .groupBy({ by: ["category", "type"], _count: true })
      .then(buildCategoryStats),
    (async () => {
      const [drafts, relanceSent, recovered] = await Promise.all([
        db.profilingDraft.count(),
        db.profilingDraft.count({ where: { relanceSentAt: { not: null } } }),
        db.profilingDraft.count({ where: { completedAt: { not: null } } }),
      ]);
      return { drafts, relanceSent, recovered };
    })(),
    db.emailEvent.findMany({
      // D03 : `profil_abandon` (relance d'un ProfilingDraft), pas "relance" -
      // aucune constante de ce nom n'etait produite par un wrapper, donc ce
      // filtre ne retournait rien et le tunnel affichait 0 en permanence.
      where: { type: "email.sent", category: PROFILE_RELANC_CATEGORY },
      select: { email: true },
      take: 10000,
    }),
  ]);

  const relanceEmailsLower = new Set(relanceEmails.map((r) => r.email.toLowerCase()));

  return {
    summary: {
      totalSent: allEvents.filter((e) => e.type === "email.sent").length,
      totalOpened: allEvents.filter((e) => e.type === "email.opened").length,
      totalClicked: allEvents.filter((e) => e.type === "email.clicked").length,
    },
    byCategory,
    categories: engagedCategories(byCategory),
    relance: {
      drafts: draftStats.drafts,
      relanceSent: draftStats.relanceSent,
      relanceOpened: countByTypeAndEmails(allEvents, "email.opened", relanceEmailsLower),
      relanceClicked: countByTypeAndEmails(allEvents, "email.clicked", relanceEmailsLower),
      recovered: draftStats.recovered,
    },
  };
}

/**
 * Delivrabilite par provider sur `days` jours.
 * Copie de `/api/admin/email-deliverability` (meme fenetre, meme liste de
 * providers, meme comparaison 7 j / 7 j).
 */
export async function fetchEmailDeliverability(days: number, now = new Date()) {
  const { start, end } = deliverabilityWindow(days, now);
  const providers = DELIVERABILITY_PROVIDERS;

  const metricsByProvider: Record<string, ProviderMetricRow[]> = {};
  await Promise.all(
    providers.map(async (p) => {
      metricsByProvider[p] = await db.emailProviderMetric.findMany({
        where: { provider: p, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      });
    }),
  );

  return {
    dateRange: {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    },
    summary: providers.map((p) => summarizeProvider(p, metricsByProvider[p] || [], now)),
    chartData: providers.map((p) => providerChart(p, metricsByProvider[p] || [])),
  };
}

/**
 * Quotas temps reel + debit sur `minutes`.
 * Copie de `/api/admin/email-ops` (memes defauts 48 / 60, memes messages).
 */
export async function fetchEmailOps(batchSize: number, minutes: number) {
  const { budgets, unattributed } = await getAllBudgets();
  const providers = await Promise.all(
    budgets.map(async (b: EmailBudget) => ({
      ...b,
      // Combien de lots complets restent possibles aujourd'hui.
      remainingBatches: await remainingBatches(b.provider, batchSize),
    })),
  );
  const throughput = await recentThroughput(minutes);

  return {
    generatedAt: new Date().toISOString(),
    providers,
    throughput: { minutes, sent: throughput },
    capacityBatchSize: batchSize,
    unattributed,
    alerts: buildOpsAlerts(providers, unattributed),
  };
}

/** Dernier passage de chaque cron / lot admin. Copie de `/api/admin/cron-health`. */
export async function fetchCronHealth(now = Date.now()) {
  return Promise.all(
    CRONS.map(async (c) => {
      const last = await db.analyticsEvent.findFirst({
        where: { type: c.key },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, ref: true },
      });
      return buildCronHealthRow(c, last, now);
    }),
  );
}

/**
 * Photo de l'audience (anti-doublon des annonces).
 * Copie de `getAudience()` dans `/api/admin/email-log`.
 */
export async function fetchEmailAudience() {
  const now = new Date();
  const [total, blacklisted, bounced, annonceSent, annonceRemaining] = await Promise.all([
    db.member.count({ where: { deletedAt: null } }),
    db.memberBlacklist.count({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    }),
    db.member.count({ where: { deletedAt: null, invitationStatus: "BOUNCED" } }),
    db.memberEmailLog.count({ where: { kind: "annonce" } }),
    db.member.count({
      where: {
        deletedAt: null,
        profileStatus: "APPROVED",
        NOT: { emailLogs: { some: { kind: "annonce" } } },
      },
    }),
  ]);
  return { total, blacklisted, bounced, annonceSent, annonceRemaining };
}

/** Forme de la reponse de `/api/admin/dashboard` : une source, un `null` ou une erreur. */
export interface DashboardAggregate<T> {
  value: T | null;
  error: string | null;
}

/**
 * Isole chaque bloc : une source en échec ne doit pas éteindre les six autres.
 * La forme est celle attendue par `page.tsx` : `null` + une entrée dans
 * `errors`, jamais une exception globale.
 */
export async function settle<T>(run: () => Promise<T>): Promise<DashboardAggregate<T>> {
  try {
    return { value: await run(), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** `errors` : absent quand tout va bien (le front fait `?? {}`). */
export function collectErrors(
  aggregates: Record<string, DashboardAggregate<unknown>>,
): Record<string, string> | undefined {
  const errors: Record<string, string> = {};
  for (const [label, agg] of Object.entries(aggregates)) {
    if (agg.error) errors[label] = agg.error;
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}
