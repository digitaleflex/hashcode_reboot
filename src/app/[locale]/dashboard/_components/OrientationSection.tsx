import { memberToAnswers } from "@/lib/profiling/validate";
import { loadObservedSignals } from "@/lib/orientation/observed";
import { resolveOrientation } from "@/lib/orientation/resolve";
import { loadPublishedActivitiesWithTimeout } from "@/lib/orientation/activities";
import { AVAILABLE_ACTIVITIES } from "@/lib/orientation/features";
import { NextBestActionCard } from "@/components/reboot/next-best-action-card";
import { MonoLabel } from "@/components/reboot/shared";

/**
 * Section orientation du dashboard — affichage membre de la progression (#155).
 *
 * Server component : résout le profil dynamique (declared + observed) et
 * affiche la Next Best Action + la progression observée. Les vues dashboard
 * n'écrivent PAS d'historique (lecture seule) ; l'historique d'évaluation
 * est porté par `Qualification` (append-only, arbitrage C1).
 */
export async function OrientationSection({
  memberId,
  member,
}: {
  memberId: string;
  member: Parameters<typeof memberToAnswers>[0];
}) {
  const declared = memberToAnswers(member);

  const [observed, live] = await Promise.all([
    loadObservedSignals(memberId).catch(() => null),
    loadPublishedActivitiesWithTimeout(1500).catch(() => null),
  ]);

  const catalogue = live && live.length > 0 ? live : AVAILABLE_ACTIVITIES;
  const { orientation, layered } = resolveOrientation(
    declared,
    observed,
    catalogue,
  );

  const showProgression =
    layered !== null &&
    (layered.levelUpgradeSuggested ||
      layered.domainAffinityShift !== null ||
      layered.observedConfidence > 0);

  return (
    <section aria-label="Orientation et progression">
      <div className="flex items-center justify-between mb-3">
        <MonoLabel className="text-muted-foreground">
          Ta progression
        </MonoLabel>
        {layered !== null && layered.observedConfidence > 0 && (
          <span className="mono-label text-xs text-muted-foreground">
            {layered.observed.workshopsCompleted} atelier
            {layered.observed.workshopsCompleted > 1 ? "s" : ""} terminé
            {layered.observed.workshopsCompleted > 1 ? "s" : ""} ·{" "}
            {layered.observed.eventsJoined} événement
            {layered.observed.eventsJoined > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {showProgression && layered !== null && layered.levelUpgradeSuggested && (
        <p className="mb-3 rounded-md border border-lime/40 bg-lime/[0.04] px-4 py-3 text-sm text-foreground">
          Ton activité montre un niveau{" "}
          <strong>{layered.effectiveLevel}</strong> — tes prochaines
          recommandations en tiennent compte.
        </p>
      )}

      <NextBestActionCard
        action={orientation.nextBestAction}
        status={orientation.status}
      />
    </section>
  );
}
