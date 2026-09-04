import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { profileSchema, answersToCreatePayload } from "@/lib/profiling/validate";
import { runAutoControls, WHATSAPP_URL } from "@/lib/profiling/auto-controls";
import { generateProfile } from "@/lib/profiling/engine";
import { sendInvitationEmail, sendWelcomeEmail } from "@/lib/mail";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** POST /api/members — submit a profile. Validates, dedups by email, runs
 * the automatic controls (branching), persists. Returns the access lane +
 * generated profile so the client can render the right branch. */
export async function POST(req: NextRequest) {
  // Anti-spam: 5 submissions per IP per 10 minutes (capacity 5, refill 1/120s).
  const rl = rateLimit(rateKey(req), { capacity: 5, refillPerSec: 1 / 120 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de soumissions. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Données invalides.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // Anti-duplication: if email exists, surface a clean "already started" state.
  const existing = await db.member.findUnique({
    where: { email: data.email },
    select: {
      id: true,
      accessLane: true,
      profileStatus: true,
      communityStatus: true,
    },
  });
  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        memberId: existing.id,
        accessLane: existing.accessLane,
        profileStatus: existing.profileStatus,
        communityStatus: existing.communityStatus,
        message: "Tu as déjà commencé ton profil HASHCODE.",
      },
      { status: 200 },
    );
  }

  // Strategic branching: automatic controls.
  const controls = runAutoControls(data);
  const generated = generateProfile(data);

  const created = await db.member
    .create({
      data: {
        ...answersToCreatePayload(data),
        profileArchetype: generated.archetype,
        tags: JSON.stringify(generated.tags),
        profileStatus: controls.profileStatus,
        communityStatus: controls.communityStatus,
        accessLane: controls.accessLane,
      },
      select: { id: true, accessLane: true, profileStatus: true, communityStatus: true },
    })
    .catch(async (e: unknown) => {
      // Duplicate-email race: same 200 duplicate shape as the pre-check above.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const raced = await db.member.findUnique({
          where: { email: data.email },
          select: {
            id: true,
            accessLane: true,
            profileStatus: true,
            communityStatus: true,
          },
        });
        if (raced) {
          return { ...raced, __duplicate: true as const };
        }
      }
      throw e;
    });

  if ("__duplicate" in created) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        memberId: created.id,
        accessLane: created.accessLane,
        profileStatus: created.profileStatus,
        communityStatus: created.communityStatus,
        message: "Tu as déjà commencé ton profil HASHCODE.",
      },
      { status: 200 },
    );
  }

  // Server-side funnel event (member now exists).
  try {
    await db.analyticsEvent.create({
      data: {
        type: "profil_generated",
        memberId: created.id,
        ref: controls.accessLane,
      },
    });
  } catch {
    /* analytics must never break the flow */
  }

  // Emails réels (lane immediate uniquement) : fire-and-forget, jamais bloquant.
  if (created.accessLane === "immediate") {
    try {
      await sendWelcomeEmail({
        to: data.email,
        firstName: data.firstName,
        archetype: generated.archetype,
      });
    } catch {
      /* email must never break the flow */
    }
    try {
      await sendInvitationEmail({
        to: data.email,
        firstName: data.firstName,
        whatsappUrl: WHATSAPP_URL,
      });
    } catch {
      /* email must never break the flow */
    }
  }

  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      memberId: created.id,
      accessLane: created.accessLane,
      profileStatus: created.profileStatus,
      communityStatus: created.communityStatus,
      reasons: controls.reasons,
      profile: generated,
    },
    { status: 201 },
  );
}

/** GET /api/members — admin list with filters (admin-only). */
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
  const rawLimit = searchParams.get("limit");
  const n = rawLimit === null ? 50 : Number(rawLimit);
  const limit = Number.isFinite(n)
    ? Math.min(Math.max(Math.floor(n), 1), 200)
    : 50;

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

  const members = await db.member.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      country: true,
      primaryDomain: true,
      level: true,
      goal: true,
      mentoringInterest: true,
      budgetRange: true,
      profileStatus: true,
      communityStatus: true,
      accessLane: true,
      createdAt: true,
      adminNote: true,
    },
  });

  return NextResponse.json({ members });
}
