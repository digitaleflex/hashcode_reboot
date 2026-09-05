import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/analytics";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { subDays } from "date-fns";

export const runtime = "nodejs";

const eventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  sessionId: z.string().max(64).optional(),
  memberId: z.string().max(40).optional(),
  ref: z.string().max(80).optional(),
  value: z.number().int().optional(),
  path: z.string().max(200).optional(),
});

/** POST /api/analytics — record a funnel event. */
export async function POST(req: NextRequest) {
  // Anti-abus : 120 événements par IP toutes les 10 minutes.
  // refillPerSec = 1/5 req/sec = 12 req/min = 120 req/10min (window)
  const rl = rateLimit(`analytics:${rateKey(req)}`, {
    capacity: 120,
    windowMs: 600000, // 10 minutes
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false },
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
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }
  const d = parsed.data;
  try {
    await db.analyticsEvent.create({
      data: {
        type: d.type,
        sessionId: d.sessionId ?? null,
        memberId: d.memberId ?? null,
        ref: d.ref ?? null,
        value: d.value ?? null,
      },
    });
  } catch {
    // Don't fail the client on DB error.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}

interface FunnelData {
  total: number;
  events: { type: string; count: number }[];
  funnel: {
    sessionsStarted: number;
    sessionsCompleted: number;
    whatsappClicks: number;
    completionRate: number;
  };
}

async function computeFunnel(startDate: Date, endDate: Date): Promise<FunnelData> {
  const where = {
    createdAt: {
      gte: startDate,
      lt: endDate,
    },
  };

  const [rows, total, startedSessions, completedSessions, whatsappClicks] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["type"],
      _count: true,
      orderBy: { _count: { type: "desc" } },
      where,
    }),
    db.analyticsEvent.count({ where }),
    db.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: { ...where, type: "profiling_started" },
    }),
    db.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: { ...where, type: "profiling_completed" },
    }),
    db.analyticsEvent.count({ where: { ...where, type: "whatsapp_join_clicked" } }),
  ]);

  return {
    total,
    events: rows.map((r) => ({ type: r.type, count: r._count })),
    funnel: {
      sessionsStarted: startedSessions.length,
      sessionsCompleted: completedSessions.length,
      whatsappClicks,
      completionRate: startedSessions.length === 0 ? 0 : Math.round((completedSessions.length / startedSessions.length) * 100),
    },
  };
}

function computeChange(current: FunnelData, previous: FunnelData) {
  const pct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };
  return {
    totalPct: pct(current.total, previous.total),
    startedPct: pct(current.funnel.sessionsStarted, previous.funnel.sessionsStarted),
    completedPct: pct(current.funnel.sessionsCompleted, previous.funnel.sessionsCompleted),
    whatsappPct: pct(current.funnel.whatsappClicks, previous.funnel.whatsappClicks),
    completionRatePct: current.funnel.completionRate - previous.funnel.completionRate,
  };
}

/** GET /api/analytics — funnel summary (admin-only). */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const compare = searchParams.get("compare") === "true";
  const period = (searchParams.get("period") ?? "month") as "week" | "month";

  if (!compare) {
    // Original behavior: all-time funnel
    const [rows, total, startedSessions, completedSessions, whatsappClicks] = await Promise.all([
      db.analyticsEvent.groupBy({
        by: ["type"],
        _count: true,
        orderBy: { _count: { type: "desc" } },
      }),
      db.analyticsEvent.count(),
      db.analyticsEvent.groupBy({
        by: ["sessionId"],
        where: { type: "profiling_started" },
      }),
      db.analyticsEvent.groupBy({
        by: ["sessionId"],
        where: { type: "profiling_completed" },
      }),
      db.analyticsEvent.count({ where: { type: "whatsapp_join_clicked" } }),
    ]);

    return NextResponse.json({
      total,
      events: rows.map((r) => ({ type: r.type, count: r._count })),
      funnel: {
        sessionsStarted: startedSessions.length,
        sessionsCompleted: completedSessions.length,
        whatsappClicks,
        completionRate: startedSessions.length === 0 ? 0 : Math.round((completedSessions.length / startedSessions.length) * 100),
      },
    });
  }

  // Compare mode: compute current and previous period funnel
  const now = new Date();
  const periodDays = period === "week" ? 7 : 30;

  const currentStart = subDays(now, periodDays);
  const previousStart = subDays(currentStart, periodDays);
  const previousEnd = currentStart;

  const [current, previous] = await Promise.all([
    computeFunnel(currentStart, now),
    computeFunnel(previousStart, previousEnd),
  ]);

  const change = computeChange(current, previous);

  return NextResponse.json({
    current,
    previous,
    change,
  });
}
