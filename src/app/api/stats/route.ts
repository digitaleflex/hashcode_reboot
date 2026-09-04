import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** GET /api/stats — dashboard aggregates (admin-only). */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
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
    byAvailability: byAvailability.map((a) => ({
      availability: a.availability,
      count: a._count,
    })),
    byBudget: byBudget.map((b) => ({ budget: b.budgetRange, count: b._count })),
    byArchetype: byArchetype
      .filter((a) => a.profileArchetype)
      .map((a) => ({ archetype: a.profileArchetype, count: a._count })),
  });
}
