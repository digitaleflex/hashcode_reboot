import { NextResponse } from "next/server";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { AuthError, errorToResponse } from "@/lib/errors";
import { memberToAnswers } from "@/lib/profiling/validate";
import { buildLayeredProfile } from "@/lib/profiling/dynamicProfile";
import { orientationEngine } from "@/lib/orientation/engine";
import { loadPublishedActivitiesWithTimeout } from "@/lib/orientation/activities";
import { loadObservedSignals } from "@/lib/orientation/observed";
import { AVAILABLE_ACTIVITIES } from "@/lib/orientation/features";

export const runtime = "nodejs";

/**
 * GET /api/account/orientation — re-score du membre connecté (M5).
 *
 * Boucle comportementale : OBSERVE (signaux DB) → RE-SCORE (profil
 * dynamique + catalogue réel). Lecture seule, jamais bloquante au-delà
 * des garde-fous. N'expose ni scores bruts ni confiance moteur.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
    }

    const memberId = session.member.id;

    const [member, observed, live] = await Promise.all([
      db.member.findUnique({
        where: { id: memberId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          country: true,
          city: true,
          gender: true,
          primaryDomain: true,
          secondaryDomains: true,
          domainSpecialty: true,
          level: true,
          goal: true,
          goalProjectStage: true,
          goalSituation: true,
          availability: true,
          availabilityTimes: true,
          learningStyle: true,
          mentoringInterest: true,
          mentoringMaybeReason: true,
          mentoringTypes: true,
          mentoringFrequency: true,
          mentoringDomain: true,
          budgetRange: true,
          threeMonthGoal: true,
        },
      }),
      loadObservedSignals(memberId).catch(() => null),
      loadPublishedActivitiesWithTimeout(1500).catch(() => null),
    ]);

    if (!member) {
      throw new AuthError("Non authentifié.", "UNAUTHENTICATED");
    }

    const declared = memberToAnswers(member);
    const catalogue =
      live && live.length > 0 ? live : AVAILABLE_ACTIVITIES;
    const orientation = orientationEngine.evaluateWithActivities(
      declared,
      catalogue,
    );

    const layered =
      observed !== null ? buildLayeredProfile(declared, observed) : null;

    return NextResponse.json(
      {
        ok: true,
        nextBestAction: orientation.nextBestAction,
        orientationStatus: orientation.status,
        observedActivity: observed !== null,
        observedConfidence: layered?.observedConfidence ?? 0,
        levelUpgradeSuggested: layered?.levelUpgradeSuggested ?? false,
        engineVersion: orientation.engineVersion,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
