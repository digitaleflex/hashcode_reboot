import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  getAllBudgets,
  recentThroughput,
  remainingBatches,
  type EmailBudget,
  type BudgetLevel,
} from "@/lib/email-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  /** Nombre de jours d'historique pour la délivrabilité email. */
  deliveryDays: z.coerce.number().int().min(1).max(365).optional().default(30),
  /** Taille de lot pour exprimer la capacité restante en vagues. */
  batchSize: z.coerce.number().int().min(1).max(1000).optional().default(48),
  /** Fenêtre du débit mesuré, en minutes. */
  throughputMinutes: z.coerce.number().int().min(5).max(1440).optional().default(60),
});

// ── Reused constants ────────────────────────────────────────────────

const CRONS = [
  { key: "cron_relance", label: "Relance profils (J+7)", expectedEveryH: 24 },
  { key: "cron_email_alerts", label: "Alertes délivrabilité", expectedEveryH: 24 },
  { key: "cron_collect_metrics", label: "Collecte métriques", expectedEveryH: 24 },
  { key: "cron_event_reminders", label: "Relances événements (J-3/J-1/H-1)", expectedEveryH: 1 },
  { key: "admin_announce_dashboard", label: "Annonce espace (manuel)", expectedEveryH: null },
  { key: "admin_invite_relance", label: "Relance invitations (manuel)", expectedEveryH: null },
  { key: "admin_import_invite", label: "Import invitations (manuel)", expectedEveryH: null },
] as const;

const CATEGORIES = ["welcome", "waitlist", "engagement", "relance", "other"] as const;

/**
 * Merge les entrées source en double (ex: NULL → "direct" + "direct" stocké).
 * Cause racine du `duplicate key: direct` côté Breakdown.
 */
function mergeBySource(entries: { source: string; count: number }[]): { source: string; count: number }[] {
  const merged = new Map<string, number>();
  for (const { source, count } of entries) {
    const key = (source ?? "").trim() || "direct";
    merged.set(key, (merged.get(key) ?? 0) + count);
  }
  return [...merged.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Individual fetchers (each isolated — one failure won't block others) ─

async function fetchStats() {
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

async function fetchFunnel() {
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

  // Drop-off
  const answeredMap = new Map<string, number>();
  for (const r of answeredRows) if (r.ref) answeredMap.set(r.ref, r._count);
  const abandonedMap = new Map<string, number>();
  for (const r of abandonedRows) if (r.ref) abandonedMap.set(r.ref, r._count);
  const allIds = new Set([...answeredMap.keys(), ...abandonedMap.keys()]);
  const dropoff = [...allIds].map((id) => {
    const answered = answeredMap.get(id) ?? 0;
    const abandoned = abandonedMap.get(id) ?? 0;
    const t = answered + abandoned;
    return { questionId: id, answered, abandoned, dropRate: t === 0 ? 0 : Math.round((abandoned / t) * 100) };
  }).sort((a, b) => b.dropRate - a.dropRate);

  // Timing
  const byQuestion = new Map<string, number[]>();
  for (const r of timedRows) {
    if (r.ref && r.value !== null && r.value > 0) {
      const arr = byQuestion.get(r.ref) ?? [];
      arr.push(r.value);
      byQuestion.set(r.ref, arr);
    }
  }
  const timing = [...byQuestion.entries()].map(([id, vals]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    return {
      questionId: id,
      samples: sorted.length,
      avgMs: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
      p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
    };
  }).sort((a, b) => b.avgMs - a.avgMs);

  return {
    total,
    events: rows.map((r) => ({ type: r.type, count: r._count })),
    funnel: {
      sessionsStarted: startedSessions.length,
      sessionsCompleted: completedSessions.length,
      whatsappClicks,
      completionRate: startedSessions.length === 0 ? 0 : Math.round((completedSessions.length / startedSessions.length) * 100),
    },
    dropoff,
    timing,
  };
}

async function fetchEmailEngagement() {
  const [allEvents, byCategory, draftStats, relanceDraftIds] = await Promise.all([
    db.emailEvent.findMany({
      select: { email: true, type: true, category: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 20000,
    }),
    (async () => {
      const rows = await db.emailEvent.groupBy({ by: ["category", "type"], _count: true });
      const result: Record<string, { sent: number; opened: number; clicked: number }> = {};
      for (const cat of CATEGORIES) result[cat] = { sent: 0, opened: 0, clicked: 0 };
      for (const r of rows) {
        const cat = (r.category ?? "other") as string;
        if (!result[cat]) result[cat] = { sent: 0, opened: 0, clicked: 0 };
        if (r.type === "email.sent") result[cat].sent = r._count;
        else if (r.type === "email.opened") result[cat].opened = r._count;
        else if (r.type === "email.clicked") result[cat].clicked = r._count;
      }
      return result;
    })(),
    (async () => {
      const [drafts, relanceSent, recovered] = await Promise.all([
        db.profilingDraft.count(),
        db.profilingDraft.count({ where: { relanceSentAt: { not: null } } }),
        db.profilingDraft.count({ where: { completedAt: { not: null } } }),
      ]);
      return { drafts, relanceSent, recovered };
    })(),
    db.emailEvent.findMany({
      where: { type: "email.sent", category: "relance" },
      select: { email: true },
      take: 10000,
    }),
  ]);

  const relanceEmails = new Set(relanceDraftIds.map((r) => r.email.toLowerCase()));
  const categories = Object.keys(byCategory).filter((c) => byCategory[c].sent > 0);

  const countByTypeAndEmails = (type: string): number =>
    allEvents.filter((e) => e.type === type && relanceEmails.has(e.email.toLowerCase())).length;

  return {
    summary: {
      totalSent: allEvents.filter((e) => e.type === "email.sent").length,
      totalOpened: allEvents.filter((e) => e.type === "email.opened").length,
      totalClicked: allEvents.filter((e) => e.type === "email.clicked").length,
    },
    byCategory,
    categories,
    relance: {
      drafts: draftStats.drafts,
      relanceSent: draftStats.relanceSent,
      relanceOpened: countByTypeAndEmails("email.opened"),
      relanceClicked: countByTypeAndEmails("email.clicked"),
      recovered: draftStats.recovered,
    },
  };
}

async function fetchEmailDeliverability(days: number) {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);

  const providers = ["resend", "brevo"] as const;
  const metricsByProvider: Record<string, any[]> = {};

  for (const p of providers) {
    const metrics = await db.emailProviderMetric.findMany({
      where: { provider: p, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });
    metricsByProvider[p] = metrics;
  }

  const summary = providers.map((p) => {
    const metrics = metricsByProvider[p] || [];
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
      { sent: 0, delivered: 0, bounced: 0, complained: 0, unsubscribed: 0, opened: 0, clicked: 0, uniqueOpened: 0, uniqueClicked: 0 },
    );

    const deliveryRate = totals.sent > 0 ? totals.delivered / totals.sent : 0;
    const openRate = totals.delivered > 0 ? totals.uniqueOpened / totals.delivered : 0;
    const clickRate = totals.delivered > 0 ? totals.uniqueClicked / totals.delivered : 0;
    const bounceRate = totals.sent > 0 ? totals.bounced / totals.sent : 0;
    const complaintRate = totals.delivered > 0 ? totals.complained / totals.delivered : 0;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const last7 = metrics.filter((m) => m.date >= sevenDaysAgo);
    const prev7 = metrics.filter((m) => m.date >= fourteenDaysAgo && m.date < sevenDaysAgo);
    const sumLast7 = last7.reduce((a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }), { sent: 0, delivered: 0 });
    const sumPrev7 = prev7.reduce((a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }), { sent: 0, delivered: 0 });
    const volumeChange = sumPrev7.sent > 0 ? (sumLast7.sent - sumPrev7.sent) / sumPrev7.sent : 0;
    const deliveryChange =
      sumPrev7.delivered > 0 && sumLast7.delivered > 0
        ? sumLast7.delivered / sumLast7.sent - sumPrev7.delivered / sumPrev7.sent
        : 0;

    return {
      provider: p,
      totals,
      rates: { deliveryRate, openRate, clickRate, bounceRate, complaintRate },
      comparison: { volumeChange, deliveryChange },
      daysWithData: metrics.length,
    };
  });

  const chartData = providers.map((p) => ({
    provider: p,
    data: (metricsByProvider[p] || []).map((m) => ({
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
  }));

  return {
    dateRange: { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] },
    summary,
    chartData,
  };
}

async function fetchEmailOps(batchSize: number, minutes: number) {
  const { budgets, unattributed } = await getAllBudgets();
  const enriched = await Promise.all(
    budgets.map(async (b: EmailBudget) => ({
      ...b,
      remainingBatches: await remainingBatches(b.provider, batchSize),
    })),
  );
  const throughput = await recentThroughput(minutes);

  const alerts: { level: "warn" | "critical"; provider?: string; message: string }[] = [];
  for (const b of enriched) {
    if (b.level === "blocked") {
      alerts.push({
        level: "critical",
        provider: b.provider,
        message:
          `Quota ${b.provider} épuisé : ${b.used}/${b.cap} envois aujourd'hui. ` +
          `Les envois sont suspendus jusqu'à 00:00 UTC ; les destinataires non ` +
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
          `Quota ${b.provider} à ${Math.round(b.ratio * 100)} % ` +
          `(${b.used}/${b.cap}). Taille de lot réduite à 5 avec pause de 200 ms.`,
      });
    }
  }
  if (unattributed > 0) {
    alerts.push({
      level: "warn",
      message:
        `${unattributed} envoi(s) aujourd'hui sans provider identifié ` +
        `(lignes antérieures à l'ajout de la colonne). Ils ne sont pas comptés ` +
        `dans les quotas ci-dessus.`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    providers: enriched,
    throughput: { minutes, sent: throughput },
    capacityBatchSize: batchSize,
    unattributed,
    alerts,
  };
}

async function fetchCronHealth() {
  const now = Date.now();
  return Promise.all(
    CRONS.map(async (c) => {
      const last = await db.analyticsEvent.findFirst({
        where: { type: c.key },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, ref: true },
      });
      const ageMs = last ? now - last.createdAt.getTime() : null;
      const status: "ok" | "stale" | "never" | "manual" = !last
        ? "never"
        : c.expectedEveryH === null
          ? "manual"
          : ageMs !== null && ageMs <= c.expectedEveryH * 2 * 3600 * 1000
            ? "ok"
            : "stale";
      return {
        key: c.key,
        label: c.label,
        expectedEveryH: c.expectedEveryH,
        lastRun: last?.createdAt ?? null,
        summary: last?.ref ?? null,
        status,
      };
    }),
  );
}

async function fetchEmailAudience() {
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

/**
 * GET /api/admin/dashboard — vue d'ensemble 360° (admin-only).
 *
 * Toutes les sources sont fetchées en parallèle côté serveur. Une section en
 * échec ne bloque pas les autres : chaque bloc est isolé dans son propre
 * try/catch et renvoie `null` en cas d'erreur, avec un `_error` explicite.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    deliveryDays: searchParams.get("deliveryDays") ?? undefined,
    batchSize: searchParams.get("batchSize") ?? undefined,
    throughputMinutes: searchParams.get("throughputMinutes") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { deliveryDays, batchSize, throughputMinutes } = parsed.data;

  // ── Fetch ALL data sources in parallel ──────────────────────────────
  const [
    stats, funnel, emailStats, emailDeliverability,
    emailOps, cronHealth, audience,
  ] = await Promise.all([
    fetchStats().catch((e) => ({ _error: e instanceof Error ? e.message : String(e) })),
    fetchFunnel().catch((e) => ({ _error: e instanceof Error ? e.message : String(e) })),
    fetchEmailEngagement().catch((e) => ({ _error: e instanceof Error ? e.message : String(e) })),
    fetchEmailDeliverability(deliveryDays).catch((e) => ({ _error: e instanceof Error ? e.message : String(e) })),
    fetchEmailOps(batchSize, throughputMinutes).catch((e) => ({ _error: e instanceof Error ? e.message : String(e) })),
    fetchCronHealth().catch((e) => [{ _error: e instanceof Error ? e.message : String(e) }]),
    fetchEmailAudience().catch((e) => ({ _error: e instanceof Error ? e.message : String(e) })),
  ]);

  const hasStatsError = "_error" in stats;
  const hasFunnelError = "_error" in funnel;
  const hasEmailStatsError = "_error" in emailStats;
  const hasDeliverabilityError = "_error" in emailDeliverability;
  const hasOpsError = "_error" in emailOps;
  const hasCronError = "_error" in (cronHealth[0] ?? {});
  const hasAudienceError = "_error" in audience;

  const errors: Record<string, string> = {};
  if (hasStatsError) errors.stats = (stats as { _error: string })._error;
  if (hasFunnelError) errors.funnel = (funnel as { _error: string })._error;
  if (hasEmailStatsError) errors.emailStats = (emailStats as { _error: string })._error;
  if (hasDeliverabilityError) errors.emailDeliverability = (emailDeliverability as { _error: string })._error;
  if (hasOpsError) errors.emailOps = (emailOps as { _error: string })._error;
  if (hasCronError) errors.cronHealth = (cronHealth[0] as { _error?: string })._error ?? "Erreur inconnue";
  if (hasAudienceError) errors.audience = (audience as { _error: string })._error;

  return NextResponse.json({
    ok: Object.keys(errors).length === 0,
    generatedAt: new Date().toISOString(),
    stats: hasStatsError ? null : stats,
    funnel: hasFunnelError ? null : funnel,
    emailStats: hasEmailStatsError ? null : emailStats,
    emailDeliverability: hasDeliverabilityError ? null : emailDeliverability,
    emailOps: hasOpsError ? null : emailOps,
    cronHealth: hasCronError ? null : cronHealth,
    audience: hasAudienceError ? null : audience,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  });
}
