import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { checkCSRF, requireAdminOrThrow, requireAdmin } from "@/lib/admin-auth";
import { sendEventNotificationEmail } from "@/lib/mail";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { validateEventCreate, notifyWhere, parseNotify } from "@/lib/events-validation";
import { zoneForCountry } from "@/lib/events-timezone";
import { sendPacedBatch } from "@/lib/email-batch";
import { planBatch } from "@/lib/email-budget";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { AuthError, ForbiddenError, RateLimitError, ValidationError, errorToResponse, parseJsonBody } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * GET /api/events — liste les événements à venir (membres connectés ou admin).
 * Admin : ?status=all pour tout voir (y compris past/cancelled/completed).
 */
export async function GET(req: NextRequest) {
  try {
  const session = await getSession(req);
  const isAdmin = (await requireAdmin(req, "viewer")).ok;
  if (!session && !isAdmin) {
    throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
  }

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
  const memberIdParam = url.searchParams.get("memberId");
  // memberId=me → membre connecté (utilisé par /dashboard/agenda et AgendaCard).
  // Anti-IDOR (F3) : un memberId arbitraire n'est honoré que pour les admins ;
  // les membres voient toujours leurs propres RSVP.
  const memberId =
    isAdmin && memberIdParam && memberIdParam !== "me"
      ? memberIdParam
      : (session?.member.id ?? null);

  // Filtres
  const where: Record<string, unknown> = {};

  // Admin avec status=all → tout voir (gestion)
  if (status === "all") {
    if (!isAdmin) {
      throw new ForbiddenError("Accès refusé.");
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

  // Batché : relances auto par événement (J-3 / J-1 / H-1).
  // + séances d'atelier liées (admin : pilotage du verrou pédagogique).
  const linkedSessions = isAdmin && eventIds.length
    ? await db.workshopSession.findMany({
        where: { eventId: { in: eventIds } },
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          title: true,
          eventId: true,
          scheduledAt: true,
          unlockOverride: true,
          week: {
            select: {
              workshop: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      })
    : [];
  const sessionsByEvent = new Map<string, typeof linkedSessions>();
  for (const s of linkedSessions) {
    if (!s.eventId) continue;
    const arr = sessionsByEvent.get(s.eventId) ?? [];
    arr.push(s);
    sessionsByEvent.set(s.eventId, arr);
  }

  const reminderLogsAll = eventIds.length
    ? await db.eventReminderLog.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true, offsetMinutes: true, createdAt: true, sentCount: true },
      })
    : [];
  const reminderMap = new Map<string, typeof reminderLogsAll>();
  for (const rl of reminderLogsAll) {
    const arr = reminderMap.get(rl.eventId) ?? [];
    arr.push(rl);
    reminderMap.set(rl.eventId, arr);
  }
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
        reminderLogs: (reminderMap.get(event.id) ?? []).map((rl) => ({
          offsetMinutes: rl.offsetMinutes,
          sentAt: rl.createdAt.toISOString(),
          sentCount: rl.sentCount,
        })),
        goingCount,
        maybeCount,
        myRsvp,
        // Admin uniquement : séances d'atelier reliées à cet événement.
        linkedSessions: isAdmin
          ? (sessionsByEvent.get(event.id) ?? []).map((s) => ({
              id: s.id,
              number: s.number,
              title: s.title,
              scheduledAt: s.scheduledAt?.toISOString() ?? null,
              unlockOverride: s.unlockOverride,
              workshopId: s.week.workshop.id,
              workshopTitle: s.week.workshop.title,
              workshopSlug: s.week.workshop.slug,
            }))
          : [],
      };
    });

  return NextResponse.json({ events: enriched });
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * POST /api/events — crée un événement (admin operator uniquement).
 * Envoie une notification email en masse aux membres approuvés.
 */
export async function POST(req: NextRequest) {
  try {
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
    throw new RateLimitError(
      "Trop de requêtes. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
    );
  }

  // Admin RBAC: operator uniquement
  const admin = await requireAdminOrThrow(req, "operator");

  if (!checkCSRF(req)) {
    throw new ForbiddenError("CSRF validation failed.");
  }

  const body = (await parseJsonBody(req)) as Record<string, unknown>;

  // notify : optionnel, booléen strict. Sans ce contrôle, une chaîne "no"
  // ou un 0 déclencherait un envoi de masse involontaire (notify !== false).
  const notifyCheck = parseNotify(body.notify);
  if (!notifyCheck.ok) {
    throw new ValidationError(notifyCheck.error);
  }
  const { notify } = notifyCheck;

  // Validation stricte partagée (enums, longueurs, dates, url, capacité).
  const validated = validateEventCreate(body);
  if (!validated.ok) {
    throw new ValidationError(validated.error);
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
    { type: "admin", role: admin.role },
  );

  // Notification email en masse (fire-and-forget)
  if (notify !== false) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
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
              // Lots > 20 → Brevo (quota 300/j vs 100/j Resend).
              forceProvider: budgetPlan.provider,
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
      { type: "admin", role: admin.role },
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
  } catch (err) {
    return errorToResponse(err);
  }
}
