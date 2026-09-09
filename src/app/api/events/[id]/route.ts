import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { requireAdminRole, checkCSRF } from "@/lib/admin-auth";
import { sendEventNotificationEmail } from "@/lib/mail";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/events/[id] — détail d'un événement.
 * Membre connecté ou admin viewer.
 * Admin : inclut goingCount + maybeCount pour pilotage.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession(req);
  const isAdmin = requireAdminRole(req, "viewer");
  if (!session && !isAdmin) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json(
      { error: "Événement introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const [goingCount, maybeCount] = await Promise.all([
    db.eventRsvp.count({ where: { eventId: id, status: "going" } }),
    db.eventRsvp.count({ where: { eventId: id, status: "maybe" } }),
  ]);

  let myRsvp: string | null = null;
  if (session) {
    const rsvp = await db.eventRsvp.findUnique({
      where: { eventId_memberId: { eventId: id, memberId: session.member.id } },
      select: { status: true },
    });
    myRsvp = rsvp?.status ?? null;
  }

  return NextResponse.json({
    event,
    goingCount,
    maybeCount,
    myRsvp,
  });
}

const VALID_TYPES = ["session", "workshop", "meetup", "webinar", "other"];
const VALID_DOMAINS = ["web", "cybersecurity", "ai"];
const VALID_LEVELS = ["beginner", "practicing", "autonomous", "advanced"];
const VALID_STATUS = ["scheduled", "live", "completed", "cancelled"];
const VALID_RECURRENCE = ["weekly", "biweekly", "monthly"];

/**
 * PATCH /api/events/[id] — modifie un événement (admin operator uniquement).
 * Body partiel : title, description, startsAt, endsAt, location, url,
 * type, domain, level, status, recurrence, maxAttendees, notify.
 * Si notify=true : renotifie tous les APPROVED (comme à la création).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const rl = await rateLimit(`events-patch:${rateKey(req)}`, {
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

  const { id } = await params;
  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Événement introuvable.", code: "NOT_FOUND" },
      { status: 404 },
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

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length < 3) {
      return NextResponse.json(
        { error: "Titre requis (min 3 caractères).", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.title = body.title.trim();
  }
  if (body.description !== undefined) {
    data.description =
      body.description === null ? null : String(body.description).trim() || null;
  }
  if (body.startsAt !== undefined) {
    if (!body.startsAt || isNaN(Date.parse(String(body.startsAt)))) {
      return NextResponse.json(
        { error: "Date de début invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.startsAt = new Date(String(body.startsAt));
  }
  if (body.endsAt !== undefined) {
    if (body.endsAt !== null && isNaN(Date.parse(String(body.endsAt)))) {
      return NextResponse.json(
        { error: "Date de fin invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
  }
  if (body.location !== undefined) {
    data.location =
      body.location === null ? null : String(body.location).trim() || null;
  }
  if (body.url !== undefined) {
    data.url = body.url === null ? null : String(body.url).trim() || null;
  }
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(String(body.type))) {
      return NextResponse.json(
        { error: "Type invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.type = String(body.type);
  }
  if (body.domain !== undefined) {
    if (body.domain !== null && !VALID_DOMAINS.includes(String(body.domain))) {
      return NextResponse.json(
        { error: "Domaine invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.domain = body.domain ? String(body.domain) : null;
  }
  if (body.level !== undefined) {
    if (body.level !== null && !VALID_LEVELS.includes(String(body.level))) {
      return NextResponse.json(
        { error: "Niveau invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.level = body.level ? String(body.level) : null;
  }
  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(String(body.status))) {
      return NextResponse.json(
        { error: "Statut invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.status = String(body.status);
  }
  if (body.recurrence !== undefined) {
    if (
      body.recurrence !== null &&
      body.recurrence !== "" &&
      !VALID_RECURRENCE.includes(String(body.recurrence))
    ) {
      return NextResponse.json(
        { error: "Récurrence invalide.", code: "INVALID_PAYLOAD" },
        { status: 422 },
      );
    }
    data.recurrence = body.recurrence ? String(body.recurrence) : null;
  }
  if (body.maxAttendees !== undefined) {
    if (body.maxAttendees === null || body.maxAttendees === "") {
      data.maxAttendees = null;
    } else {
      const n = Number(body.maxAttendees);
      if (!Number.isInteger(n) || n < 1 || n > 9999) {
        return NextResponse.json(
          { error: "Capacité invalide (1-9999).", code: "INVALID_PAYLOAD" },
          { status: 422 },
        );
      }
      data.maxAttendees = n;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Rien à mettre à jour.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const event = await db.event.update({ where: { id }, data });

  // Re-notification optionnelle (même canal qu'à la création)
  let notifyResult: { status: string; recipientCount: number } | null = null;
  if (body.notify === true) {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://joinhashcode.com";
    const rsvpUrl = `${siteUrl}/dashboard/agenda`;
    const members = await db.member.findMany({
      where: { profileStatus: "APPROVED", deletedAt: null },
      select: { email: true, firstName: true },
    });
    const notifyPromise = (async () => {
      for (const member of members) {
        try {
          await sendEventNotificationEmail({
            to: member.email,
            firstName: member.firstName,
            event: {
              title: event.title,
              description: event.description,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              location: event.location,
              type: event.type,
              domain: event.domain,
              level: event.level,
            },
            rsvpUrl,
          });
        } catch {
          /* best effort */
        }
      }
      await db.event.update({
        where: { id: event.id },
        data: { notifiedAt: new Date() },
      });
    })();
    notifyPromise.catch((err) => console.error("[events] Renotify error:", err));
    notifyResult = { status: "queued", recipientCount: members.length };
  }

  return NextResponse.json({ ok: true, event, notify: notifyResult });
}

/**
 * DELETE /api/events/[id] — supprime un événement (admin operator uniquement).
 * Les RSVP sont supprimés en cascade (onDelete: Cascade).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
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

  const { id } = await params;
  const existing = await db.event.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Événement introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  await db.event.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: existing });
}
