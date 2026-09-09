import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { requireAdminRole, checkCSRF, readAdminCookie, getAdminRoleFromToken } from "@/lib/admin-auth";
import { sendEventNotificationEmail } from "@/lib/mail";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { validateEventPatch, notifyWhere } from "@/lib/events-validation";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";

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

/**
 * PATCH /api/events/[id] — modifie un événement (admin operator uniquement).
 * Body partiel : title, description, startsAt, endsAt, location, url,
 * type, domain, level, status, recurrence, maxAttendees, notify.
 * Si notify=true : renotifie tous les APPROVED (comme à la création).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
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

  // Validation stricte partagée (mêmes règles que la création).
  // `notify: true` seul est valide (renotification sans modification).
  const validated = validateEventPatch(body, {
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
  });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const data = validated.data;

  if (Object.keys(data).length === 0 && body.notify !== true) {
    return NextResponse.json(
      { error: "Rien à mettre à jour.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const event = Object.keys(data).length
    ? await db.event.update({ where: { id }, data })
    : existing;
  const adminRole = getAdminRoleFromToken(readAdminCookie(req)) ?? "operator";
  if (Object.keys(data).length) {
    void audit("event.update", "event", id, { fields: Object.keys(data) }, { type: "admin", role: adminRole });
  }

  // Re-notification optionnelle (même canal qu'à la création)
  let notifyResult: { status: string; recipientCount: number } | null = null;
  if (body.notify === true) {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://joinhashcode.com";
    const rsvpUrl = `${siteUrl}/dashboard/agenda`;
    const members = await db.member.findMany({
      where: notifyWhere({ domain: event.domain, level: event.level }),
      select: { email: true, firstName: true },
    });
    const notifyPromise = (async () => {
      const payload = {
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        type: event.type,
        domain: event.domain,
        level: event.level,
      };
      for (let i = 0; i < members.length; i += 10) {
        const chunk = members.slice(i, i + 10);
        await Promise.allSettled(
          chunk.map((member) =>
            sendEventNotificationEmail({
              to: member.email,
              firstName: member.firstName,
              event: payload,
              rsvpUrl,
            }),
          ),
        );
      }
      await db.event.update({
        where: { id: event.id },
        data: { notifiedAt: new Date() },
      });
    })();
    notifyPromise.catch((err) => console.error("[events] Renotify error:", err));
    void audit(
      "event.notify",
      "event",
      event.id,
      { title: event.title, recipients: members.length },
      { type: "admin", role: adminRole },
    );
    notifyResult = { status: "queued", recipientCount: members.length };
  }

  return NextResponse.json({ ok: true, event, notify: notifyResult });
}

/**
 * DELETE /api/events/[id] — supprime un événement (admin operator uniquement).
 * Les RSVP sont supprimés en cascade (onDelete: Cascade).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
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
  void audit(
    "event.delete",
    "event",
    existing.id,
    { title: existing.title },
    { type: "admin", role: getAdminRoleFromToken(readAdminCookie(req)) ?? "operator" },
  );
  return NextResponse.json({ ok: true, deleted: existing });
}
