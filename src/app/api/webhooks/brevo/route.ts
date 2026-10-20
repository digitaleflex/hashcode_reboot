/**
 * Brevo webhook handler for HASHCODE REBOOT.
 *
 * Brevo ne signe pas ses webhooks (pas de Svix) : l'auth se fait via
 * `?secret=` comparé en temps constant à BREVO_WEBHOOK_SECRET.
 * Fail-closed : sans BREVO_WEBHOOK_SECRET, tout appel est refusé.
 * Plus de repli sur CRON_SECRET : un secret passé en query string finit
 * dans les logs d'accès (Traefik) et la console Brevo — il ne doit jamais
 * être celui qui ouvre les crons (purge, envois massifs).
 *
 * Doc : https://developers.brevo.com/docs/how-to-use-webhooks
 * Payload : { event, email, id, date, "message-id", subject, tags[], link? }
 * Events Brevo (snake_case) : request, delivered, opened, unique_opened,
 *          click, soft_bounce, hard_bounce, invalid_email, deferred,
 *          spam, unsubscribed, blocked, error.
 * `normalizeBrevoEvent` (src/lib/brevo-events.ts) mappe ces noms sur le
 * vocabulaire interne ; les alias camelCase historiques restent acceptés.
 * `proxy_open` / `unique_proxy_open` sont ignorés (ouvertures Apple MPP).
 *
 * Hard bounce / invalid / blocked → membre BOUNCED + blacklist + notif admin.
 * Click → invitationClicks++ (visible dans /admin/invitations).
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { createLogger, serializeError } from "@/lib/logging";
import { sendBouncedNotificationEmail } from "@/lib/email/builders";
import {
  normalizeBrevoEvent,
  type BrevoEventType,
} from "@/lib/brevo-events";

export const runtime = "nodejs";

interface BrevoWebhookPayload {
  event: string;
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

interface BrevoWebhookEvent extends Omit<BrevoWebhookPayload, "event"> {
  event: BrevoEventType;
}

type Logger = Awaited<ReturnType<typeof createLogger>>;

function isSecretValid(provided: string | null): boolean {
  const secret = process.env.BREVO_WEBHOOK_SECRET || "";
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
      select: { id: true, email: true, firstName: true, invitationStatus: true },
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
    // #213 conversion_started : trace le clic d'invitation en analytics
    // (type existant `community_cta_clicked`, ref `invite-click` — aucun
    // nouveau type). Seulement pour les INVITED : les clics des autres
    // emails (welcome, relance…) ne sont pas une conversion. Best-effort.
    if (member.invitationStatus === "INVITED") {
      try {
        await db.analyticsEvent.create({
          data: toServerEventData({
            type: "community_cta_clicked",
            memberId: member.id,
            ref: "invite-click",
          }),
        });
      } catch {
        // Silent
      }
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

    let payload: BrevoWebhookPayload;
    try {
      payload = (await req.json()) as BrevoWebhookPayload;
    } catch {
      logger.error("Invalid JSON payload");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload?.event || !payload?.email) {
      logger.warn("Brevo webhook missing event/email");
      return NextResponse.json({ error: "Bad payload" }, { status: 422 });
    }

    const eventType = normalizeBrevoEvent(payload.event);
    if (!eventType) {
      // Événement inconnu ou volontairement ignoré (`proxy_open`,
      // `unique_proxy_open`…). On répond 200 pour éviter les retries Brevo,
      // sans écrire d'EmailEvent.
      logger.debug("Unhandled Brevo event", { type: payload.event });
      return NextResponse.json({ ok: true, ignored: payload.event });
    }

    const event: BrevoWebhookEvent = { ...payload, event: eventType };

    logger.info("Brevo webhook received", {
      type: event.event,
      rawType: payload.event,
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
