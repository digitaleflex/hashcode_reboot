import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateOtp, hashOtp } from "@/lib/account-otp";
import { createPendingSession } from "@/lib/account-auth";
import { sendInviteRelanceEmail } from "@/lib/mail";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";

export const runtime = "nodejs";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const SEND_DELAY_MS = 250;

const bodySchema = z.object({
  /** IDs des membres à relancer (max 50). */
  memberIds: z.array(z.string()).min(1).max(50),
  /** Sans confirm=true : dry-run. */
  confirm: z.boolean().optional().default(false),
});

/**
 * POST /api/invite/relance — relance les invitations non cliquées (J+7).
 *
 * Admin-only. Génère un nouveau magic link et envoie l'email de relance.
 */
export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const rl = await rateLimit(`invite-relance:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de demandes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { memberIds, confirm } = parsed.data;

  // Trouver les membres éligibles (PENDING, pas encore acceptés/refusés)
  const members = await db.member.findMany({
    where: {
      id: { in: memberIds },
      invitationStatus: { in: ["INVITED", "NOT_INVITED"] },
      deletedAt: null,
    },
    select: { id: true, email: true, firstName: true },
  });

  if (!confirm) {
    return NextResponse.json({
      dryRun: true,
      eligible: members.length,
      requested: memberIds.length,
      sample: members.slice(0, 5).map((m) => ({ email: m.email, name: m.firstName })),
    });
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";

  let sent = 0;
  const failed: string[] = [];

  for (const member of members) {
    try {
      // Révoquer les anciennes sessions OTP
      await db.memberSession.updateMany({
        where: { memberId: member.id, otpHash: { not: null }, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Nouveau magic link
      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      await createPendingSession({
        memberId: member.id,
        otpHash,
        ttlMs: INVITE_TTL_MS,
        ip: null,
        userAgent: "admin-invite-relance",
      });

      const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&code=${encodeURIComponent(otp)}&next=${encodeURIComponent("/dashboard")}`;

      const res = await sendInviteRelanceEmail({
        to: member.email,
        firstName: member.firstName || "toi",
        acceptUrl: url,
      });

      if (res.ok) {
        sent++;
        // Mettre à jour le statut
        await db.member.update({
          where: { id: member.id },
          data: {
            invitationStatus: "INVITED",
            invitedAt: new Date(),
          },
        });
      } else {
        failed.push(member.email);
      }
    } catch {
      failed.push(member.email);
    }
    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  // Audit
  try {
    await db.analyticsEvent.create({
      data: {
        type: "admin_invite_relance",
        ref: `sent=${sent} failed=${failed.length}`,
        value: sent,
      },
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    total: members.length,
  });
}
