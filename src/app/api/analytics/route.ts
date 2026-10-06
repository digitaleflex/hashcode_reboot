import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/analytics";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getSession } from "@/lib/account-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { subDays } from "date-fns";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { AuthError, errorToResponse } from "@/lib/errors";
import { buildDropoff, buildTiming, fetchFunnel } from "@/lib/admin/aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

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
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;
  // Anti-abus : 120 événements par IP toutes les 10 minutes.
  // refillPerSec = 1/5 req/sec = 12 req/min = 120 req/10min (window)
  const rl = await rateLimit(`analytics:${rateKey(req)}`, {
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
  // F6 : le memberId fourni par le client n'est honoré que s'il correspond
  // à la session en cours — sinon il est ignoré (pas d'empoisonnement des
  // analyses par fausse attribution). Visiteurs anonymes : toujours null.
  let memberId: string | null = null;
  if (d.memberId) {
    const session = await getSession(req);
    if (session && session.member.id === d.memberId) {
      memberId = d.memberId;
    }
  }
  try {
    await db.analyticsEvent.create({
      data: {
        type: d.type,
        sessionId: d.sessionId ?? null,
        memberId,
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
  dropoff: { questionId: string; answered: number; abandoned: number; dropRate: number }[];
  timing: { questionId: string; samples: number; avgMs: number; p50Ms: number; p95Ms: number }[];
}

/**
 * Entonnoir borne a une fenetre (mode `compare=true`).
 *
 * D29 : les deux formules pures de cet agregat — taux d'abandon par question
 * (`buildDropoff`) et temps de reponse p50/p95 (`buildTiming`) — sont importees
 * de `@/lib/admin/aggregates` au lieu d'etre reecrites ici. Elles ne dependent
 * que des lignes, pas de la fenetre : c'est exactement ce qui les rend
 * reutilisables par les deux branches.
 */
async function computeFunnel(startDate: Date, endDate: Date): Promise<FunnelData> {
  const where = {
    createdAt: {
      gte: startDate,
      lt: endDate,
    },
  };

  const [rows, total, startedSessions, completedSessions, whatsappClicks, answeredRows, abandonedRows, timedRows] = await Promise.all([
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
    db.analyticsEvent.groupBy({
      by: ["ref"],
      _count: true,
      where: { ...where, type: "profiling_question_answered", ref: { not: null } },
    }),
    db.analyticsEvent.groupBy({
      by: ["ref"],
      _count: true,
      where: { ...where, type: "profiling_abandoned", ref: { not: null } },
    }),
    db.analyticsEvent.findMany({
      where: { ...where, type: "profiling_question_timed", ref: { not: null }, value: { not: null } },
      select: { ref: true, value: true },
      take: 5000,
    }),
  ]);

  const dropoff = buildDropoff(answeredRows, abandonedRows);
  const timing = buildTiming(timedRows);

  return {
    total,
    events: rows.map((r) => ({ type: r.type, count: r._count })),
    funnel: {
      sessionsStarted: startedSessions.length,
      sessionsCompleted: completedSessions.length,
      whatsappClicks,
      completionRate: startedSessions.length === 0 ? 0 : Math.round((completedSessions.length / startedSessions.length) * 100),
    },
    dropoff,
    timing,
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

/** GET /api/analytics — funnel summary (admin-only).
 *
 * D26 : seul le GET est migré. Le POST garde volontairement son contrat
 * `{ ok: false }`, y compris un 200 sur erreur DB (« Don't fail the client
 * on DB error ») : impossible à passer par `errorToResponse` sans changer le
 * statut de cette réponse.
 */
export async function GET(req: NextRequest) {
  try {
  if (!(await isAdminAuthed(req))) {
    throw new AuthError("Non autorisé.");
  }

  const { searchParams } = new URL(req.url);
  const compare = searchParams.get("compare") === "true";
  const period = (searchParams.get("period") ?? "month") as "week" | "month";

  if (!compare) {
    // Original behavior: all-time funnel.
    // D29 : c'est `fetchFunnel()` — memes requetes, memes predicats, meme
    // fenetre (aucune borne de date), dans `@/lib/admin/aggregates`. La forme
    // de la reponse est celle d'avant, a la cle pres.
    return NextResponse.json(await fetchFunnel());
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
  } catch (err) {
    return errorToResponse(err);
  }
}
