import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendInviteRelanceEmail } from "@/lib/email/builders";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  errorToResponse,
  parseJsonBody,
  AuthError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";

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
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  if (!(await isAdminAuthed(req))) {
    throw new AuthError("Non autorisé.", "UNAUTHORIZED");
  }

  const rl = await rateLimit(`invite-relance:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    throw new RateLimitError("Trop de demandes.", rl.retryAfterMs);
  }

  const body = await parseJsonBody(req);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Paramètres invalides.", parsed.error.flatten());
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

  // Anti-doublon : exclure les membres déjà relancés (log d'envoi).
  const alreadyRelanced = await memberIdsWithEmailLog(
    members.map((m) => m.id),
    "relance",
  );
  const targets = members.filter((m) => !alreadyRelanced.has(m.id));

  if (!confirm) {
    return NextResponse.json({
      dryRun: true,
      eligible: targets.length,
      alreadyRelanced: members.length - targets.length,
      requested: memberIds.length,
      sample: targets.slice(0, 5).map((m) => ({ email: m.email, name: m.firstName })),
    });
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";

  let sent = 0;
  const failed: string[] = [];

  for (const member of targets) {
    try {
      // Envoyer le code de connexion Better Auth + lien vers /verify-otp.
      const { requestSignInOtp } = await import("@/lib/auth");
      await requestSignInOtp(member.email);

      const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&next=${encodeURIComponent("/dashboard")}`;

      const res = await sendInviteRelanceEmail({
        to: member.email,
        firstName: member.firstName || "toi",
        acceptUrl: url,
      });

      if (res.ok) {
        sent++;
        await logMemberEmail({
          memberId: member.id,
          email: member.email,
          kind: "relance",
          provider: res.provider,
          providerId: res.id,
        });
        // Mettre à jour le statut + émettre un nouveau token single-use
        // (vérifié sur /api/invite/accept et /api/invite/refuse).
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
    total: targets.length,
    skippedRelanced: members.length - targets.length,
  });
  } catch (err) {
    return errorToResponse(err);
  }
}
