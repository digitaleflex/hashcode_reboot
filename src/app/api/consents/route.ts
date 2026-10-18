import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { bodyLimit } from "@/lib/body-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { getSession } from "@/lib/account-auth";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  consentBodySchema,
  consentQuerySchema,
  normalizeConsentEmail,
} from "@/lib/consents";
import {
  AuthError,
  errorToResponse,
  ForbiddenError,
  parseJsonBody,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

/**
 * POST /api/consents — enregistre un choix RGPD (append-only, jamais d'update).
 *
 * L'email est OPTIONNEL : le bandeau cookies et la modale privacy (déjà en
 * prod) postent sans email — on stocke alors le marqueur "anonymous".
 * Finalités (src/lib/consents.ts) : cookies | contact | profiling | handoff
 * (#212 : "handoff" = accord d'export vers l'écosystème, lu par
 * GET /api/community/join avant jonction via la même règle latest-wins).
 * Fire-and-forget côté client : répond vite, ne casse jamais l'UX.
 *
 * Identité : JAMAIS lue depuis le corps. Avant, n'importe qui pouvait poster
 * un consentement au nom de n'importe quel email/memberId (ex. retirer le
 * « contact » d'un tiers, ou accorder un « handoff » à sa place — la dernière
 * ligne gagne). Désormais : session membre ⇒ ligne rattachée à ce membre ;
 * sans session ⇒ ligne anonyme. `email`/`memberId` du corps sont ignorés
 * s'ils ne correspondent pas à la session.
 */
export async function POST(req: NextRequest) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    const tooLarge = bodyLimit(req);
    if (tooLarge) return tooLarge;
    const rl = await rateLimit(`consents:${rateKey(req)}`, {
      capacity: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
      );
    }

    const body = await parseJsonBody(req);
    const parsed = consentBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Données invalides.", parsed.error.issues);
    }
    const d = parsed.data;
    const session = await getSession(req);

    const created = await db.consent.create({
      data: {
        memberId: session?.member.id ?? null,
        email: normalizeConsentEmail(session?.member.email),
        purpose: d.purpose,
        choice: d.choice,
        textVersion: d.textVersion,
        // Record Zod → JSON Prisma (proof reste un objet libre {page, UA, …}).
        proof: (d.proof ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
        email: true,
        purpose: true,
        choice: true,
        textVersion: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, consent: created }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}

/**
 * GET /api/consents?email=&purpose= — dernière ligne pour (email, purpose).
 *
 * Réservé au membre connecté pour SON email, ou à un admin. Avant, la route
 * était publique : elle renvoyait la ligne complète (memberId, proof…) de
 * n'importe quel email et servait d'oracle d'inscription.
 * `purpose` optionnel : sans lui, dernière ligne tous purposes confondus.
 * Retourne { consent: null } (200) quand aucun historique — pas de 404.
 * #212 : lecture pre-jonction = même requête avec purpose=handoff
 * (miroir dans GET /api/community/join : findFirst orderBy createdAt desc).
 */
export async function GET(req: NextRequest) {
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    const rl = await rateLimit(`consents-read:${rateKey(req)}`, {
      capacity: 60,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = consentQuerySchema.safeParse({
      email: searchParams.get("email"),
      purpose: searchParams.get("purpose") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError("Données invalides.", parsed.error.issues);
    }

    const session = await getSession(req);
    const isOwner = session?.member.email.toLowerCase() === parsed.data.email;
    if (!isOwner && !(await isAdminAuthed(req))) {
      if (!session) throw new AuthError();
      throw new ForbiddenError();
    }

    const consent = await db.consent.findFirst({
      where: {
        email: parsed.data.email,
        ...(parsed.data.purpose ? { purpose: parsed.data.purpose } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, consent });
  } catch (err) {
    return errorToResponse(err);
  }
}
