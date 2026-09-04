import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** GET /api/export — CSV export of members (admin-only). Accepts the same
 * filter query params as GET /api/members so the admin can export the
 * currently-filtered view, or all members if no params. */
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

  const headers = [
    "id",
    "createdAt",
    "firstName",
    "lastName",
    "email",
    "phone",
    "country",
    "city",
    "gender",
    "primaryDomain",
    "domainSpecialty",
    "level",
    "goal",
    "goalProjectStage",
    "goalSituation",
    "availability",
    "learningStyle",
    "mentoringInterest",
    "mentoringMaybeReason",
    "mentoringTypes",
    "mentoringFrequency",
    "mentoringDomain",
    "budgetWillingness",
    "budgetRange",
    "threeMonthGoal",
    "profileArchetype",
    "tags",
    "profileStatus",
    "communityStatus",
    "accessLane",
    "adminNote",
  ];

  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    // RFC 4180 quoting.
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = members.map((m) =>
    [
      m.id,
      m.createdAt.toISOString(),
      m.firstName,
      m.lastName,
      m.email,
      m.phone,
      m.country,
      m.city,
      m.gender,
      m.primaryDomain,
      m.domainSpecialty,
      m.level,
      m.goal,
      m.goalProjectStage,
      m.goalSituation,
      m.availability,
      m.learningStyle,
      m.mentoringInterest,
      m.mentoringMaybeReason,
      m.mentoringTypes,
      m.mentoringFrequency,
      m.mentoringDomain,
      m.budgetWillingness,
      m.budgetRange,
      m.threeMonthGoal,
      m.profileArchetype,
      m.tags,
      m.profileStatus,
      m.communityStatus,
      m.accessLane,
      m.adminNote,
    ]
      .map(esc)
      .join(","),
  );

  const csv = [headers.map(esc).join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hashcode-reboot-members-${Date.now()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
