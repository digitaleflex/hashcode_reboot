import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import {
  verifyPhoneFillTicket,
  readPhoneFillTicket,
} from "@/lib/phone-fill-ticket";

export const runtime = "nodejs";

/**
 * POST /api/account/phone
 *
 * Complète le numéro WhatsApp APRÈS l'inscription (écran de résultat),
 * quand le membre n'a pas encore de session. Remplissage unique :
 * on ne remplit que si aucun numéro n'est enregistré (pas d'écrasement).
 *
 * Autorisation (S3) : la requête doit présenter le ticket HMAC posé en
 * cookie par POST /api/members à la création FRAÎCHE du membre, ET ce
 * ticket doit être lié au memberId demandé. Sans ticket valide → réponse
 * générique ({ ok: true }) et AUCUNE écriture. Un memberId public
 * (profils partagés) ne suffit donc plus à écrire sur le compte d'autrui.
 * Exiger une session ici casserait le flux d'inscription — le ticket est
 * la preuve de possession du navigateur d'inscription.
 *
 * Réponse volontairement générique ({ ok: true }) dans tous les cas —
 * anti-énumération.
 *
 * Anti-abus : 5 requêtes / IP / 10 min.
 */
const phoneFillSchema = z.object({
  memberId: z.string().trim().min(1).max(64),
  phone: z
    .string()
    .trim()
    .min(1, "Numéro requis.")
    .max(40)
    .regex(
      /^\+?[0-9][0-9\s\-()]{6,30}$/,
      "Numéro WhatsApp invalide (format international : +229 ...)",
    ),
});

export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;
  const rl = await rateLimit(`phone-fill:${rateKey(req)}`, {
    capacity: 5,
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
    return NextResponse.json(
      { error: "Corps de requête invalide." },
      { status: 400 },
    );
  }

  const parsed = phoneFillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 422 },
    );
  }

  // Ticket requis et lié au memberId demandé — sinon, réponse générique
  // sans écriture (pas d'oracle).
  const ticketMemberId = verifyPhoneFillTicket(readPhoneFillTicket(req) ?? "");
  if (!ticketMemberId || ticketMemberId !== parsed.data.memberId) {
    return NextResponse.json({ ok: true });
  }

  // Remplissage unique : membre existant ET sans numéro → on enregistre.
  // Tous les autres cas → même réponse générique (pas d'oracle).
  try {
    const member = await db.member.findUnique({
      where: { id: parsed.data.memberId },
      select: { id: true, phone: true, deletedAt: true },
    });
    if (member && !member.deletedAt && !member.phone) {
      await db.member.update({
        where: { id: member.id },
        data: { phone: parsed.data.phone },
      });
    }
  } catch {
    /* best-effort : réponse générique dans tous les cas */
  }

  return NextResponse.json({ ok: true });
}
