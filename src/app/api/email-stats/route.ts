import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

const CATEGORIES = ["welcome", "waitlist", "engagement", "relance", "other"] as const;

/** GET /api/email-stats — email engagement per category + relance funnel (admin-only). */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const [allEvents, byCategory, draftStats, relanceDraftIds] = await Promise.all([
      db.emailEvent.findMany({
        select: { email: true, type: true, category: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      listCategoryStats(),
      relanceDraftSummary(),
      // emails that received a relance (for per-draft conversion)
      db.emailEvent.findMany({
        where: { type: "email.sent", category: "relance" },
        select: { email: true },
      }),
    ]);

    const relanceEmails = new Set(relanceDraftIds.map((r) => r.email.toLowerCase()));

    return NextResponse.json({
      summary: {
        totalSent: allEvents.filter((e) => e.type === "email.sent").length,
        totalOpened: allEvents.filter((e) => e.type === "email.opened").length,
        totalClicked: allEvents.filter((e) => e.type === "email.clicked").length,
      },
      byCategory,
      relance: {
        drafts: draftStats.drafts,
        relanceSent: draftStats.relanceSent,
        relanceOpened: countByTypeAndEmails(allEvents, "email.opened", relanceEmails),
        relanceClicked: countByTypeAndEmails(allEvents, "email.clicked", relanceEmails),
        recovered: draftStats.recovered,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

async function listCategoryStats() {
  const rows = await db.emailEvent.groupBy({
    by: ["category", "type"],
    _count: true,
  });

  const result: Record<string, { sent: number; opened: number; clicked: number }> = {};
  for (const cat of CATEGORIES) {
    result[cat] = { sent: 0, opened: 0, clicked: 0 };
  }
  for (const r of rows) {
    const cat = (r.category ?? "other") as string;
    if (!result[cat]) result[cat] = { sent: 0, opened: 0, clicked: 0 };
    if (r.type === "email.sent") result[cat].sent = r._count;
    else if (r.type === "email.opened") result[cat].opened = r._count;
    else if (r.type === "email.clicked") result[cat].clicked = r._count;
  }
  return result;
}

async function relanceDraftSummary() {
  const [drafts, relanceSent, recovered] = await Promise.all([
    db.profilingDraft.count(),
    db.profilingDraft.count({ where: { relanceSentAt: { not: null } } }),
    db.profilingDraft.count({ where: { completedAt: { not: null } } }),
  ]);
  return { drafts, relanceSent, recovered };
}

function countByTypeAndEmails(
  events: { email: string; type: string }[],
  type: string,
  emails: Set<string>,
): number {
  return events.filter((e) => e.type === type && emails.has(e.email.toLowerCase())).length;
}