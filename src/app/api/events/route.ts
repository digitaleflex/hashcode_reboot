import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { requireAdminRole, checkCSRF, readAdminCookie, getAdminRoleFromToken } from "@/lib/admin-auth";
import { sendEventNotificationEmail } from "@/lib/mail";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { validateEventCreate, notifyWhere } from "@/lib/events-validation";
import { zoneForCountry } from "@/lib/events-timezone";
import { sendPacedBatch } from "@/lib/email-batch";
import { planBatch } from "@/lib/email-budget";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";

export const runtime = "nodejs";

/**
 * GET /api/events — liste les événements à venir (membres connectés ou admin).
 * Admin : ?status=all pour tout voir (y compris past/cancelled/completed).
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  const isAdmin = requireAdminRole(req, "viewer");
  if (!session && !isAdmin) {
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
    memberIdParam === "me" ? (session?.member.id ?? null) : memberIdParam;

  // Filtres
  const where: Record<string, unknown> = {};

  // Admin avec status=all → tout voir (gestion)
  if (status === "all") {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Accès refusé.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }
    // pas de filtre status/date → tous les events
  } else if (!status || status === "upcoming") {
    // Par défaut, ne montrer que les événements scheduled/live à venir
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

  // Enrichir avec le count et le RSVP du membre courant.
  // Batché en 2 requêtes (pas de N+1) : goingCount vient déjà de _count.
  const eventIds = events.map((e) => e.id);
  const [maybeGroups, myRsvps] = await Promise.all([
    eventIds.length
      ? db.eventRsvp.groupBy({
          by: ["eventId"],
          where: { eventId: { in: eventIds }, status: "maybe" },
          _count: true,
        })
      : Promise.resolve([] as { eventId: string; _count: number }[]),
    memberId && eventIds.length
      ? db.eventRsvp.findMany({
          where: { eventId: { in: eventIds }, memberId },
          select: { eventId: true, status: true },
        })
      : Promise.resolve([] as { eventId: string; status: string }[]),
  ]);
  const maybeMap = new Map(maybeGroups.map((g) => [g.eventId, g._count]));
  const myMap = new Map(myRsvps.map((r) => [r.eventId, r.status]));
  const enriched = events.map((event) => {
    const goingCount = event._count.rsvps;
    const maybeCount = maybeMap.get(event.id) ?? 0;
    const myRsvp: string | null = memberId ? (myMap.get(event.id) ?? null) : null;
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
        maybeCount,
        myRsvp,
      };
    });

  return NextResponse.json({ events: enriched });
}

/**
 * POST /api/events — crée un événement (admin operator uniquement).
 * Envoie une notification email en masse aux membres approuvés.
 */
export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;
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

  const { notify } = body;

  // Validation stricte partagée (enums, longueurs, dates, url, capacité).
  const validated = validateEventCreate(body);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error, code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const v = validated.data;

  const event = await db.event.create({
    data: {
      title: v.title,
      description: v.description,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      location: v.location,
      url: v.url,
      type: v.type,
      domain: v.domain,
      level: v.level,
      recurrence: v.recurrence,
      recurrenceId: v.recurrenceId,
      maxAttendees: v.maxAttendees,
    },
    select: { id: true, title: true, startsAt: true, domain: true, level: true },
  });

  // Audit (fire-and-forget, ne casse jamais la création).
  void audit(
    "event.create",
    "event",
    event.id,
    { title: event.title },
    { type: "admin", role: getAdminRoleFromToken(readAdminCookie(req)) ?? "operator" },
  );

  // Notification email en masse (fire-and-forget)
  if (notify !== false) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://joinhashcode.com";
    const rsvpUrl = `${siteUrl}/dashboard/agenda`;

    // Destinataires ciblés : APPROVED restreints au domaine/niveau
    // de l'event quand renseignés (même filtre que notify-count).
    const members = await db.member.findMany({
      where: notifyWhere({ domain: v.domain, level: v.level }),
      select: { email: true, firstName: true, country: true },
    });

    // Fire-and-forget: on n'attend pas chaque envoi.
    // Lots de 10 en parallèle (au lieu d'1 par 1) pour les grosses listes.
    const notifyPayload = {
      title: v.title,
      description: v.description,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      location: v.location,
      type: v.type,
      domain: v.domain,
      level: v.level,
    };
    // Pré-contrôle du budget AVANT de rendre la main : l'admin doit savoir
    // immédiatement combien de membres seront servis, et combien sont reportés.
    // Le lot réel recalcule son plan (mesure fraîche) — ceci n'est qu'un rapport.
    const budgetPlan = await planBatch({
      category: "notification",
      requested: members.length,
    });

    const notifyPromise = (async () => {
      const payload = notifyPayload;
      // Lot à pacing adaptatif : la taille et la pause suivent le budget du
      // provider (cf. src/lib/email-budget.ts). Les destinataires reportés
      // faute de quota ne sont pas perdus — ils ne sont simplement pas marqués.
      const result = await sendPacedBatch({
        category: "notification",
        recipients: members,
        send: (member) =>
          sendEventNotificationEmail({
            to: member.email,
            firstName: member.firstName,
            event: payload,
            rsvpUrl,
            // Chaque destinataire reçoit l'heure dans son propre fuseau :
            // sinon le serveur (UTC) annoncerait une heure fausse.
            timeZone: zoneForCountry(member.country),
          }),
      });

      // Ne marquer comme notifié que si tout le lot est parti : sinon le champ
      // laisserait croire à une notification complète.
      if (result.deferred === 0) {
        await db.event.update({
          where: { id: event.id },
          data: { notifiedAt: new Date() },
        });
      }
      return {
        sent: result.sent,
        failed: result.failed,
        deferred: result.deferred,
        total: members.length,
      };
    })();

    // Ne pas bloquer la réponse — le client reçoit l'event immédiatement
    notifyPromise.catch((err) => console.error("[events] Notify error:", err));
    void audit(
      "event.notify",
      "event",
      event.id,
      { title: event.title, recipients: members.length },
      { type: "admin", role: getAdminRoleFromToken(readAdminCookie(req)) ?? "operator" },
    );

    return NextResponse.json(
      {
        ok: true,
        event,
        notify: {
          status: "queued",
          recipientCount: members.length,
          budget: {
            provider: budgetPlan.provider,
            level: budgetPlan.level,
            willSend: budgetPlan.allowed,
            willDefer: budgetPlan.deferred,
          },
          warning:
            budgetPlan.deferred > 0
              ? `${budgetPlan.deferred} membre(s) reporté(s) : quota ` +
                `${budgetPlan.provider} trop bas. Ils seront repris ` +
                `automatiquement après 00:00 UTC.`
              : null,
        },
      },
      { status: 201 },
    );
  }

  return NextResponse.json({ ok: true, event }, { status: 201 });
}
