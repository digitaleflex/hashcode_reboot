import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_EXPORT = 2000;

/** GET /api/export — CSV export of members (admin-only). Accepts the same
 * filter query params as GET /api/members so the admin can export the
 * currently-filtered view, or all members if no params. */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  // Anti-abus : 20 exports par IP toutes les 10 minutes.
  const rl = await rateLimit(`export:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");
    const country = searchParams.get("country");
    const level = searchParams.get("level");
    const mentoring = searchParams.get("mentoring");
    const budget = searchParams.get("budget");
    const status = searchParams.get("status");
    const lane = searchParams.get("lane");
    const q = searchParams.get("q");
    const fieldsParam = searchParams.get("fields");

    const where: Prisma.MemberWhereInput = {};
    where.deletedAt = null; // exclude soft-deleted members
    if (domain) where.primaryDomain = domain;
    if (country) where.country = country;
    if (level) where.level = level;
    if (mentoring) where.mentoringInterest = mentoring;
    if (budget) where.budgetRange = budget;
    if (status) where.profileStatus = status;
    if (lane) where.accessLane = lane;
    if (q)
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];

    const total = await db.member.count({ where });
    const members = await db.member.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT,
    });

    const ALL_HEADERS = [
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

    // Support optional column filtering via `fields` query param (comma-separated).
    let headers = ALL_HEADERS;
    if (fieldsParam) {
      const requested = fieldsParam
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      headers = ALL_HEADERS.filter((h) => requested.includes(h));
    }

    const esc = (v: unknown): string => {
      const s = v === null || v === undefined ? "" : String(v);
      // RFC 4180 quoting.
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    // Build a map of field → value for each member.
    const fieldMap = (m: (typeof members)[number]): Record<string, unknown> => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      phone: m.phone,
      country: m.country,
      city: m.city,
      gender: m.gender,
      primaryDomain: m.primaryDomain,
      domainSpecialty: m.domainSpecialty,
      level: m.level,
      goal: m.goal,
      goalProjectStage: m.goalProjectStage,
      goalSituation: m.goalSituation,
      availability: m.availability,
      learningStyle: m.learningStyle,
      mentoringInterest: m.mentoringInterest,
      mentoringMaybeReason: m.mentoringMaybeReason,
      mentoringTypes: m.mentoringTypes,
      mentoringFrequency: m.mentoringFrequency,
      mentoringDomain: m.mentoringDomain,
      budgetWillingness: m.budgetWillingness,
      budgetRange: m.budgetRange,
      threeMonthGoal: m.threeMonthGoal,
      profileArchetype: m.profileArchetype,
      tags: m.tags,
      profileStatus: m.profileStatus,
      communityStatus: m.communityStatus,
      accessLane: m.accessLane,
      adminNote: m.adminNote,
    });

    const rows = members.map((m) => {
      const row = fieldMap(m);
      return headers.map((h) => esc(row[h])).join(",");
    });

    const csv = [headers.map(esc).join(","), ...rows].join("\r\n");

    // Audit isolé : ne casse jamais l'export si l'audit échoue.
    try {
      await db.analyticsEvent.create({
        data: {
          type: "community_cta_clicked",
          ref: `admin-export-csv:${members.length}/${total}`,
        },
      });
    } catch {
      /* ignore */
    }

    const truncated = total > MAX_EXPORT;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hashcode-reboot-members-${Date.now()}.csv"`,
        "Cache-Control": "no-store",
        ...(truncated
          ? { "X-Export-Truncated": "1", "X-Export-Total": String(total) }
          : {}),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
