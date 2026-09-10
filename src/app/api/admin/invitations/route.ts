import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * GET /api/admin/invitations
 *
 * Dashboard des invitations — stats + liste des membres avec leur statut d'invitation.
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  // searchParams.get() renvoie null si absent : convertir en undefined
  // car z.string().optional() / z.coerce.number().optional() rejettent null (422).
  const parsed = querySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { status, page, pageSize } = parsed.data;

  // Stats globales (tous les membres actifs — invités inclus, inscrits inclus).
  // NB : pas de filtre `source` ici : les imports historiques ont `source=null`
  // (backfillé depuis), et un invité reste un invité quelle que soit sa source.
  const stats = await db.member.groupBy({
    by: ["invitationStatus"],
    where: { deletedAt: null },
    _count: { id: true },
  });

  const statsMap: Record<string, number> = {};
  for (const s of stats) {
    statsMap[s.invitationStatus] = s._count.id;
  }

  const totalAll = Object.values(statsMap).reduce((a, b) => a + b, 0);

  // Filtre (invités + inscrits — on distingue via `status`, pas via `source`)
  const where: Record<string, unknown> = {
    deletedAt: null,
  };
  if (status) {
    where.invitationStatus = status;
  }

  const total = await db.member.count({ where });

  const members = await db.member.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      email: true,
      firstName: true,
      phone: true,
      country: true,
      level: true,
      primaryDomain: true,
      invitationStatus: true,
      invitedAt: true,
      invitationClicks: true,
      lastClickedAt: true,
      refusedAt: true,
      refusedReason: true,
      bouncedAt: true,
      profileStatus: true,
      communityStatus: true,
      createdAt: true,
      source: true,
    },
  });

  // Derniers clics (EmailEvent)
  const memberIds = members.map((m) => m.id);
  const recentEvents = await db.emailEvent.findMany({
    where: {
      memberId: { in: memberIds },
      type: { in: ["email.clicked", "email.opened"] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      memberId: true,
      type: true,
      createdAt: true,
      clickUrl: true,
    },
  });

  // Grouper les événements par membre
  const eventsByMember: Record<string, { type: string; at: Date; url?: string }[]> = {};
  for (const ev of recentEvents) {
    if (ev.memberId) {
      if (!eventsByMember[ev.memberId]) eventsByMember[ev.memberId] = [];
      eventsByMember[ev.memberId].push({
        type: ev.type,
        at: ev.createdAt,
        url: ev.clickUrl || undefined,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    stats: {
      total: totalAll,
      NOT_INVITED: statsMap["NOT_INVITED"] || 0,
      INVITED: statsMap["INVITED"] || 0,
      ACCEPTED: statsMap["ACCEPTED"] || 0,
      REFUSED: statsMap["REFUSED"] || 0,
      BOUNCED: statsMap["BOUNCED"] || 0,
      EXPIRED: statsMap["EXPIRED"] || 0,
    },
    members: members.map((m) => ({
      ...m,
      recentEvents: eventsByMember[m.id] || [],
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
