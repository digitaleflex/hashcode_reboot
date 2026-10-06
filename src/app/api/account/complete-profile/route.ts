import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateKey } from "@/lib/rate-limit";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { createProfileSchema, answersToCreatePayload } from "@/lib/profiling/validate";
import { runAutoControls } from "@/lib/profiling/auto-controls";
import { generateProfile } from "@/lib/profiling/engine";
import { audit } from "@/lib/admin-audit";
import { blockIfTesting } from "@/lib/test-guard";
import { bodyLimit } from "@/lib/body-limit";
import { getTranslations } from "next-intl/server";
import {
  AppError,
  AuthError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  InvalidJsonError,
  errorToResponse,
  parseJsonBody,
} from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// D16 — `revalidate = 0` retiré : redondant, `force-dynamic` l'implique déjà.

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
  try {
    const blocked = blockIfTesting();
    if (blocked) return blocked;
    const tooLarge = bodyLimit(req);
    if (tooLarge) return tooLarge;
    const rl = await rateLimit(`account-complete:${rateKey(req)}`, {
      capacity: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      const t = await getTranslations("profiling");
      throw new RateLimitError(t("api.rateLimited"), rl.retryAfterMs);
    }

    const session = await getSession(req);
    if (!session) {
      const t = await getTranslations("profiling");
      throw new AuthError(t("api.unauthenticated"), "UNAUTHENTICATED");
    }

    const member = await db.member.findUnique({
      where: { id: session.member.id },
      select: { id: true, email: true, profileStatus: true, deletedAt: true },
    });
    if (!member || member.deletedAt) {
      const t = await getTranslations("profiling");
      throw new NotFoundError(t("api.memberNotFound"));
    }
    if (member.profileStatus !== "PENDING") {
      const t = await getTranslations("profiling");
      throw new AppError(t("api.alreadyCompleted"), {
        status: 409,
        code: "ALREADY_COMPLETED",
      });
    }

    let body: unknown;
    try {
      body = await parseJsonBody(req);
    } catch {
      const t = await getTranslations("profiling");
      throw new InvalidJsonError(t("api.invalidJson"));
    }

    // Get translations for validation
    const t = await getTranslations("profiling");
    const profileSchema = createProfileSchema(t);

    // L'email identifie le compte : on force celui du membre connecté.
    const parsed = profileSchema.safeParse({
      ...(typeof body === "object" && body !== null ? body : {}),
      email: member.email,
    });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new ValidationError(
        firstIssue?.message ?? t("api.invalidPayload"),
        parsed.error.flatten(),
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
        ...(controls.profileStatus === "APPROVED" ? { approvedAt: new Date() } : {}),
      },
      select: { profileStatus: true, communityStatus: true, accessLane: true },
    });

    void audit("member.profile-completed", "member", member.id, {
      profileStatus: updated.profileStatus,
      accessLane: updated.accessLane,
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
  } catch (err) {
    return errorToResponse(err);
  }
}
