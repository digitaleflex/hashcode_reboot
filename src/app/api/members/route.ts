import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { profileSchema, answersToCreatePayload } from "@/lib/profiling/validate";
import { runAutoControls, WHATSAPP_URL } from "@/lib/profiling/auto-controls";
import { generateProfile } from "@/lib/profiling/engine";
import { sendInvitationEmail, sendWelcomeEmail, sendWaitlistEmail, sendVerificationLinkEmail } from "@/lib/mail";
import { requestEmailLink, buildVerifyUrl } from "@/lib/verify-email";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { isAdminAuthed } from "@/lib/admin-auth";
import { isEmailBlacklisted } from "@/lib/blacklist";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";

export const runtime = "nodejs";

/** POST /api/members — submit a profile. Validates, dedups by email, runs
 * the automatic controls (branching), persists. Returns the access lane +
 * generated profile so the client can render the right branch. */
export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;
  // Anti-spam: 5 submissions per IP per 10 minutes (bucket dédié).
  const rl = await rateLimit(`members-submit:${rateKey(req)}`, { capacity: 5, windowMs: 600000 });
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

  // Blacklist + dédup en parallèle (2 lectures indépendantes).
  // Anti-énumération : messages génériques, sans memberId ni statuts.
  const [blacklisted, existing] = await Promise.all([
    isEmailBlacklisted(data.email),
    db.member.findUnique({
      where: { email: data.email },
      select: { id: true },
    }),
  ]);
  if (blacklisted) {
    // Log interne pour debug, mais pas de leak côté client
    console.warn(
      `[signup] Blocked signup for blacklisted email (reason=${blacklisted.reason})`,
    );
    return NextResponse.json(
      {
        error:
          "Impossible de créer ton profil avec cet email. Contacte-nous à privacy@joinhashcode.com si tu penses qu'il s'agit d'une erreur.",
        code: "EMAIL_NOT_ACCEPTED",
      },
      { status: 403 },
    );
  }

  // Anti-duplication: if email exists, surface a clean "already started" state.
  // Le client affiche le profil LOCAL (voir page.tsx, branche duplicate).
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
        source: data.source ?? "direct",
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

// Écritures secondaires en parallèle (analytics + draft) — jamais bloquantes.
  const drafting = controls.profileStatus === "PENDING";
  await Promise.allSettled([
    db.analyticsEvent.create({
      data: {
        type: "profil_generated",
        memberId: created.id,
        ref: controls.accessLane,
      },
    }),
    ...(drafting
      ? [
          db.profilingDraft.upsert({
            where: { email: data.email.toLowerCase() },
            update: {
              answers: JSON.stringify(data),
              updatedAt: new Date(),
              relanceSentAt: null,
            },
            create: {
              email: data.email.toLowerCase(),
              answers: JSON.stringify(data),
              firstName: data.firstName?.slice(0, 40) ?? "",
              lastQuestionId: null,
              relanceSentAt: null,
            },
          }),
        ]
      : []),
  ]);

  // Emails en arrière-plan : on répond 201 sans attendre les providers
  // (chaque envoi a son timeout 8s — les await séquentiels coûtaient jusqu'à 24s de TTFB).
  const email = data.email;
  const firstName = data.firstName;
  const archetype = generated.archetype;
  const lane = created.accessLane;
  void (async () => {
    try {
      const link = await requestEmailLink(email);
      if (link.ok) {
        await sendVerificationLinkEmail({
          to: email,
          firstName,
          url: buildVerifyUrl(link.token),
        });
      }
    } catch {
      /* email must never break the flow */
    }
    if (lane === "immediate") {
      await Promise.allSettled([
        sendWelcomeEmail({ to: email, firstName, archetype }),
        sendInvitationEmail({ to: email, firstName, whatsappUrl: WHATSAPP_URL }),
      ]);
    } else {
      try {
        await sendWaitlistEmail({ to: email, firstName });
      } catch {
        /* email must never break the flow */
      }
    }
  })();

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
    const type = searchParams.get("type");
    const invitationStatus = searchParams.get("invitationStatus");
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
    where.deletedAt = null; // exclude soft-deleted members
    if (domain) where.primaryDomain = domain;
    if (country) where.country = country;
    if (level) where.level = level;
    if (mentoring) where.mentoringInterest = mentoring;
    if (budget) where.budgetRange = budget;
    if (status) where.profileStatus = status;
    if (lane) where.accessLane = lane;
    // Distingue vrais inscrits vs invités importés (additif, défaut = tous).
    if (invitationStatus) where.invitationStatus = invitationStatus;
    else if (type === "registered") where.invitationStatus = "NOT_INVITED";
    else if (type === "invited") where.invitationStatus = { not: "NOT_INVITED" };
    if (q) {
      // Support `email:user@example.com` syntax for email-only search
      const emailPrefix = q.match(/^email:(.+)$/i);
      if (emailPrefix) {
        const emailQuery = emailPrefix[1].trim();
        if (emailQuery) {
          where.OR = [
            { email: { contains: emailQuery, mode: "insensitive" } },
          ];
        }
      } else {
        where.OR = [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ];
      }
    }

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
          invitationStatus: true,
          source: true,
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
