import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Fusionne les entrées source en double (ex: NULL → "direct" + "direct" stocké).
 *  Cause racine du `duplicate key: direct` côté Breakdown. */
function mergeBySource(
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

interface StatsAggregate {
  totals: {
    total: number;
    approved: number;
    pending: number;
    waitlist: number;
    rejected: number;
  };
  /** Distingue vrais inscrits (formulaire rempli) vs invités importés. */
  invitations: {
    registered: number;
    invited: number;
  };
  domains: { web: number; cyber: number; ai: number };
  mentoring: number;
  byCountry: { country: string; count: number }[];
  byLevel: { level: string; count: number }[];
  byAvailability: { availability: string; count: number }[];
  byBudget: { budget: string | null; count: number }[];
  byArchetype: { archetype: string; count: number }[];
  bySource: { source: string; count: number }[];
  email: {
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
  };
}

async function computeStats(startDate: Date, endDate: Date): Promise<StatsAggregate> {
  const whereCreated = {
    deletedAt: null, // exclude soft-deleted members
    createdAt: {
      gte: startDate,
      lt: endDate,
    },
  };

  const [
    total,
    approved,
    pending,
    waitlist,
    rejected,
    registered,
    invited,
    web,
    cyber,
    ai,
    mentoring,
    byCountry,
    byLevel,
    byAvailability,
    byBudget,
    byArchetype,
    bySource,
    emailSent,
    emailOpened,
    emailClicked,
  ] = await Promise.all([
    db.member.count({ where: whereCreated }),
    db.member.count({ where: { ...whereCreated, profileStatus: "APPROVED" } }),
    db.member.count({ where: { ...whereCreated, profileStatus: "PENDING" } }),
    db.member.count({ where: { ...whereCreated, profileStatus: "WAITLIST" } }),
    db.member.count({ where: { ...whereCreated, profileStatus: "REJECTED" } }),
    db.member.count({ where: { ...whereCreated, invitationStatus: "NOT_INVITED" } }),
    db.member.count({ where: { ...whereCreated, invitationStatus: { not: "NOT_INVITED" } } }),
    db.member.count({ where: { ...whereCreated, primaryDomain: "web" } }),
    db.member.count({ where: { ...whereCreated, primaryDomain: "cybersecurity" } }),
    db.member.count({ where: { ...whereCreated, primaryDomain: "ai" } }),
    db.member.count({ where: { ...whereCreated, mentoringInterest: "yes" } }),
    db.member.groupBy({ by: ["country"], _count: true, orderBy: { _count: { country: "desc" } }, take: 12, where: whereCreated }),
    db.member.groupBy({ by: ["level"], _count: true, where: whereCreated }),
    db.member.groupBy({ by: ["availability"], _count: true, where: whereCreated }),
    db.member.groupBy({ by: ["budgetRange"], _count: true, where: whereCreated }),
    db.member.groupBy({ by: ["profileArchetype"], _count: true, orderBy: { _count: { profileArchetype: "desc" } }, where: whereCreated }),
    db.member.groupBy({ by: ["source"], _count: true, orderBy: { _count: { source: "desc" } }, take: 10, where: whereCreated }),
    db.emailEvent.count({ where: { ...whereCreated, type: "email.sent" } }),
    db.emailEvent.count({ where: { ...whereCreated, type: "email.opened" } }),
    db.emailEvent.count({ where: { ...whereCreated, type: "email.clicked" } }),
  ]);

  const emailSentN = emailSent;
  const emailOpenedN = emailOpened;
  const emailClickedN = emailClicked;

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
      sent: emailSentN,
      opened: emailOpenedN,
      clicked: emailClickedN,
      openRate: emailSentN === 0 ? 0 : Math.round((emailOpenedN / emailSentN) * 100),
      clickRate: emailSentN === 0 ? 0 : Math.round((emailClickedN / emailSentN) * 100),
    },
  };
}

function computeChange(current: StatsAggregate, previous: StatsAggregate) {
  const pct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };
  return {
    totalPct: pct(current.totals.total, previous.totals.total),
    approvedPct: pct(current.totals.approved, previous.totals.approved),
    pendingPct: pct(current.totals.pending, previous.totals.pending),
    waitlistPct: pct(current.totals.waitlist, previous.totals.waitlist),
    rejectedPct: pct(current.totals.rejected, previous.totals.rejected),
  };
}

/** GET /api/stats — dashboard aggregates (admin-only). */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const compare = searchParams.get("compare") === "true";
  const period = (searchParams.get("period") ?? "month") as "week" | "month";

  if (!compare) {
    // Original behavior: all-time stats
    const [
      total,
      approved,
      pending,
      waitlist,
      rejected,
      registered,
      invited,
      web,
      cyber,
      ai,
      mentoring,
      byCountry,
      byLevel,
      byAvailability,
      byBudget,
      byArchetype,
      bySource,
      emailSent,
      emailOpened,
      emailClicked,
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

    const emailSentN = emailSent;
    const emailOpenedN = emailOpened;
    const emailClickedN = emailClicked;

    return NextResponse.json({
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
        sent: emailSentN,
        opened: emailOpenedN,
        clicked: emailClickedN,
        openRate: emailSentN === 0 ? 0 : Math.round((emailOpenedN / emailSentN) * 100),
        clickRate: emailSentN === 0 ? 0 : Math.round((emailClickedN / emailSentN) * 100),
      },
    });
  }

  // Compare mode: compute current and previous period stats
  const now = new Date();
  const periodDays = period === "week" ? 7 : 30;

  // Current period: last N days
  const currentStart = subDays(now, periodDays);
  // Previous period: N days before that
  const previousStart = subDays(currentStart, periodDays);
  const previousEnd = currentStart;

  const [current, previous] = await Promise.all([
    computeStats(currentStart, now),
    computeStats(previousStart, previousEnd),
  ]);

  const change = computeChange(current, previous);

  return NextResponse.json({
    current,
    previous,
    change,
  });
}
