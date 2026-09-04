import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/analytics";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";

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
  const rl = rateLimit(`analytics:${rateKey(req)}`, {
    capacity: 120,
    refillPerSec: 1 / 5,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false },
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

/** GET /api/analytics — funnel summary (admin-only). */
export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const rows = await db.analyticsEvent.groupBy({
    by: ["type"],
    _count: true,
    orderBy: { _count: { type: "desc" } },
  });
  const total = await db.analyticsEvent.count();
  // Sessions with at least one profiling_started event.
  const startedSessions = await db.analyticsEvent.groupBy({
    by: ["sessionId"],
    where: { type: "profiling_started" },
  });
  const completedSessions = await db.analyticsEvent.groupBy({
    by: ["sessionId"],
    where: { type: "profiling_completed" },
  });
  const whatsappClicks = await db.analyticsEvent.count({
    where: { type: "whatsapp_join_clicked" },
  });

  return NextResponse.json({
    total,
    events: rows.map((r) => ({ type: r.type, count: r._count })),
    funnel: {
      sessionsStarted: startedSessions.length,
      sessionsCompleted: completedSessions.length,
      whatsappClicks,
      completionRate:
        startedSessions.length === 0
          ? 0
          : Math.round((completedSessions.length / startedSessions.length) * 100),
    },
  });
}
