import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/events — liste les événements à venir (membres connectés).
 *
 * Query params:
 *   - domain: filtre par domaine (web | cybersecurity | ai)
 *   - type: filtre par type (session | workshop | meetup | webinar | other)
 *   - limit: nombre max (défaut 20, max 50)
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const type = url.searchParams.get("type");
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);

  // Filtres
  const where: Record<string, unknown> = {
    status: { in: ["scheduled", "live"] },
    startsAt: { gte: new Date() },
  };

  if (domain && ["web", "cybersecurity", "ai"].includes(domain)) {
    where.domain = domain;
  }
  if (type && ["session", "workshop", "meetup", "webinar", "other"].includes(type)) {
    where.type = type;
  }

  const events = await db.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      location: true,
      url: true,
      type: true,
      domain: true,
      level: true,
      status: true,
      recurrence: true,
    },
  });

  return NextResponse.json({ events });
}

/**
 * POST /api/events — crée un événement (admin uniquement).
 */
export async function POST(req: NextRequest) {
  // Rate-limit: 20 creation per IP per 10 minutes
  const rl = await rateLimit(`events-create:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }

  // TODO: vérifier le rôle admin (pour l'instant, tout membre connecté peut créer)
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  const { title, description, startsAt, endsAt, location, url, type, domain, level, recurrence } = body;

  // Validation basique
  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return NextResponse.json(
      { error: "Titre requis (min 3 caractères).", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  if (!startsAt || isNaN(Date.parse(String(startsAt)))) {
    return NextResponse.json(
      { error: "Date de début invalide.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const event = await db.event.create({
    data: {
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      startsAt: new Date(String(startsAt)),
      endsAt: endsAt ? new Date(String(endsAt)) : null,
      location: location ? String(location).trim() : null,
      url: url ? String(url).trim() : null,
      type: String(type || "session"),
      domain: domain ? String(domain) : null,
      level: level ? String(level) : null,
      recurrence: recurrence ? String(recurrence) : null,
    },
    select: { id: true, title: true, startsAt: true },
  });

  return NextResponse.json({ ok: true, event }, { status: 201 });
}
