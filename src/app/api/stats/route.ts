import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from "date-fns";

export const runtime = "nodejs";

interface StatsAggregate {
  totals: {
    total: number;
    approved: number;
    pending: number;
    waitlist: number;
    rejected: number;
  };
  domains: { web: number; cyber: number; ai: number };
  mentoring: number;
  byCountry: { country: string; count: number }[];
  byLevel: { level: string; count: number }[];
  byAvailability: { availability: string; count: number }[];
  byBudget: { budget: string; count: number }[];
  byArchetype: { archetype: string; count: number }[];
}

async function computeStats(startDate: Date, endDate: Date): Promise<StatsAggregate> {
  const whereCreated = {
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
    web,
    cyber,
    ai,
    mentoring,
    byCountry,
    byLevel,
    byAvailability,
    byBudget,
    byArchetype,
  ] = await Promise.all([
    db.member.count({ where: whereCreated }),
    db.member.count({ where: { ...whereCreated, profileStatus: "APPROVED" } }),
    db.member.count({ where: { ...whereCreated, profileStatus: "PENDING" } }),
    db.member.count({ where: { ...whereCreated, profileStatus: "WAITLIST" } }),
    db.member.count({ where: { ...whereCreated, profileStatus: "REJECTED" } }),
    db.member.count({ where: { ...whereCreated, primaryDomain: "web" } }),
    db.member.count({ where: { ...whereCreated, primaryDomain: "cybersecurity" } }),
    db.member.count({ where: { ...whereCreated, primaryDomain: "ai" } }),
    db.member.count({ where: { ...whereCreated, mentoringInterest: "yes" } }),
    db.member.groupBy({ by: ["country"], _count: true, orderBy: { _count: { country: "desc" } }, take: 12, where: whereCreated }),
    db.member.groupBy({ by: ["level"], _count: true, where: whereCreated }),
    db.member.groupBy({ by: ["availability"], _count: true, where: whereCreated }),
    db.member.groupBy({ by: ["budgetRange"], _count: true, where: whereCreated }),
    db.member.groupBy({ by: ["profileArchetype"], _count: true, orderBy: { _count: { profileArchetype: "desc" } }, where: whereCreated }),
  ]);

  return {
    totals: { total, approved, pending, waitlist, rejected },
    domains: { web, cyber, ai },
    mentoring,
    byCountry: byCountry.map((c) => ({ country: c.country, count: c._count })),
    byLevel: byLevel.map((l) => ({ level: l.level, count: l._count })),
    byAvailability: byAvailability.map((a) => ({ availability: a.availability, count: a._count })),
    byBudget: byBudget.map((b) => ({ budget: b.budgetRange, count: b._count })),
    byArchetype: byArchetype.filter((a) => a.profileArchetype).map((a) => ({ archetype: a.profileArchetype, count: a._count })),
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
      web,
      cyber,
      ai,
      mentoring,
      byCountry,
      byLevel,
      byAvailability,
      byBudget,
      byArchetype,
    ] = await Promise.all([
      db.member.count(),
      db.member.count({ where: { profileStatus: "APPROVED" } }),
      db.member.count({ where: { profileStatus: "PENDING" } }),
      db.member.count({ where: { profileStatus: "WAITLIST" } }),
      db.member.count({ where: { profileStatus: "REJECTED" } }),
      db.member.count({ where: { primaryDomain: "web" } }),
      db.member.count({ where: { primaryDomain: "cybersecurity" } }),
      db.member.count({ where: { primaryDomain: "ai" } }),
      db.member.count({ where: { mentoringInterest: "yes" } }),
      db.member.groupBy({ by: ["country"], _count: true, orderBy: { _count: { country: "desc" } }, take: 12 }),
      db.member.groupBy({ by: ["level"], _count: true }),
      db.member.groupBy({ by: ["availability"], _count: true }),
      db.member.groupBy({ by: ["budgetRange"], _count: true }),
      db.member.groupBy({ by: ["profileArchetype"], _count: true, orderBy: { _count: { profileArchetype: "desc" } } }),
    ]);

    return NextResponse.json({
      totals: { total, approved, pending, waitlist, rejected },
      domains: { web, cyber, ai },
      mentoring,
      byCountry: byCountry.map((c) => ({ country: c.country, count: c._count })),
      byLevel: byLevel.map((l) => ({ level: l.level, count: l._count })),
      byAvailability: byAvailability.map((a) => ({ availability: a.availability, count: a._count })),
      byBudget: byBudget.map((b) => ({ budget: b.budgetRange, count: b._count })),
      byArchetype: byArchetype.filter((a) => a.profileArchetype).map((a) => ({ archetype: a.profileArchetype, count: a._count })),
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
