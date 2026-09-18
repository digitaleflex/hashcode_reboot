import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  memberId: z.string().min(1).max(40),
});

const KIND_LABEL: Record<string, string> = {
  invite: "Invitation",
  relance: "Relance",
  annonce: "Annonce",
  rejoin: "Retour",
  engagement: "Engagement",
};

/**
 * GET /api/admin/member-emails?memberId=...
 *
 * Historique des emails d'un membre (admin-only) :
 * - envois par lot tracés (MemberEmailLog : invite/relance/annonce/...)
 * - événements d'engagement (EmailEvent : sent/opened/clicked)
 * Triés du plus récent au plus ancien.
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
    memberId: searchParams.get("memberId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const { memberId } = parsed.data;

  const [logs, events] = await Promise.all([
    db.memberEmailLog.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.emailEvent.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { type: true, category: true, clickUrl: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    sends: logs.map((l) => ({
      at: l.createdAt,
      label: KIND_LABEL[l.kind] ?? l.kind,
      kind: l.kind,
      provider: l.provider,
      source: "lot" as const,
    })),
    engagement: events.map((e) => ({
      at: e.createdAt,
      type: e.type,
      category: e.category,
      clickUrl: e.clickUrl,
    })),
  });
}
