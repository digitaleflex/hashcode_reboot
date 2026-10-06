/**
 * Brevo webhook handler for HASHCODE REBOOT.
 *
 * Brevo ne signe pas ses webhooks (pas de Svix) : l'auth se fait via
 * `?secret=` comparé en temps constant à BREVO_WEBHOOK_SECRET
 * (fallback CRON_SECRET). Fail-closed en production.
 *
 * Doc : https://developers.brevo.com/docs/how-to-use-webhooks
 * Payload : { event, email, id, date, "message-id", subject, tags[], link? }
 * Events : sent, delivered, opened, clicked, softBounce, hardBounce,
 *          invalid, deferred, complaint, unsubscribed, blocked, error.
 *
 * Hard bounce / invalid / blocked → membre BOUNCED + blacklist + notif admin.
 * Click → invitationClicks++ (visible dans /admin/invitations).
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLogger, serializeError } from "@/lib/logging";
import { sendBouncedNotificationEmail } from "@/lib/mail";
import {
  AppError,
  InvalidJsonError,
  NotFoundError,
  ValidationError,
  errorToResponse,
} from "@/lib/errors";
import {
  findMember,
  recordEmailEvent,
  blacklistEmail,
  adminNotificationEmail,
} from "@/lib/webhooks/email-event";

export const runtime = "nodejs";

type BrevoEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "softBounce"
  | "hardBounce"
  | "invalid"
  | "deferred"
  | "complaint"
  | "unsubscribed"
  | "blocked"
  | "error";

interface BrevoWebhookEvent {
  event: BrevoEventType;
  email?: string;
  id?: number;
  date?: string;
  ts?: number;
  "message-id"?: string;
  subject?: string;
  tags?: string[];
  link?: string;
  sending_ip?: string;
  reason?: string;
}

type Logger = Awaited<ReturnType<typeof createLogger>>;

function isSecretValid(provided: string | null): boolean {
  const secret =
    process.env.BREVO_WEBHOOK_SECRET || process.env.CRON_SECRET || "";
  if (!secret || !provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// D04 — les helpers sont désormais partagés avec le webhook Resend
// (`@/lib/webhooks/email-event`), qui les réimplémentait à l'identique mais
// SANS memberId. Avant : Resend réimplémentait, Brevo avait sa copie — d'où
// une asymétrie invisible où seul le trafic Brevo remontait dans les vues
// engagement de l'admin.
// `findMember` / `blacklist` locaux supprimés ci-dessous.

/** Hard bounce / invalid / blocked → BOUNCED + blacklist + notif admin. */
async function handleHardBounce(
  logger: Logger,
  event: BrevoWebhookEvent,
): Promise<void> {
  const email = event.email?.toLowerCase();
  if (!email) return;

  logger.warn("Brevo hard bounce", {
    email,
    event: event.event,
    reason: event.reason,
  });

  const member = await findMember(email);
  await recordEmailEvent({
    email,
    type: `brevo.${event.event}`,
    category: "bounce",
    metadata: {
      messageId: event["message-id"],
      subject: event.subject,
      tags: event.tags,
      reason: event.reason,
    },
  });

  if (member) {
    try {
      await db.member.update({
        where: { id: member.id },
        data: { invitationStatus: "BOUNCED", bouncedAt: new Date() },
      });
    } catch {
      // Silent
    }
    await blacklistEmail({
      email: member.email,
      reason: "other",
      note: `Auto: ${event.event} via Brevo (${event.reason ?? "no reason"})`,
    });
    logger.info("Member marked BOUNCED via Brevo", {
      memberId: member.id,
      email: member.email,
    });

    // D08 — `ADMIN_EMAIL` est prioritaire ; `EMAIL_FROM` n'est qu'un repli et
    // contient un display name (« HASHCODE REBOOT <…> »). Utilisé tel quel comme
    // destinataire, l'envoi échouait silencieusement (`.catch(() => {})` plus
    // bas) : la notification n'était jamais délivrée et rien ne le signalait.
    // `adminNotificationEmail()` extrait l'adresse PURE dans les deux cas.
    const adminEmail = adminNotificationEmail();
    if (adminEmail) {
      sendBouncedNotificationEmail({
        adminEmail,
        memberEmail: member.email,
      }).catch((error) => {
        // D08 : l'échec n'est plus avalé en silence. Le geste reste
        // best-effort (le webhook ne doit pas renvoyer 500 au provider, qui
        // rejouerait tout l'événement), mais il devient visible dans les logs.
        logger.error("Bounce notification to admin failed", {
          memberId: member.id,
          error: serializeError(error),
        });
      });
    } else {
      // Aucun destinataire possible : c'est exactement le cas « les
      // notifications ne partent pas » qu'on veut voir remonter, pas un silence.
      logger.warn("Bounce notification skipped: no admin recipient configured", {
        memberId: member.id,
      });
    }
  }
}

/** Spam complaint → blacklist + notif. */
async function handleComplaint(
  logger: Logger,
  event: BrevoWebhookEvent,
): Promise<void> {
  const email = event.email?.toLowerCase();
  if (!email) return;

  logger.warn("Brevo spam complaint", { email });
  const member = await findMember(email);
  await recordEmailEvent({
    email,
    type: "brevo.complaint",
    category: "complaint",
    metadata: {
      messageId: event["message-id"],
      subject: event.subject,
      tags: event.tags,
    },
  });

  if (member) {
    await blacklistEmail({
      email: member.email,
      reason: "spammer",
      note: "Auto: spam complaint via Brevo",
    });
    logger.info("Member blacklisted (complaint) via Brevo", {
      memberId: member.id,
    });
  }
}

/** Engagement → EmailEvent + compteur de clics invitation. */
async function handleEngagement(
  event: BrevoWebhookEvent,
): Promise<void> {
  const email = event.email?.toLowerCase();
  if (!email) return;

  const categoryMap: Record<string, string> = {
    sent: "sent",
    delivered: "delivered",
    opened: "opened",
    clicked: "clicked",
    deferred: "delayed",
    error: "failed",
  };
  const member = await findMember(email);
  await recordEmailEvent({
    email,
    type: `brevo.${event.event}`,
    category: categoryMap[event.event] ?? "other",
    metadata: {
      messageId: event["message-id"],
      subject: event.subject,
      tags: event.tags,
      clickUrl: event.link,
    },
  });

  // Clic sur un email d'invitation → compteur dashboard admin.
  if (member && event.event === "clicked") {
    try {
      await db.member.update({
        where: { id: member.id },
        data: {
          invitationClicks: { increment: 1 },
          lastClickedAt: new Date(),
        },
      });
    } catch {
      // Silent
    }
  }
}

export async function POST(req: NextRequest) {
  const logger = await createLogger({
    route: "/api/webhooks/brevo",
    method: "POST",
  });
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (!isSecretValid(secret)) {
      logger.warn("Invalid Brevo webhook secret", {
        provided: secret ? "present" : "missing",
      });
      // 404 plutôt que 401 pour ne pas révéler l'existence du endpoint.
      // D26 — `errorToResponse` est appelé en `return` (et non `throw`) : le
      // `catch` de ce handler est le journal du provider, il ne doit pas
      // transformer un refus en 500.
      return errorToResponse(new NotFoundError("Not found"));
    }

    let event: BrevoWebhookEvent;
    try {
      event = (await req.json()) as BrevoWebhookEvent;
    } catch {
      logger.error("Invalid JSON payload");
      return errorToResponse(new InvalidJsonError("Invalid JSON"));
    }

    if (!event?.event || !event?.email) {
      logger.warn("Brevo webhook missing event/email");
      // D26 — 422 conservé (et non 400).
      return errorToResponse(new ValidationError("Bad payload"));
    }

    logger.info("Brevo webhook received", {
      type: event.event,
      email: event.email,
      tags: event.tags,
    });

    switch (event.event) {
      case "hardBounce":
      case "invalid":
      case "blocked":
        await handleHardBounce(logger, event);
        break;
      case "complaint":
        await handleComplaint(logger, event);
        break;
      case "sent":
      case "delivered":
      case "opened":
      case "clicked":
      case "softBounce":
      case "deferred":
      case "error":
        await handleEngagement(event);
        break;
      default:
        logger.debug("Unhandled Brevo event", { type: event.event });
    }

    // Unsubscribed → EmailEvent + blacklist (plus d'emails).
    if (event.event === "unsubscribed" && event.email) {
      const email = event.email.toLowerCase();
      const member = await findMember(email);
      await recordEmailEvent({
        email,
        type: "brevo.unsubscribed",
        category: "suppression",
        metadata: { messageId: event["message-id"], tags: event.tags },
      });
      if (member) {
        await blacklistEmail({
      email: member.email,
      reason: "other",
      note: "Auto: unsubscribe via Brevo",
    });
      }
    }

    logger.info("Brevo webhook processed", {
      durationMs: Date.now() - startTime,
      type: event.event,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // D26 — le 500 garde son `catch` de journal (le provider ne doit pas
    // rejouer l'événement), et donc son corps tel quel.
    if (error instanceof AppError) return errorToResponse(error);
    logger.error("Brevo webhook failed", {
      durationMs: Date.now() - startTime,
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
