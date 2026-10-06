/**
 * Resend webhook handler for HASHCODE REBOOT.
 *
 * Handles email lifecycle events:
 * - email.bounced (permanent/transient)
 * - email.complained (spam complaint)
 * - email.suppressed (added to suppression list)
 * - email.delivered, email.opened, email.clicked (analytics)
 *
 * Updates member records and logs events for audit trail.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  findMember,
  recordEmailEvent,
  blacklistEmail,
} from "@/lib/webhooks/email-event";
import { createLogger, serializeError } from "@/lib/logging";
import { headers } from "next/headers";
import {
  AppError,
  AuthError,
  InvalidJsonError,
  errorToResponse,
} from "@/lib/errors";

export const runtime = "nodejs";

/** Resend webhook event types we handle. */
type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked"
  | "email.suppressed"
  | "email.failed"
  | "contact.created"
  | "contact.updated"
  | "contact.deleted";

interface ResendWebhookEvent {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    bounce?: {
      type: "permanent" | "transient" | "undetermined";
      message?: string;
    };
    complaint?: {
      feedback_type?: string;
      message?: string;
    };
    suppression?: {
      reason: "bounce" | "complaint" | "manual" | "unsubscribe";
      created_at: string;
    };
    click?: {
      url: string;
    };
    contact?: {
      id: string;
      email: string;
      first_name?: string;
      last_name?: string;
      unsubscribed?: boolean;
    };
  };
}

/** Verify webhook signature (Resend uses svix for signatures). */
async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false;

  try {
    // Resend uses svix format: "t=timestamp,v1=signature"
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) return false;

    const timestamp = timestampPart.slice(2);
    const expectedSignature = signaturePart.slice(3);

    // Verify timestamp is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      return false;
    }

    // Compute HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${timestamp}.${payload}`)
    );
    const computedSignature = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Timing-safe comparison
    if (computedSignature.length !== expectedSignature.length) return false;
    let diff = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      diff |= computedSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/** Handle bounce event - update member status if permanent. */
async function handleBounce(
  logger: Awaited<ReturnType<typeof createLogger>>,
  event: ResendWebhookEvent
): Promise<void> {
  const email = event.data.to?.[0];
  const bounceType = event.data.bounce?.type;
  const bounceMessage = event.data.bounce?.message;

  if (!email) return;

  logger.warn("Email bounced", {
    email,
    bounceType,
    bounceMessage,
    eventId: event.data.email_id,
  });

  // D04 — `recordEmailEvent` résout `memberId` lui-même. Avant, ce `create`
  // n'écrivait pas de memberId : tout le trafic Resend était invisible dans
  // /api/admin/email-log et /api/admin/member-emails, qui filtrent par memberId.
  await recordEmailEvent({
    email,
    type: "email.bounced",
    category: "bounce",
    metadata: {
      bounceType,
      bounceMessage,
      emailId: event.data.email_id,
    },
  });

  // If permanent bounce, consider suppressing the member
  if (bounceType === "permanent") {
    // Raison dans l'enum BLACKLIST_REASONS (le détail va dans note).
    // Upsert : idempotent si le webhook est rejoué.
    await blacklistEmail({
      email,
      reason: "other",
      note: `Auto: permanent bounce via Resend (${bounceMessage ?? "no message"})`,
    });
    const member = await findMember(email);
    if (member) {
      logger.info("Member blacklisted due to permanent bounce", { memberId: member.id });
    }
  }
}

/** Handle complaint event - spam complaint. */
async function handleComplaint(
  logger: Awaited<ReturnType<typeof createLogger>>,
  event: ResendWebhookEvent
): Promise<void> {
  const email = event.data.to?.[0];
  const feedbackType = event.data.complaint?.feedback_type;

  if (!email) return;

  logger.warn("Spam complaint received", {
    email,
    feedbackType,
    eventId: event.data.email_id,
  });

  // D04 — memberId résolu par recordEmailEvent (absent avant : invisible en UI).
  // Ces helpers ne lèvent jamais (best-effort : un webhook ne doit pas faire
  // échouer l'appel provider, qui réessaierait), donc pas de try/catch ici.
  await recordEmailEvent({
    email,
    type: "email.complained",
    category: "complaint",
    metadata: { feedbackType, emailId: event.data.email_id },
  });

  // Add to blacklist for spam complaints
  await blacklistEmail({
    email,
    reason: "spammer",
    note: `Auto: spam complaint via Resend (${feedbackType ?? "no feedback type"})`,
  });
  const member = await findMember(email);
  if (member) {
    logger.info("Member blacklisted due to spam complaint", { memberId: member.id });
  }
}

/** Handle suppression event - email added to suppression list. */
async function handleSuppression(
  logger: Awaited<ReturnType<typeof createLogger>>,
  event: ResendWebhookEvent
): Promise<void> {
  const email = event.data.to?.[0];
  const reason = event.data.suppression?.reason;

  if (!email) return;

  logger.warn("Email suppressed", {
    email,
    reason,
    eventId: event.data.email_id,
  });

  // D04 — memberId résolu par recordEmailEvent (absent avant : invisible en UI).
  await recordEmailEvent({
    email,
    type: "email.suppressed",
    category: "suppression",
    metadata: { reason, emailId: event.data.email_id },
  });

  // Add to blacklist
  await blacklistEmail({
    email,
    reason: "other",
    note: `Auto: suppressed via Resend (${reason ?? "unknown"})`,
  });
}

/** Handle delivery/engagement events for analytics. */
async function handleEngagement(
  logger: Awaited<ReturnType<typeof createLogger>>,
  event: ResendWebhookEvent
): Promise<void> {
  const email = event.data.to?.[0];
  const emailId = event.data.email_id;

  if (!email) return;

  const categoryMap: Record<string, string> = {
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.failed": "failed",
    "email.sent": "sent",
    "email.delivery_delayed": "delayed",
  };

  const category = categoryMap[event.type] ?? "other";

  // D04 — C'ÉTAIT LE CŒUR DU BUG. Ce bloc enregistre `email.opened` et
  // `email.clicked` (les deux seules sources des open/click rates) et
  // n'écrivait AUCUN memberId. Or /api/admin/email-log:119 et
  // /api/admin/member-emails:54 enrichissent via `where: { memberId: { in: [...] } }`
  // → tous les opens/clicks Resend étaient invisibles dans l'interface admin.
  // `recordEmailEvent` résout memberId : l'oubli n'est plus possible.
  await recordEmailEvent({
    email,
    type: event.type,
    category,
    metadata: {
      emailId,
      subject: event.data.subject,
      tags: event.data.tags,
      clickUrl: event.data.click?.url,
    },
  });
}

/** Main webhook handler. */
export async function POST(req: NextRequest) {
  const logger = await createLogger({ route: "/api/webhooks/resend", method: "POST" });
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const h = await headers();
    const signature = h.get("resend-signature") ?? h.get("svix-signature");
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify signature if secret is configured — fail-closed en prod
    // (sinon n'importe qui peut spammer EmailEvent + auto-blacklister).
    if (webhookSecret) {
      const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.warn("Invalid webhook signature", { signature: signature ? "present" : "missing" });
        // D26 — `errorToResponse` est appelé en `return` (et non `throw`) : le
        // `catch` de ce handler est le journal du provider, il ne doit pas
        // transformer un refus de signature en 500.
        return errorToResponse(new AuthError("Invalid signature"));
      }
    } else if (process.env.NODE_ENV === "production") {
      logger.error("Webhook secret missing in production — rejecting");
      return errorToResponse(
        new AppError("Webhook not configured", {
          status: 503,
          code: "SERVICE_UNAVAILABLE",
        }),
      );
    } else {
      logger.warn("Webhook secret not configured, skipping signature verification (dev only)");
    }

    // Parse event
    let event: ResendWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.error("Invalid JSON payload");
      return errorToResponse(new InvalidJsonError("Invalid JSON"));
    }

    logger.info("Resend webhook received", { type: event.type, emailId: event.data.email_id });

    // Route to appropriate handler
    switch (event.type) {
      case "email.bounced":
        await handleBounce(logger, event);
        break;
      case "email.complained":
        await handleComplaint(logger, event);
        break;
      case "email.suppressed":
        await handleSuppression(logger, event);
        break;
      case "email.delivered":
      case "email.opened":
      case "email.clicked":
      case "email.failed":
      case "email.delivery_delayed":
      case "email.sent":
        await handleEngagement(logger, event);
        break;
      default:
        logger.debug("Unhandled webhook event type", { type: event.type });
    }

    const durationMs = Date.now() - startTime;
    logger.info("Webhook processed", { durationMs, type: event.type });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // D26 — le 500 garde son `catch` de journal (le provider ne doit pas
    // rejouer l'événement), et donc son corps tel quel.
    if (error instanceof AppError) return errorToResponse(error);
    const durationMs = Date.now() - startTime;
    logger.error("Webhook processing failed", {
      durationMs,
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}