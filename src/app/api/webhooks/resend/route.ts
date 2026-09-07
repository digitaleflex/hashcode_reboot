import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/resend — Resend webhook receiver.
 *
 * Handles: email.sent, email.opened, email.clicked
 * Docs: https://resend.com/docs/dashboard/webhooks
 *
 * To configure: add https://your-domain.com/api/webhooks/resend
 * in Resend Dashboard → Webhooks.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
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
  // Resend includes click data in different places depending on version
  const clickData = data.click as { url?: string } | undefined;
  if (clickData?.url) return clickData.url;
  return null;
}
