import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_EXPORT = 2000;

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
  // Anti-abus : 20 exports par IP toutes les 10 minutes.
  const rl = rateLimit(`export-json:${rateKey(req)}`, {
    capacity: 20,
    refillPerSec: 1 / 30,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
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
      { firstName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];

  const total = await db.member.count({ where });
  const members = await db.member.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT,
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

  const truncated = total > MAX_EXPORT;
  return NextResponse.json(
    { exportedAt: new Date().toISOString(), count: clean.length, members: clean },
    {
      headers: {
        "Content-Disposition": `attachment; filename="hashcode-reboot-members-${Date.now()}.json"`,
        "Cache-Control": "no-store",
        ...(truncated
          ? { "X-Export-Truncated": "1", "X-Export-Total": String(total) }
          : {}),
      },
    },
  );
}
