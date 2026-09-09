import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { generateOtp, hashOtp } from "@/lib/account-otp";
import { createPendingSession } from "@/lib/account-auth";
import { sendDashboardInviteEmail } from "@/lib/mail";

export const runtime = "nodejs";

/** Durée de validité du lien magique d'annonce (72 h — c'est un email, pas un login direct). */
const ANNOUNCE_TTL_MS = 72 * 60 * 60 * 1000;
/** Pause entre 2 envois (Resend : 10 req/s max → 4/s = large marge). */
const SEND_DELAY_MS = 250;

const bodySchema = z.object({
  /** Sans confirm=true : dry-run, aucun email envoyé. */
  confirm: z.boolean().optional().default(false),
  /** Taille du lot (défaut 15, max 25 — reste sous les timeouts serverless). */
  limit: z.coerce.number().int().min(1).max(25).optional().default(15),
  /** Offset pour paginer les lots (tri createdAt asc, stable). */
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * POST /api/admin/announce-dashboard — annonce l'espace membre aux inscrits existants.
 *
 * Contexte : le dashboard a été développé APRÈS les inscriptions. Les 45 membres
 * sont sur WhatsApp mais ne connaissent pas leur espace. Cette route envoie
 * l'email d'annonce avec lien magique 1-clic (72 h) par lots.
 *
 * - Admin uniquement (cookie hashcode-admin).
 * - Dry-run par défaut : { confirm: false } → { dryRun: true, total } sans rien envoyer.
 * - Envoi : { confirm: true, limit: 15, offset: 0 } → { sent, failed, nextOffset, done }.
 *   Rappeler avec offset=nextOffset jusqu'à done=true.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`announce-dashboard:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", code: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }
  const { confirm, limit, offset } = parsed.data;

  const where = { deletedAt: null, profileStatus: "APPROVED" } as const;
  const total = await db.member.count({ where });

  if (!confirm) {
    return NextResponse.json({ dryRun: true, total, limit, offset });
  }

  const members = await db.member.findMany({
    where,
    orderBy: { createdAt: "asc" },
    skip: offset,
    take: limit,
    select: { id: true, email: true, firstName: true },
  });

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";

  let sent = 0;
  const failed: string[] = [];

  for (const member of members) {
    try {
      // Invalider les sessions OTP en attente (anti double-code), comme /request-magic-link.
      await db.memberSession
        .updateMany({
          where: { memberId: member.id, otpHash: { not: null }, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});

      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      await createPendingSession({
        memberId: member.id,
        otpHash,
        ttlMs: ANNOUNCE_TTL_MS,
        ip: null,
        userAgent: "admin-announce-dashboard",
      });

      const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&code=${encodeURIComponent(otp)}&next=${encodeURIComponent("/dashboard")}`;
      const res = await sendDashboardInviteEmail({
        to: member.email,
        firstName: member.firstName || "toi",
        url,
      });
      if (res.ok) {
        sent += 1;
      } else {
        failed.push(member.email);
      }
    } catch {
      failed.push(member.email);
    }
    // Respect du rate-limit Resend.
    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  try {
    await db.analyticsEvent.create({
      data: {
        type: "admin_announce_dashboard",
        ref: `sent=${sent} failed=${failed.length} offset=${offset}`,
      },
    });
  } catch {
    /* audit best-effort */
  }

  const nextOffset = offset + members.length;
  return NextResponse.json({
    ok: true,
    sent,
    failed,
    total,
    nextOffset,
    done: nextOffset >= total,
  });
}
