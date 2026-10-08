import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { createProfileSchema, answersToCreatePayload } from "@/lib/profiling/validate";
import { runAutoControls } from "@/lib/profiling/auto-controls";
import { generateProfile } from "@/lib/profiling/engine";
import { orientationEngine } from "@/lib/orientation/engine";
import { toQualificationData, toAcquisitionQualificationData } from "@/lib/qualification";
import { qualifyLead } from "@/lib/qualification/acquisition";
import type { AcquisitionQualification } from "@/lib/qualification/acquisition";
import { normalizeSource } from "@/lib/acquisition";
import { loadPublishedActivitiesWithTimeout } from "@/lib/orientation/activities";
import type { OrientationResult } from "@/lib/orientation/types";
import { sendOnboardingEmails } from "@/lib/onboarding-emails";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { isAdminAuthed } from "@/lib/admin-auth";
import { isEmailBlacklisted } from "@/lib/blacklist";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import {
  AppError,
  AuthError,
  errorToResponse,
  parseJsonBody,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";
import {
  issuePhoneFillTicket,
  phoneFillSetCookie,
} from "@/lib/phone-fill-ticket";
import { getTranslations } from "next-intl/server";

export const runtime = "nodejs";

/** POST /api/members — submit a profile. Validates, dedups by email, runs
 * the automatic controls (branching), persists. Returns the access lane +
 * generated profile so the client can render the right branch. */
export async function POST(req: NextRequest) {
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;
  // Anti-spam: 5 submissions per IP per 10 minutes (bucket dédié).
  const rl = await rateLimit(`members-submit:${rateKey(req)}`, { capacity: 5, windowMs: 600000 });
  if (!rl.ok) {
    const t = await getTranslations("profiling");
    throw new RateLimitError(t("api.tooManySubmissions"), rl.retryAfterMs);
  }

  const body = await parseJsonBody(req);

  // Get translations for validation
  const t = await getTranslations("profiling");
  const profileSchema = createProfileSchema(t);

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      t("api.invalidData"),
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
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
    throw new AppError(
      "Impossible de créer ton profil avec cet email. Contacte-nous à privacy@joinhashcode.com si tu penses qu'il s'agit d'une erreur.",
      { status: 403, code: "EMAIL_NOT_ACCEPTED" },
    );
  }

  // Anti-duplication: if email exists, surface a clean "already started" state.
  // Le client affiche le profil LOCAL (voir page.tsx, branche duplicate).
  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        message: t("api.duplicateProfile"),
      },
      { status: 200 },
    );
  }

  // Strategic branching: automatic controls.
  const controls = runAutoControls(data);
  const generated = generateProfile(data);

  // Qualification acquisition #211 : snapshot pur (jamais bloquant —
  // qualifyLead est total, mais on isole tout échec par principe).
  let acquisition: AcquisitionQualification | null = null;
  try {
    acquisition = qualifyLead(data);
  } catch {
    /* la qualification acquisition ne doit jamais casser l'inscription */
  }

  // Orientation engine (M3/M4) : pure, déterministe, jamais bloquant.
  // Catalogue réel (DB) avec repli seed. Les recommandations exposent
  // uniquement des métadonnées d'activités déjà validées par le catalogue ;
  // les scores/confiance globaux restent internes.
  let orientation: OrientationResult | null = null;
  let nextBestAction: OrientationResult["nextBestAction"] = null;
  let orientationStatus: OrientationResult["status"] = "NO_MATCH";
  let orientationRecommendations: OrientationResult["recommendations"] = [];
  try {
    const live = await loadPublishedActivitiesWithTimeout(1500).catch(
      () => null,
    );
    orientation =
      live && live.length > 0
        ? orientationEngine.evaluateWithActivities(data, live)
        : orientationEngine.evaluate(data);
    nextBestAction = orientation.nextBestAction;
    orientationStatus = orientation.status;
    orientationRecommendations = orientation.recommendations;
  } catch {
    /* l'orientation ne doit jamais casser l'inscription */
  }

  const created = await db.member
    .create({
      data: {
        ...answersToCreatePayload(data),
        // Source d'acquisition normalisée (#210 p2 : lowercase, trim,
        // alias "" → "direct") pour garder l'index source exploitable.
        source: normalizeSource(data.source),
        profileArchetype: generated.archetype,
        tags: JSON.stringify(generated.tags),
        profileStatus: controls.profileStatus,
        communityStatus: controls.communityStatus,
        accessLane: controls.accessLane,
        ...(controls.profileStatus === "APPROVED" ? { approvedAt: new Date() } : {}),
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
        message: t("api.duplicateProfile"),
      },
      { status: 200 },
    );
  }

  // Écritures secondaires en parallèle (analytics + draft + qualification) —
  // jamais bloquantes (allSettled : un échec n'annule ni les autres ni la 201).
  const drafting = controls.profileStatus === "PENDING";
  await Promise.allSettled([
    db.analyticsEvent.create({
      data: toServerEventData({
        type: "profil_generated",
        memberId: created.id,
        ref: controls.accessLane,
      }),
    }),
    // Qualification #210 p2 : une ligne par calcul (append-only).
    ...(orientation
      ? [
          db.qualification.create({
            data: toQualificationData(created.id, orientation),
          }),
        ]
      : []),
    // Qualification acquisition #211 : snapshot d'entrée (append-only,
    // archetype NULL — discriminant : ruleVersion préfixée "acq-").
    ...(acquisition
      ? [
          db.qualification.create({
            data: toAcquisitionQualificationData(created.id, acquisition),
          }),
        ]
      : []),
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
  // Orchestration dans src/lib/onboarding-emails.ts (lien de vérification
  // + welcome/invitation ou waitlist selon la lane, idempotence 24 h,
  // garde budget fail-open). La décision de lane reste ici.
  const email = data.email;
  const firstName = data.firstName;
  const archetype = generated.archetype;
  const lane = created.accessLane;
  void sendOnboardingEmails({ id: created.id, email, firstName, archetype }, lane);

  const res = NextResponse.json(
    {
      ok: true,
      duplicate: false,
      memberId: created.id,
      accessLane: created.accessLane,
      profileStatus: created.profileStatus,
      communityStatus: created.communityStatus,
      reasons: controls.reasons,
      profile: generated,
      nextBestAction,
      orientationStatus,
      orientationRecommendations,
    },
    { status: 201 },
  );

  // Ticket de remplissage WhatsApp (S3) : prouve que ce navigateur vient de
  // créer ce membre — autorise POST /api/account/phone sans session.
  // Création fraîche uniquement, jamais sur doublon.
  const fillTicket = issuePhoneFillTicket(created.id);
  if (fillTicket) {
    res.headers.append("Set-Cookie", phoneFillSetCookie(fillTicket));
  }
  return res;
  } catch (err) {
    return errorToResponse(err);
  }
}

/** GET /api/members — admin list with filters (admin-only).
 * Pagination serveur rétro-compatible :
 * - `page` (1-based, défaut 1) + `pageSize` (défaut 50, max 200)
 * - legacy `limit` (= pageSize page 1) et `take`/`skip` toujours supportés
 * - tri serveur via `sort`/`sortKey`/`orderBy` + `dir`/`sortDir`/`order`
 *   (createdAt/firstName/primaryDomain|domain/level/profileStatus|status),
 *   défaut createdAt desc. Réponse {members, total, page, pageSize}. */
export async function GET(req: NextRequest) {
  try {
  if (!(await isAdminAuthed(req))) {
    const t = await getTranslations("profiling");
    throw new AuthError(t("api.unauthorized"), "UNAUTHORIZED");
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
    const tagParam = searchParams.get("tag");

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
      const t = await getTranslations("profiling");
      throw new ValidationError(t("api.invalidPagination"), parsedParams.error.issues);
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
      const t = await getTranslations("profiling");
      throw new ValidationError(t("api.invalidSort"));
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
    // Pipeline onboarding (#106) : filtre `stage` -> etape du funnel.
    // Mapping valide : pending -> {profileStatus:PENDING},
    // approved -> {profileStatus:APPROVED}, invited -> {communityStatus:INVITED},
    // active -> {communityStatus:JOINED}, toujours avec {deletedAt:null} (ci-dessus).
    // WAITLIST/REJECTED sont des colonnes laterales (hors funnel) et accessLane
    // n'est pas une etape : ni l'un ni l'autre ne sont utilises ici.
    // Valeur invalide -> 422 via ValidationError (src/lib/errors.ts).
    const stage = searchParams.get("stage");
    if (stage !== null && stage !== "") {
      if (stage === "pending") where.profileStatus = "PENDING";
      else if (stage === "approved") where.profileStatus = "APPROVED";
      else if (stage === "invited") where.communityStatus = "INVITED";
      else if (stage === "active") where.communityStatus = "JOINED";
      else {
        const t = await getTranslations("profiling");
        throw new ValidationError(t("api.invalidPagination"), [{ path: "stage", message: "stage invalide : pending|approved|invited|active attendu." }]);
      }
    }
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
    // Filtre tag libre (#102) : `?tag=mentor` ne matche que la colonne
    // customTags (les tags auto restent hors périmètre de ce filtre).
    // LIMITE documentée : `contains` sur la colonne JSON = substring match
    // sans index (ex. tag=art matche "artisan" et "smart"). Les tags sont
    // stockés en minuscules (PATCH normalise), le param est donc passé en
    // minuscules pour un match exact-insensible à la casse côté écriture.
    // `q` est volontairement inchangé : le param `tag` suffit.
    const tag = tagParam?.trim().toLowerCase();
    if (tag) {
      where.customTags = { contains: tag };
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
          customTags: true,
        },
      }),
    ]);

    const decodeJson = <T,>(s: string, fallback: T): T => {
      try {
        return JSON.parse(s) as T;
      } catch {
        return fallback;
      }
    };
    const membersWithTags = members.map((m) => ({
      ...m,
      customTags: decodeJson<string[]>(m.customTags, []),
    }));

    return NextResponse.json({ members: membersWithTags, total, page, pageSize });
  } catch (err) {
    if (err instanceof AppError) throw err;
    const t = await getTranslations("profiling");
    throw new AppError(t("api.internalError"), { status: 500, code: "INTERNAL_ERROR" });
  }
  } catch (err) {
    return errorToResponse(err);
  }
}