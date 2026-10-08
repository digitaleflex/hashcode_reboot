import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { bodyLimit } from "@/lib/body-limit";
import { blockIfTesting } from "@/lib/test-guard";
import {
  consentBodySchema,
  consentQuerySchema,
  normalizeConsentEmail,
} from "@/lib/consents";
import {
  errorToResponse,
  parseJsonBody,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

/**
 * POST /api/consents — enregistre un choix RGPD (append-only, jamais d'update).
 *
 * L'email est OPTIONNEL : le bandeau cookies et la modale privacy (déjà en
 * prod) postent sans email — on stocke alors le marqueur "anonymous".
 * Fire-and-forget côté client : répond vite, ne casse jamais l'UX.
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

    const created = await db.consent.create({
      data: {
        memberId: d.memberId ?? null,
        email: normalizeConsentEmail(d.email),
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
 * `purpose` optionnel : sans lui, dernière ligne tous purposes confondus.
 * Retourne { consent: null } (200) quand aucun historique — pas de 404.
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
