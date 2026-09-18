import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyOtpHash, MAX_OTP_ATTEMPTS } from "@/lib/account-otp";
import { sendRefuseNotificationEmail } from "@/lib/mail";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1).max(64),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/invite/refuse
 *
 * Route PUBLIQUE — pas besoin d'auth.
 * Quand un membre clique "Refuser" dans l'email :
 * 1. Valide le token
 * 2. Met à jour invitationStatus → REFUSED
 * 3. Notifie l'admin
 * 4. Redirige vers une page de confirmation
 *
 * Anti-bruteforce (le token est un OTP à 6 chiffres) :
 * - 10 essais / IP / 10 min (429 au-delà)
 * - max 3 tentatives par session d'invitation, puis révocation
 *   (même compteur que /api/auth/verify-otp)
 * - membre absent, supprimé ou token invalide/expiré → même réponse
 *   (anti-énumération)
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`invite-refuse:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { email, token, reason } = parsed.data;

  // Trouver le membre
  const member = await db.member.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      firstName: true,
      invitationStatus: true,
      deletedAt: true,
    },
  });

  if (!member || member.deletedAt) {
    return NextResponse.json(
      { error: "Lien invalide ou expiré." },
      { status: 403 },
    );
  }

  // Vérifier le token (OTP) — seules les sessions non épuisées et
  // non expirées sont testées.
  const sessions = await db.memberSession.findMany({
    where: {
      memberId: member.id,
      otpHash: { not: null },
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const candidates = sessions.filter(
    (s) => s.otpHash && s.attempts < MAX_OTP_ATTEMPTS,
  );

  let matched = false;
  for (const session of candidates) {
    if (session.otpHash && (await verifyOtpHash(token, session.otpHash))) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    // Chaque échec consomme une tentative sur toutes les candidates ;
    // les sessions épuisées sont révoquées (forcent une nouvelle demande).
    if (candidates.length > 0) {
      const ids = candidates.map((s) => s.id);
      await db.memberSession.updateMany({
        where: { id: { in: ids } },
        data: { attempts: { increment: 1 } },
      });
      const exhausted = candidates
        .filter((s) => s.attempts + 1 >= MAX_OTP_ATTEMPTS)
        .map((s) => s.id);
      if (exhausted.length > 0) {
        await db.memberSession.updateMany({
          where: { id: { in: exhausted } },
          data: { revokedAt: new Date() },
        });
      }
    }
    return NextResponse.json(
      { error: "Lien invalide ou expiré." },
      { status: 403 },
    );
  }

  // Mettre à jour le statut
  await db.member.update({
    where: { id: member.id },
    data: {
      invitationStatus: "REFUSED",
      refusedAt: new Date(),
      refusedReason: reason || null,
      lastClickedAt: new Date(),
      invitationClicks: { increment: 1 },
    },
  });

  // Révoquer les sessions en attente
  await db.memberSession.updateMany({
    where: { memberId: member.id, otpHash: { not: null }, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Notifier l'admin (fire-and-forget)
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM;
  if (adminEmail) {
    sendRefuseNotificationEmail({
      adminEmail,
      memberName: member.firstName || member.email,
      memberEmail: member.email,
      reason,
    }).catch(() => {});
  }

  // Audit
  try {
    await db.analyticsEvent.create({
      data: {
        type: "invitation_refused",
        ref: member.email,
      },
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    message: "Invitation refusée. Tu ne recevras plus d'emails d'invitation.",
  });
}

/**
 * GET /api/invite/refuse?email=...&token=...
 *
 * Affiche une page HTML de confirmation de refus (pas besoin de JS).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || !token) {
    return new NextResponse(
      `<html><body style="background:#0A0A0A;color:#F8FAFC;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>Lien invalide</h1><p style="color:#94A3B8;">Ce lien de refus n'est pas valide.</p></div></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } },
    );
  }

  // Appeler le handler POST pour traiter le refus
  const postReq = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token }),
  });
  const postRes = await POST(postReq as NextRequest);
  const postData = await postRes.json();

  const bgColor = "#0A0A0A";
  const cardBg = "#141414";
  const lime = "#C5F441";
  const text = "#F8FAFC";
  const muted = "#94A3B8";

  if (postData.ok) {
    return new NextResponse(
      `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;"><div style="max-width:480px;width:100%;padding:32px;"><div style="background:${cardBg};border:1px solid #262626;border-radius:12px;padding:32px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">👋</div><h1 style="margin:0 0 12px 0;font-size:24px;color:${text};">Invitation refusée</h1><p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:${muted};">Merci pour ta réponse. Tu ne recevras plus d'emails d'invitation de la part de HASHCODE REBOOT.</p><div style="border-top:1px solid #262626;padding-top:16px;"><p style="margin:0;font-size:12px;color:#64748B;">HASHCODE · REBOOT</p></div></div></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  return new NextResponse(
    `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:${bgColor};font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;"><div style="max-width:480px;width:100%;padding:32px;"><div style="background:${cardBg};border:1px solid #262626;border-radius:12px;padding:32px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">⚠️</div><h1 style="margin:0 0 12px 0;font-size:24px;color:${text};">Erreur</h1><p style="margin:0;font-size:15px;color:${muted};">${postData.error || "Une erreur est survenue."}</p></div></div></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } },
  );
}
