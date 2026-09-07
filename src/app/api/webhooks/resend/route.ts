import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/resend — Resend webhook receiver.
 *
 * Handles: email.sent, email.opened, email.clicked
 * Verifies Svix signature when RESEND_WEBHOOK_SECRET is set.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify webhook signature if secret is configured
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ ok: false, error: "Missing svix headers" }, { status: 401 });
    }
    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const valid = await verifySvixSignature(secret, toSign, svixSignature);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Resend sends a type field at the top level
  const parsed = resendWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }

  const event = parsed.data;
  const eventType = event.type;
  const data = event.data;

  // Extract email from the "to" field (first recipient)
  const toEmail = Array.isArray(data.to) && data.to.length > 0
    ? (typeof data.to[0] === "string" ? data.to[0] : data.to[0]?.address)
    : null;

  if (!toEmail) {
    return NextResponse.json({ ok: true, skipped: "no recipient" });
  }

  // Map Resend event type to our category
  const category = categorizeEmail(data.subject);

  try {
    // Find matching member
    const member = await db.member.findUnique({
      where: { email: toEmail },
      select: { id: true },
    });

    await db.emailEvent.create({
      data: {
        email: toEmail,
        memberId: member?.id ?? null,
        type: eventType,
        category,
        clickUrl: eventType === "email.clicked" ? extractClickUrl(data) : null,
        metadata: JSON.stringify({
          subject: data.subject,
          from: data.from,
          createdAt: event.created_at,
        }),
      },
    });
  } catch {
    // Don't fail the webhook on DB error
  }

  return NextResponse.json({ ok: true });
}

/* ── Schemas ─────────────────────────────────────────────────────────────── */

const resendWebhookSchema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z.object({
    from: z.string().optional(),
    to: z.union([z.string(), z.array(z.union([z.string(), z.object({ address: z.string() })]))]).optional(),
    subject: z.string().optional(),
    email_id: z.string().optional(),
  }).passthrough(),
});

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function categorizeEmail(subject?: string): string {
  if (!subject) return "unknown";
  const s = subject.toLowerCase();
  if (s.includes("bienvenue") || s.includes("invitation")) return "welcome";
  if (s.includes("inscription") || s.includes("merci")) return "waitlist";
  if (s.includes("t'attend") || s.includes("rejoins")) return "engagement";
  if (s.includes("reprend") || s.includes("termin")) return "relance";
  return "other";
}

function extractClickUrl(data: Record<string, unknown>): string | null {
  const clickData = data.click as { url?: string } | undefined;
  if (clickData?.url) return clickData.url;
  return null;
}

/**
 * Verify Svix webhook signature (HMAC-SHA256).
 * Secret format: "whsec_<base64>" → extract key, sign payload, compare.
 */
async function verifySvixSignature(
  secret: string,
  toSign: string,
  headerSignature: string,
): Promise<boolean> {
  try {
    // whsec_<base64> → raw key bytes
    const keyB64 = secret.replace("whsec_", "").replace(/-/g, "+").replace(/_/g, "/");
    const keyBytes = Buffer.from(keyB64, "base64");

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, Buffer.from(toSign));
    const computed = `v1,${Buffer.from(sig).toString("base64")}`;

    // header may contain multiple signatures separated by space
    const signatures = headerSignature.split(" ");
    for (const s of signatures) {
      if (timingSafeEqual(Buffer.from(computed), Buffer.from(s))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
