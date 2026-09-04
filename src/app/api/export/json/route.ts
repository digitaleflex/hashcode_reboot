import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/export/json — JSON export of members (admin-only). Accepts the same
 * filter query params as GET /api/members. Returns a JSON array of member
 * objects (full detail, same as the CSV export columns). Useful for API
 * integrations or re-importing into another system.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const country = searchParams.get("country");
  const level = searchParams.get("level");
  const mentoring = searchParams.get("mentoring");
  const budget = searchParams.get("budget");
  const status = searchParams.get("status");
  const lane = searchParams.get("lane");
  const q = searchParams.get("q");

  const where: Prisma.MemberWhereInput = {};
  if (domain) where.primaryDomain = domain;
  if (country) where.country = country;
  if (level) where.level = level;
  if (mentoring) where.mentoringInterest = mentoring;
  if (budget) where.budgetRange = budget;
  if (status) where.profileStatus = status;
  if (lane) where.accessLane = lane;
  if (q)
    where.OR = [
      { firstName: { contains: q } },
      { email: { contains: q } },
    ];

  const members = await db.member.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const decode = <T,>(s: string, fallback: T): T => {
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };

  const clean = members.map((m) => ({
    ...m,
    secondaryDomains: decode<string[]>(m.secondaryDomains, []),
    domainSpecialty: decode<string[]>(m.domainSpecialty, []),
    mentoringTypes: decode<string[]>(m.mentoringTypes, []),
    tags: decode<string[]>(m.tags, []),
  }));

  return NextResponse.json(
    { exportedAt: new Date().toISOString(), count: clean.length, members: clean },
    {
      headers: {
        "Content-Disposition": `attachment; filename="hashcode-reboot-members-${Date.now()}.json"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
