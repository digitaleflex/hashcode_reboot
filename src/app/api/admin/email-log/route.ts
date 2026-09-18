import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Nature d'un envoi par lot (cf. MemberEmailLog.kind). */
const KINDS = ["invite", "relance", "annonce", "rejoin", "engagement"] as const;
const PROVIDERS = ["resend", "brevo"] as const;

/** Types d'événements d'engagement, tous providers confondus. */
const OPENED_TYPES = ["email.opened", "brevo.opened"] as const;
const CLICKED_TYPES = ["email.clicked", "brevo.clicked"] as const;
const DELIVERED_TYPES = ["email.delivered", "brevo.delivered"] as const;

const querySchema = z.object({
  kind: z.enum(KINDS).optional(),
  provider: z.enum(PROVIDERS).optional(),
  /** Recherche insensible à la casse sur l'email ou le prénom. */
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

/**
 * GET /api/admin/email-log — journal des envois de campagne (admin-only).
 *
 * Répond à « qui a reçu quoi, quand, via quel provider, et est-ce que ça a
 * été ouvert/cliqué ». Source : MemberEmailLog (trace serveur de chaque envoi
 * réellement accepté) enrichi des EmailEvent d'engagement du destinataire.
 *
 * Inclut un bloc `audience` pour piloter l'anti-doublon : combien de membres
 * restent à informer pour l'annonce, combien sont blacklistés / en bounce.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    kind: searchParams.get("kind") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const { kind, provider, search, page, pageSize } = parsed.data;

  try {
    const where = {
      ...(kind ? { kind } : {}),
      ...(provider ? { provider } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              {
                member: {
                  is: { firstName: { contains: search, mode: "insensitive" as const } },
                },
              },
            ],
          }
        : {}),
    };

    const [total, logs, byKind, byProvider, audience] = await Promise.all([
      db.memberEmailLog.count({ where }),
      db.memberEmailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          email: true,
          kind: true,
          provider: true,
          providerId: true,
          member: {
            select: {
              id: true,
              firstName: true,
              invitationStatus: true,
              bouncedAt: true,
            },
          },
        },
      }),
      db.memberEmailLog.groupBy({ by: ["kind"], _count: true }),
      db.memberEmailLog.groupBy({ by: ["provider"], _count: true }),
      getAudience(),
    ]);

    // Engagement par destinataire (une seule requête pour toute la page).
    const memberIds = logs
      .map((l) => l.member?.id)
      .filter((id): id is string => typeof id === "string");

    const engagement = new Map<
      string,
      { opened: number; clicked: number; delivered: number; lastAt: Date | null }
    >();

    if (memberIds.length > 0) {
      const events = await db.emailEvent.findMany({
        where: {
          memberId: { in: memberIds },
          type: {
            in: [
              ...OPENED_TYPES,
              ...CLICKED_TYPES,
              ...DELIVERED_TYPES,
            ] as string[],
          },
        },
        select: { memberId: true, type: true, createdAt: true },
      });
      for (const e of events) {
        if (!e.memberId) continue;
        const agg =
          engagement.get(e.memberId) ??
          { opened: 0, clicked: 0, delivered: 0, lastAt: null };
        if ((OPENED_TYPES as readonly string[]).includes(e.type)) agg.opened += 1;
        else if ((CLICKED_TYPES as readonly string[]).includes(e.type)) agg.clicked += 1;
        else if ((DELIVERED_TYPES as readonly string[]).includes(e.type)) agg.delivered += 1;
        if (!agg.lastAt || e.createdAt > agg.lastAt) agg.lastAt = e.createdAt;
        engagement.set(e.memberId, agg);
      }
    }

    const byKindMap: Record<string, number> = {};
    for (const k of KINDS) byKindMap[k] = 0;
    for (const row of byKind) byKindMap[row.kind] = row._count;

    const byProviderMap: Record<string, number> = { resend: 0, brevo: 0, unknown: 0 };
    for (const row of byProvider) {
      const key = row.provider ?? "unknown";
      byProviderMap[key] = (byProviderMap[key] ?? 0) + row._count;
    }

    return NextResponse.json({
      ok: true,
      stats: {
        total: Object.values(byKindMap).reduce((a, b) => a + b, 0),
        byKind: byKindMap,
        byProvider: byProviderMap,
      },
      audience,
      rows: logs.map((l) => {
        const e = l.member?.id ? engagement.get(l.member.id) : undefined;
        return {
          id: l.id,
          at: l.createdAt,
          email: l.email,
          firstName: l.member?.firstName ?? null,
          memberId: l.member?.id ?? null,
          memberStatus: l.member?.invitationStatus ?? null,
          bounced: Boolean(l.member?.bouncedAt),
          kind: l.kind,
          provider: l.provider,
          providerId: l.providerId,
          engagement: {
            opened: e?.opened ?? 0,
            clicked: e?.clicked ?? 0,
            delivered: e?.delivered ?? 0,
            lastAt: e?.lastAt ?? null,
          },
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

/**
 * Photo de l'audience pour piloter l'anti-doublon :
 * - total / blacklistés (actifs) / en bounce
 * - annonce : déjà informés vs restants à informer
 */
async function getAudience() {
  const now = new Date();
  const [total, blacklisted, bounced, annonceSent, annonceRemaining] =
    await Promise.all([
      db.member.count({ where: { deletedAt: null } }),
      db.memberBlacklist.count({
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      db.member.count({ where: { deletedAt: null, invitationStatus: "BOUNCED" } }),
      db.memberEmailLog.count({ where: { kind: "annonce" } }),
      db.member.count({
        where: {
          deletedAt: null,
          profileStatus: "APPROVED",
          NOT: { emailLogs: { some: { kind: "annonce" } } },
        },
      }),
    ]);

  return { total, blacklisted, bounced, annonceSent, annonceRemaining };
}
