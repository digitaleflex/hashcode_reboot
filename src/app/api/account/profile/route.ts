import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * PATCH /api/account/profile
 *
 * Permet au membre connecté de modifier ses infos :
 *   - lastName (max 60)
 *   - phone (format WhatsApp international)
 *   - city (max 80)
 *   - gender (male/female/other/prefer_not_say, null = non précisé)
 *   - threeMonthGoal (min 4, max 280)
 *
 * Email volontairement NON modifiable (nécessite un flow de vérification
 * séparé, hors scope).
 *
 * Anti-abus : 10 PATCH / IP / 10 min.
 */
const updateSchema = z.object({
  lastName: z.string().trim().max(60).optional(),
  phone: z
    .string()
    .trim()
    .min(1, "WhatsApp requis")
    .max(40)
    .regex(
      /^\+?[0-9][0-9\s\-()]{6,30}$/,
      "Numéro WhatsApp invalide (format international : +229 ...)",
    )
    .optional(),
  city: z.string().trim().max(80).optional().default(""),
  gender: z
    .enum(["male", "female", "other", "prefer_not_say"])
    .nullable()
    .optional(),
  threeMonthGoal: z
    .string()
    .trim()
    .min(4, "Objectif trop court (4 caractères minimum)")
    .max(280, "Objectif trop long (280 caractères maximum)")
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const rl = await rateLimit(`account-update:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "Trop de modifications. Réessaie dans quelques minutes.",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) },
      },
    );
  }

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue?.message ?? "Données invalides.",
        code: "INVALID_PAYLOAD",
        field: firstIssue?.path[0],
      },
      { status: 422 },
    );
  }

  const updates = parsed.data;
  // Si rien à mettre à jour, on renvoie ok
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, message: "Aucune modification." });
  }

  try {
    const updated = await db.member.update({
      where: { id: session.member.id },
      data: {
        ...(updates.lastName !== undefined && { lastName: updates.lastName }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.city !== undefined && { city: updates.city }),
        ...(updates.gender !== undefined && { gender: updates.gender }),
        ...(updates.threeMonthGoal !== undefined && {
          threeMonthGoal: updates.threeMonthGoal,
        }),
      },
      select: {
        lastName: true,
        phone: true,
        city: true,
        gender: true,
        threeMonthGoal: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Modifications enregistrées.",
      updated: {
        lastName: updated.lastName,
        phone: updated.phone,
        city: updated.city,
        gender: updated.gender,
        threeMonthGoal: updated.threeMonthGoal,
      },
    });
  } catch (err) {
    console.error("[api/account/profile] update failed:", err);
    return NextResponse.json(
      {
        error: "Erreur lors de la mise à jour. Réessaie.",
        code: "UPDATE_FAILED",
      },
      { status: 500 },
    );
  }
}
