/**
 * HASHCODE REBOOT — Résolution d'orientation avec profil dynamique (#155).
 *
 * Point d'entrée unique de la boucle complète :
 *   declared + observed → layered → (niveau effectif) → recommandations.
 *
 * Les données observées alimentent les recommandations : si le niveau
 * effectif dépasse le niveau déclaré, l'évaluation se fait sur le niveau
 * effectif (jamais l'inverse — pas de downgrade). Fonction pure.
 */

import type { ProfileAnswers } from "@/lib/profiling/types";
import type { AvailableActivity } from "./features";
import type { OrientationResult } from "./types";
import type { DynamicProfile, ObservedSignals } from "@/lib/profiling/layers";
import { buildLayeredProfile } from "@/lib/profiling/dynamicProfile";
import { orientationEngine } from "./engine";

export interface ResolvedOrientation {
  orientation: OrientationResult;
  layered: DynamicProfile | null;
  /** Vrai quand les recommandations ont été calculées au niveau effectif. */
  usedEffectiveLevel: boolean;
}

/**
 * Résout l'orientation complète pour un profil déclaré + signaux observés.
 * `observed = null` (sources indisponibles) → évaluation sur le déclaré seul.
 */
export function resolveOrientation(
  declared: ProfileAnswers,
  observed: ObservedSignals | null,
  catalogue: AvailableActivity[],
): ResolvedOrientation {
  const layered =
    observed !== null ? buildLayeredProfile(declared, observed) : null;

  const useEffective =
    layered !== null &&
    layered.levelUpgradeSuggested &&
    layered.effectiveLevel !== declared.level;
  const effective = useEffective
    ? { ...declared, level: layered.effectiveLevel }
    : declared;

  const orientation = orientationEngine.evaluateWithActivities(
    effective,
    catalogue,
  );

  return { orientation, layered, usedEffectiveLevel: useEffective };
}
