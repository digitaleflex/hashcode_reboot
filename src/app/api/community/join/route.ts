import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toServerEventData } from "@/lib/analytics";
import { getSession } from "@/lib/account-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { getWhatsAppUrl } from "@/lib/profiling/auto-controls";
import { audit } from "@/lib/admin-audit";
import { ForbiddenError } from "@/lib/errors";
import {
  HANDOFF_CONTRACT_VERSION,
  HANDOFF_JOURNAL_EVENTS,
  handoffIdempotencyKey,
  isHandoffConsentGranted,
} from "@/lib/handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/community/join — point d'entrée unique et tracé vers WhatsApp.
 *
 * Tout accès membre au groupe passe par ici :
 * 1. Vérifie la session membre (sinon → /login avec retour ici après connexion).
 * 2. Marque communityStatus → JOINED + événement analytics.
 * 3. Redirige vers le groupe WhatsApp officiel.
 *
 * Les liens WhatsApp directs ne doivent plus être exposés aux membres
 * (emails, dashboard, account) : utiliser cette route à la place.
 */
export async function GET(req: NextRequest) {
  // Anti-abus (#118) : placé AVANT getSession (qui touche la DB) pour que
  // même un flood non authentifié soit coupé sans travailler la base.
  // Bucket large (clic humain rare, jamais en boucle légitime).
  const rl = await rateLimit(`community-join:${rateKey(req)}`, {
    capacity: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }

  const session = await getSession(req);

  if (!session) {
    const loginUrl = `/login?next=${encodeURIComponent("/api/community/join")}`;
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  const memberId = session.member.id;

  // Traçage atomique (#210 p2) : statut JOINED + événement analytics dans
  // une seule transaction. Best-effort : ne bloque jamais l'accès au groupe.
  try {
    await db.$transaction([
      db.member.updateMany({
        where: { id: memberId, communityStatus: { not: "JOINED" } },
        data: {
          communityStatus: "JOINED",
          joinedAt: new Date(),
          lastClickedAt: new Date(),
        },
      }),
      db.analyticsEvent.create({
        data: toServerEventData({
          type: "whatsapp_join_clicked",
          memberId,
          ref: "community-join",
        }),
      }),
    ]);
  } catch {
    /* ignore */
  }

  // #212 : recu d'audit SANS PII, best-effort (la redirection reste
  // intacte dans tous les cas). Lecture pre-jonction miroir de
  // GET /api/consents?email=&purpose=handoff (derniere ligne gagne) :
  // refus ou absence = pas de payload handoff, erreur FORBIDDEN tracee
  // (src/lib/errors.ts) dans le recu, sans email ni nom.
  void (async () => {
    try {
      const m = await db.member.findUnique({
        where: { id: memberId },
        select: { email: true, approvedAt: true },
      });
      let choice: string | null = null;
      if (m?.email) {
        const c = await db.consent.findFirst({
          where: { email: m.email.toLowerCase(), purpose: "handoff" },
          orderBy: { createdAt: "desc" },
          select: { choice: true },
        });
        choice = c?.choice ?? null;
      }
      const granted = isHandoffConsentGranted(choice);
      const handoffError = granted
        ? null
        : (new ForbiddenError("Consentement handoff manquant ou retire.").code as string);
      await audit("member.community-join", "member", memberId, {
        contractVersion: HANDOFF_CONTRACT_VERSION,
        idempotencyKey: handoffIdempotencyKey(memberId, m?.approvedAt ?? null),
        handoffConsent: granted ? "granted" : "missing-or-withdrawn",
        handoffError,
        events: [...HANDOFF_JOURNAL_EVENTS],
      });
    } catch {
      /* best-effort : ne bloque jamais l'acces au groupe */
    }
  })();

  let whatsappUrl: string;
  try {
    whatsappUrl = getWhatsAppUrl();
  } catch {
    return NextResponse.json(
      { error: "Communauté indisponible (configuration manquante)." },
      { status: 503 },
    );
  }
  return NextResponse.redirect(whatsappUrl);
}
