import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { verifyRefuseToken } from "@/lib/invite-token";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1).max(128),
  reason: z.string().max(500).optional(),
});

async function processRefuse(email: string, token: string, reason?: string): Promise<boolean> {
  if (!verifyRefuseToken(email, token)) return false;
  const normalized = email.trim().toLowerCase();
  try {
    const member = await db.member.findUnique({ where: { email: normalized } });
    if (member) {
      await db.member.update({
        where: { id: member.id },
        data: { invitationStatus: "REFUSED", refusedAt: new Date(), refusedReason: reason ?? null },
      });
    }
  } catch {
    /* best-effort */
  }
  return true;
}

/** POST /api/invite/refuse — traitement du refus (token signé). */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`invite-refuse:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 403 });
  }

  const ok = await processRefuse(parsed.data.email, parsed.data.token, parsed.data.reason);
  if (!ok) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

/** GET /api/invite/refuse?email=...&token=... — page de confirmation. */
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

  const ok = await processRefuse(email, token);
  if (!ok) {
    return new NextResponse(
      `<html><body style="background:#0A0A0A;color:#F8FAFC;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>Lien invalide</h1><p style="color:#94A3B8;">Ce lien de refus n'est pas valide ou a expiré.</p></div></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html" } },
    );
  }

  return new NextResponse(
    `<html><body style="background:#0A0A0A;color:#F8FAFC;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><div style="text-align:center;"><h1 style="color:#C5F441;">Refus enregistré</h1><p style="color:#94A3B8;">Tu ne recevras plus d'emails de la part de HASHCODE REBOOT.<br/>Tu peux fermer cette page.</p></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}