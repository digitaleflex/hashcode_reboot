import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Budgets qui qualifient un lead mentorat haute valeur (cf. auto-controls). */
export const HIGH_BUDGET_TIERS = ["20000-30000", ">30000"];

/**
 * GET /api/admin/mentoring/leads — leads mentorat prioritaires.
 *
 * Les mêmes critères que `runAutoControls` (mentoring=yes + budget élevé +
 * lane pending), recalculés en base : pas de raison stockée, la requête fait
 * foi. Inclut le mentor assigné (s'il existe) et la date de contact.
 *
 * AUTH : admin operator (403 sinon).
 */
export async function GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`admin-mentoring-leads:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const leads = await db.member.findMany({
    where: {
      deletedAt: null,
      accessLane: "pending",
      mentoringInterest: "yes",
      budgetRange: { in: HIGH_BUDGET_TIERS },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      country: true,
      primaryDomain: true,
      profileArchetype: true,
      budgetRange: true,
      budgetWillingness: true,
      mentoringFrequency: true,
      mentoringTypes: true,
      createdAt: true,
      mentorContactedAt: true,
      mentorshipsAsMentee: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        select: {
          id: true,
          status: true,
          frequency: true,
          mentor: { select: { id: true, firstName: true, lastName: true } },
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ leads, total: leads.length });
}
