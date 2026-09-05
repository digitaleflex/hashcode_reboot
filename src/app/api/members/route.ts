import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { profileSchema, answersToCreatePayload } from "@/lib/profiling/validate";
import { runAutoControls, WHATSAPP_URL } from "@/lib/profiling/auto-controls";
import { generateProfile } from "@/lib/profiling/engine";
import { sendInvitationEmail, sendWelcomeEmail } from "@/lib/mail";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** POST /api/members — submit a profile. Validates, dedups by email, runs
 * the automatic controls (branching), persists. Returns the access lane +
 * generated profile so the client can render the right branch. */
export async function POST(req: NextRequest) {
  // Anti-spam: 5 submissions per IP per 10 minutes.
  const rl = rateLimit(rateKey(req), { capacity: 5, windowMs: 600000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de soumissions. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
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
  // Anti-énumération : réponse minimale, sans memberId ni statuts — le client
  // affiche le profil LOCAL (voir page.tsx, branche duplicate).
  const existing = await db.member.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
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
          select: { id: true },
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

/** GET /api/members — admin list with filters (admin-only).
 * Pagination serveur rétro-compatible :
 * - `page` (1-based, défaut 1) + `pageSize` (défaut 50, max 200)
 * - legacy `limit` (= pageSize page 1) et `take`/`skip` toujours supportés
 * - tri serveur via `sort`/`sortKey`/`orderBy` + `dir`/`sortDir`/`order`
 *   (createdAt/firstName/primaryDomain|domain/level/profileStatus|status),
 *   défaut createdAt desc. Réponse {members, total, page, pageSize}. */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
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

    // --- Pagination : Zod strict, erreurs {error, code} façon Phase 1B ---
    const paginationSchema = z.object({
      page: z.coerce.number().int().min(1).max(10000).optional(),
      pageSize: z.coerce.number().int().min(1).max(200).optional(),
      take: z.coerce.number().int().min(1).max(200).optional(),
      skip: z.coerce.number().int().min(0).max(100000).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
      sort: z.string().max(40).optional(),
      sortKey: z.string().max(40).optional(),
      orderBy: z.string().max(40).optional(),
      dir: z.enum(["asc", "desc"]).optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
    });
    const rawParams: Record<string, string> = {};
    for (const k of [
      "page",
      "pageSize",
      "take",
      "skip",
      "limit",
      "sort",
      "sortKey",
      "orderBy",
      "dir",
      "sortDir",
      "order",
    ]) {
      const v = searchParams.get(k);
      if (v !== null) rawParams[k] = v;
    }
    const parsedParams = paginationSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: "Paramètres de pagination invalides.",
          code: "INVALID_PAYLOAD",
          issues: parsedParams.error.issues,
        },
        { status: 422 },
      );
    }
    const p = parsedParams.data;

    // Tri serveur calé sur sortKey/sortDir front (fallback createdAt desc).
    const SORT_FIELD_MAP: Record<string, "createdAt" | "firstName" | "primaryDomain" | "level" | "profileStatus"> = {
      createdAt: "createdAt",
      firstName: "firstName",
      primaryDomain: "primaryDomain",
      domain: "primaryDomain",
      level: "level",
      profileStatus: "profileStatus",
      status: "profileStatus",
    };
    const rawSort = p.sort ?? p.sortKey ?? p.orderBy ?? "createdAt";
    const mappedSort = SORT_FIELD_MAP[rawSort];
    if (!mappedSort) {
      return NextResponse.json(
        { error: "Tri invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    const dir = p.dir ?? p.sortDir ?? p.order ?? "desc";

    // Page/pageSize rétro-compatibles (limit/take/skip legacy).
    let page = p.page ?? 1;
    let pageSize = p.pageSize ?? 50;
    let skip: number;
    let take: number;
    if (p.take !== undefined || p.skip !== undefined) {
      take = p.take ?? pageSize;
      skip = p.skip ?? 0;
      pageSize = take;
      page = Math.floor(skip / take) + 1;
    } else if (p.limit !== null && p.limit !== undefined && p.page === undefined && p.pageSize === undefined) {
      take = p.limit;
      skip = 0;
      pageSize = take;
      page = 1;
    } else {
      take = pageSize;
      skip = (page - 1) * pageSize;
    }

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

    const [total, members] = await Promise.all([
      db.member.count({ where }),
      db.member.findMany({
        where,
        orderBy: { [mappedSort]: dir },
        skip,
        take,
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
      }),
    ]);

    return NextResponse.json({ members, total, page, pageSize });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
