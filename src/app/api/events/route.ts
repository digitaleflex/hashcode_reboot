import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { requireAdminRole, checkCSRF } from "@/lib/admin-auth";
import { sendEventNotificationEmail } from "@/lib/mail";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/events — liste les événements à venir (membres connectés).
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
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
  const memberIdParam = url.searchParams.get("memberId");
  // memberId=me → membre connecté (utilisé par /dashboard/agenda et AgendaCard)
  const memberId =
    memberIdParam === "me" ? session.member.id : memberIdParam;

  // Filtres
  const where: Record<string, unknown> = {};

  // Par défaut, ne montrer que les événements scheduled/live à venir
  if (!status || status === "upcoming") {
    where.status = { in: ["scheduled", "live"] };
    where.startsAt = { gte: new Date() };
  } else if (status === "past") {
    where.startsAt = { lt: new Date() };
  } else if (["scheduled", "live", "completed", "cancelled"].includes(status)) {
    where.status = status;
  }

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
    include: {
      _count: { select: { rsvps: { where: { status: "going" } } } },
      ...(memberId
        ? { rsvps: { where: { memberId }, select: { status: true }, take: 1 } }
        : {}),
    },
  });

  // Enrichir avec le count et le RSVP du membre courant
  const enriched = await Promise.all(
    events.map(async (event) => {
      const goingCount = await db.eventRsvp.count({
        where: { eventId: event.id, status: "going" },
      });
      let myRsvp: string | null = null;
      if (memberId) {
        const rsvp = await db.eventRsvp.findUnique({
          where: { eventId_memberId: { eventId: event.id, memberId } },
          select: { status: true },
        });
        myRsvp = rsvp?.status ?? null;
      }
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        url: event.url,
        type: event.type,
        domain: event.domain,
        level: event.level,
        status: event.status,
        recurrence: event.recurrence,
        maxAttendees: event.maxAttendees,
        notifiedAt: event.notifiedAt,
        goingCount,
        myRsvp,
      };
    }),
  );

  return NextResponse.json({ events: enriched });
}

/**
 * POST /api/events — crée un événement (admin operator uniquement).
 * Envoie une notification email en masse aux membres approuvés.
 */
export async function POST(req: NextRequest) {
  // Rate-limit: 10 creations per IP per 10 minutes
  const rl = await rateLimit(`events-create:${rateKey(req)}`, {
    capacity: 10,
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

  // Admin RBAC: operator uniquement
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json(
      { error: "Accès refusé. Rôle operator requis.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (!checkCSRF(req)) {
    return NextResponse.json(
      { error: "CSRF validation failed." },
      { status: 403 },
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

  const {
    title,
    description,
    startsAt,
    endsAt,
    location,
    url,
    type,
    domain,
    level,
    recurrence,
    recurrenceId,
    maxAttendees,
    notify,
  } = body;

  // Validation
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

  if (endsAt && isNaN(Date.parse(String(endsAt)))) {
    return NextResponse.json(
      { error: "Date de fin invalide.", code: "INVALID_PAYLOAD" },
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
      recurrenceId: recurrenceId ? String(recurrenceId) : null,
      maxAttendees: maxAttendees ? Number(maxAttendees) : null,
    },
    select: { id: true, title: true, startsAt: true },
  });

  // Notification email en masse (fire-and-forget)
  if (notify !== false) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://joinhashcode.com";
    const rsvpUrl = `${siteUrl}/dashboard/agenda`;

    // Récupérer tous les membres approuvés avec email
    const members = await db.member.findMany({
      where: {
        profileStatus: "APPROVED",
        deletedAt: null,
      },
      select: { email: true, firstName: true },
    });

    // Fire-and-forget: on n'attend pas chaque envoi
    const notifyPromise = (async () => {
      let sent = 0;
      let failed = 0;
      for (const member of members) {
        try {
          await sendEventNotificationEmail({
            to: member.email,
            firstName: member.firstName,
            event: {
              title: String(title).trim(),
              description: description ? String(description).trim() : null,
              startsAt: new Date(String(startsAt)),
              endsAt: endsAt ? new Date(String(endsAt)) : null,
              location: location ? String(location).trim() : null,
              type: String(type || "session"),
              domain: domain ? String(domain) : null,
              level: level ? String(level) : null,
            },
            rsvpUrl,
          });
          sent++;
        } catch {
          failed++;
        }
      }
      // Marquer l'événement comme notifié
      await db.event.update({
        where: { id: event.id },
        data: { notifiedAt: new Date() },
      });
      return { sent, failed, total: members.length };
    })();

    // Ne pas bloquer la réponse — le client reçoit l'event immédiatement
    notifyPromise.catch((err) => console.error("[events] Notify error:", err));

    return NextResponse.json(
      {
        ok: true,
        event,
        notify: { status: "queued", recipientCount: members.length },
      },
      { status: 201 },
    );
  }

  return NextResponse.json({ ok: true, event }, { status: 201 });
}
