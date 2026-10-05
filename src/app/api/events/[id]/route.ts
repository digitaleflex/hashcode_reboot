import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { requireAdminRole, checkCSRF, getAdminRole } from "@/lib/admin-auth";
import { sendEventNotificationEmail } from "@/lib/mail";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { validateEventPatch, notifyWhere, parseNotify } from "@/lib/events-validation";
import { zoneForCountry } from "@/lib/events-timezone";
import { sendPacedBatch } from "@/lib/email-batch";
import { planBatch } from "@/lib/email-budget";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/events/[id] — détail d'un événement.
 * Membre connecté ou admin viewer.
 * Admin : inclut goingCount + maybeCount pour pilotage.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
  const session = await getSession(req);
  const isAdmin = await requireAdminRole(req, "viewer");
  if (!session && !isAdmin) {
    throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
  }

  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) {
    throw new NotFoundError("Événement introuvable.");
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
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * PATCH /api/events/[id] — modifie un événement (admin operator uniquement).
 * Body partiel : title, description, startsAt, endsAt, location, url,
 * type, domain, level, status, recurrence, maxAttendees, notify.
 * Si notify=true : renotifie tous les APPROVED (comme à la création).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const rl = await rateLimit(`events-patch:${rateKey(req)}`, {
    capacity: 20,
    windowMs: 600000,
  });
  if (!rl.ok) {
    throw new RateLimitError(
      "Trop de requêtes. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
    );
  }

  if (!(await requireAdminRole(req, "operator"))) {
    throw new ForbiddenError("Accès refusé. Rôle operator requis.");
  }
  if (!checkCSRF(req)) {
    throw new ForbiddenError("CSRF validation failed.");
  }

  const { id } = await params;
  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Événement introuvable.");
  }

  const body = (await parseJsonBody(req)) as Record<string, unknown>;

  // Validation stricte partagée (mêmes règles que la création).
  // `notify: true` seul est valide (renotification sans modification).
  // notify : booléen strict — même règle que la création (POST).
  const notifyCheck = parseNotify(body.notify);
  if (!notifyCheck.ok) {
    throw new ValidationError(notifyCheck.error);
  }
  const validated = validateEventPatch(body, {
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
  });
  if (!validated.ok) {
    throw new ValidationError(validated.error);
  }
  const data = validated.data;

  if (Object.keys(data).length === 0 && body.notify !== true) {
    throw new ValidationError("Rien à mettre à jour.");
  }

  const event = Object.keys(data).length
    ? await db.event.update({ where: { id }, data })
    : existing;
  const adminRole = (await getAdminRole(req)) ?? "operator";
  if (Object.keys(data).length) {
    void audit("event.update", "event", id, { fields: Object.keys(data) }, { type: "admin", role: adminRole });
  }

  // Re-notification optionnelle (même canal qu'à la création)
  let notifyResult: {
    status: string;
    recipientCount: number;
    budget: {
      provider: string;
      level: string;
      willSend: number;
      willDefer: number;
    };
  } | null = null;
  if (body.notify === true) {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
    const rsvpUrl = `${siteUrl}/dashboard/agenda`;
    const members = await db.member.findMany({
      where: notifyWhere({ domain: event.domain, level: event.level }),
      select: { email: true, firstName: true, country: true },
    });
    // Pré-contrôle du budget, rapporté à l'admin dans la réponse.
    const budgetPlan = await planBatch({
      category: "notification",
      requested: members.length,
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
      // Lot à pacing adaptatif : taille et pause suivent le budget du provider.
      const result = await sendPacedBatch({
        category: "notification",
        recipients: members,
        send: (member) =>
            sendEventNotificationEmail({
              to: member.email,
              firstName: member.firstName,
              event: payload,
              rsvpUrl,
              // Heure rendue dans le fuseau du destinataire (cf. events-timezone).
              timeZone: zoneForCountry(member.country),
              // Lots > 20 → Brevo (quota 300/j vs 100/j Resend).
              forceProvider: budgetPlan.provider,
            }),
      });
      // Ne marquer comme notifié que si tout le lot est parti.
      if (result.deferred === 0) {
        await db.event.update({
          where: { id: event.id },
          data: { notifiedAt: new Date() },
        });
      }
    })();
    notifyPromise.catch((err) => console.error("[events] Renotify error:", err));
    void audit(
      "event.notify",
      "event",
      event.id,
      { title: event.title, recipients: members.length },
      { type: "admin", role: adminRole },
    );
    notifyResult = {
      status: "queued",
      recipientCount: members.length,
      budget: {
        provider: budgetPlan.provider,
        level: budgetPlan.level,
        willSend: budgetPlan.allowed,
        willDefer: budgetPlan.deferred,
      },
    };
  }

  return NextResponse.json({ ok: true, event, notify: notifyResult });
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * DELETE /api/events/[id] — supprime un événement (admin operator uniquement).
 * Les RSVP sont supprimés en cascade (onDelete: Cascade).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  if (!(await requireAdminRole(req, "operator"))) {
    throw new ForbiddenError("Accès refusé. Rôle operator requis.");
  }
  if (!checkCSRF(req)) {
    throw new ForbiddenError("CSRF validation failed.");
  }

  const { id } = await params;
  const existing = await db.event.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!existing) {
    throw new NotFoundError("Événement introuvable.");
  }

  await db.event.delete({ where: { id } });
  void audit(
    "event.delete",
    "event",
    existing.id,
    { title: existing.title },
    { type: "admin", role: (await getAdminRole(req)) ?? "operator" },
  );
  return NextResponse.json({ ok: true, deleted: existing });
  } catch (err) {
    return errorToResponse(err);
  }
}
