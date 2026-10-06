import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkCSRF, requireAdmin, adminGuardResponse } from "@/lib/admin-auth";
import { blockIfTesting } from "@/lib/test-guard";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { sendDashboardInviteEmail } from "@/lib/mail";
import { logMemberEmail } from "@/lib/member-email-log";
import { planBatch } from "@/lib/email-budget";
import {
  AppError,
  InvalidJsonError,
  RateLimitError,
  ValidationError,
  errorToResponse,
} from "@/lib/errors";

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
  try {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  // Envoi de masse : rôle `operator` exigé + CSRF (défense en profondeur
  // avec SameSite=Lax, comme les 9 autres routes d'écriture admin).
  const adminGuard = await requireAdmin(req, "operator");
  if (!adminGuard.ok) return adminGuardResponse(adminGuard);
  if (!checkCSRF(req)) {
    // D26 — `CSRF_FAILED` était déjà le `code` de cette route : conservé.
    throw new AppError("CSRF validation failed.", {
      status: 403,
      code: "CSRF_FAILED",
    });
  }

  const rl = await rateLimit(`announce-dashboard:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    throw new RateLimitError(
      "Trop de demandes. Réessaie dans quelques minutes.",
      rl.retryAfterMs,
    );
  }

  let body: unknown;
  try {
    // D26 — inatteignable en pratique : le `.catch` ci-dessous neutralise
    // déjà le rejet de `req.json()` (un corps illisible devient `{}`, les
    // défauts du schéma s'appliquent). Conservé tel quel : le remplacer par
    // `parseJsonBody` CHANGERAIT le comportement.
    body = await req.json().catch(() => ({}));
  } catch {
    // 400 `INVALID_JSON` d'origine, à l'identique (branche inatteignable).
    throw new InvalidJsonError();
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Paramètres invalides.");
  }
  const { confirm, limit } = parsed.data;

  // Anti-doublon : seuls les APPROVED n'ayant jamais reçu l'annonce.
  // (L'offset est conservé pour compatibilité mais ignoré : la sélection
  // se fait sur l'absence de log, donc rejouer est sans risque.)
  const where: Prisma.MemberWhereInput = {
    deletedAt: null,
    profileStatus: "APPROVED",
    NOT: { emailLogs: { some: { kind: "annonce" } } },
  };
  const total = await db.member.count({ where });

  if (!confirm) {
    return NextResponse.json({ dryRun: true, total, limit });
  }

  const members = await db.member.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, email: true, firstName: true },
  });

  // Garde-fou : vérifier le budget avant d'envoyer. Si le lot dépasse le quota,
  // on envoie uniquement ce qui est autorisé, le reste est reporté (pas marqué).
  const plan = await planBatch({ category: "marketing", requested: members.length });
  const toSend = members.slice(0, plan.allowed);
  const deferred = members.length - plan.allowed;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";

  let sent = 0;
  const failed: string[] = [];

  for (const member of toSend) {
    try {
      // Envoyer le code de connexion Better Auth + lien vers /verify-otp.
      const { requestSignInOtp } = await import("@/lib/auth");
      await requestSignInOtp(member.email);

      const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&next=${encodeURIComponent("/dashboard")}`;
      const res = await sendDashboardInviteEmail({
        to: member.email,
        firstName: member.firstName || "toi",
        url,
        forceProvider: plan.provider,
      });
      if (res.ok) {
        sent += 1;
        await logMemberEmail({
          memberId: member.id,
          email: member.email,
          kind: "annonce",
          provider: res.provider,
          providerId: res.id,
        });
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
        ref: `sent=${sent} failed=${failed.length}`,
      },
    });
  } catch {
    /* audit best-effort */
  }

  const remaining = await db.member.count({ where }).catch(() => 0);
  const nextOffset = 0;
  return NextResponse.json({
    ok: true,
    sent,
    failed,
    deferred,
    budget: { provider: plan.provider, level: plan.level },
    total,
    remaining,
    nextOffset,
    done: remaining === 0,
  });
  } catch (err) {
    return errorToResponse(err);
  }
}
