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

async function findMember(email: string) {
  try {
    return await db.member.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, firstName: true },
    });
  } catch {
    return null;
  }
}

async function logEvent(
  email: string,
  memberId: string | null,
  type: string,
  category: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.emailEvent.create({
      data: {
        email,
        memberId,
        type,
        category,
        metadata: JSON.stringify(metadata).slice(0, 2000),
      },
    });
  } catch {
    // Silent — best effort
  }
}

async function blacklist(
  email: string,
  reason: string,
  note: string,
): Promise<void> {
  try {
    await db.memberBlacklist.upsert({
      where: { email },
      create: { email, reason, note: note.slice(0, 500), autoAdded: true },
      update: { reason, note: note.slice(0, 500), autoAdded: true },
    });
  } catch {
    // Silent — best effort
  }
}

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
  await logEvent(email, member?.id ?? null, `brevo.${event.event}`, "bounce", {
    messageId: event["message-id"],
    subject: event.subject,
    tags: event.tags,
    reason: event.reason,
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
    await blacklist(
      member.email,
      "other",
      `Auto: ${event.event} via Brevo (${event.reason ?? "no reason"})`,
    );
    logger.info("Member marked BOUNCED via Brevo", {
      memberId: member.id,
      email: member.email,
    });

    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
    if (adminEmail) {
      sendBouncedNotificationEmail({
        adminEmail,
        memberEmail: member.email,
      }).catch(() => {});
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
  await logEvent(email, member?.id ?? null, "brevo.complaint", "complaint", {
    messageId: event["message-id"],
    subject: event.subject,
    tags: event.tags,
  });

  if (member) {
    await blacklist(
      member.email,
      "spammer",
      "Auto: spam complaint via Brevo",
    );
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
  await logEvent(
    email,
    member?.id ?? null,
    `brevo.${event.event}`,
    categoryMap[event.event] ?? "other",
    {
      messageId: event["message-id"],
      subject: event.subject,
      tags: event.tags,
      clickUrl: event.link,
    },
  );

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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let event: BrevoWebhookEvent;
    try {
      event = (await req.json()) as BrevoWebhookEvent;
    } catch {
      logger.error("Invalid JSON payload");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!event?.event || !event?.email) {
      logger.warn("Brevo webhook missing event/email");
      return NextResponse.json({ error: "Bad payload" }, { status: 422 });
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
      await logEvent(
        email,
        member?.id ?? null,
        "brevo.unsubscribed",
        "suppression",
        { messageId: event["message-id"], tags: event.tags },
      );
      if (member) {
        await blacklist(
          member.email,
          "other",
          "Auto: unsubscribe via Brevo",
        );
      }
    }

    logger.info("Brevo webhook processed", {
      durationMs: Date.now() - startTime,
      type: event.event,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Brevo webhook failed", {
      durationMs: Date.now() - startTime,
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
