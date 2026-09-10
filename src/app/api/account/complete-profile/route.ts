import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { profileSchema, answersToCreatePayload } from "@/lib/profiling/validate";
import { runAutoControls } from "@/lib/profiling/auto-controls";
import { generateProfile } from "@/lib/profiling/engine";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/account/complete-profile
 *
 * Permet à un membre connecté dont le profil est en attente (ex : invité
 * importé avec un profil factice) de compléter/confirmer ses informations.
 * Rejoue les contrôles automatiques et régénère le profil.
 *
 * - Réservé aux profils PENDING (les APPROVED passent par /dashboard/profile).
 * - L'email n'est jamais modifiable ici (il identifie le compte).
 */
export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;
  const tooLarge = bodyLimit(req);
  if (tooLarge) return tooLarge;
  const rl = await rateLimit(`account-complete:${rateKey(req)}`, {
    capacity: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Non authentifié.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const member = await db.member.findUnique({
    where: { id: session.member.id },
    select: { id: true, email: true, profileStatus: true, deletedAt: true },
  });
  if (!member || member.deletedAt) {
    return NextResponse.json(
      { error: "Membre introuvable.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }
  if (member.profileStatus !== "PENDING") {
    return NextResponse.json(
      { error: "Ton profil est déjà finalisé.", code: "ALREADY_COMPLETED" },
      { status: 409 },
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

  // L'email identifie le compte : on force celui du membre connecté.
  const parsed = profileSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
    email: member.email,
  });
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
  const data = parsed.data;

  const controls = runAutoControls(data);
  const generated = generateProfile(data);
  const payload = answersToCreatePayload(data);

  const updated = await db.member.update({
    where: { id: member.id },
    data: {
      ...payload,
      email: member.email,
      source: undefined,
      profileArchetype: generated.archetype,
      tags: JSON.stringify(generated.tags),
      profileStatus: controls.profileStatus,
      communityStatus: controls.communityStatus,
      accessLane: controls.accessLane,
    },
    select: { profileStatus: true, communityStatus: true, accessLane: true },
  });

  try {
    await db.analyticsEvent.create({
      data: {
        type: "profile_completed_by_member",
        memberId: member.id,
        ref: controls.accessLane,
      },
    });
  } catch {
    /* audit best-effort */
  }

  return NextResponse.json({
    ok: true,
    profileStatus: updated.profileStatus,
    communityStatus: updated.communityStatus,
    accessLane: updated.accessLane,
    archetype: generated.archetype,
    reasons: controls.reasons,
  });
}
