/**
 * HASHCODE REBOOT — Qualification (#210, phase 2).
 *
 * Persistance des résultats du moteur d'orientation : une ligne par calcul
 * (historique append-only, jamais d'update — le courant = dernier createdAt).
 * Écriture best-effort depuis les routes : try/catch, jamais bloquante.
 */

import type { Prisma } from "@prisma/client";
import { dominantArchetype } from "./orientation/scoring";
import { ORIENTATION_ENGINE_VERSION } from "./orientation/engine";
import type { OrientationResult } from "./orientation/types";

/** Version du moteur tracée sur chaque ligne (recalculs comparables). */
export const QUALIFICATION_ENGINE_VERSION = ORIENTATION_ENGINE_VERSION;

/**
 * Motifs persistés : codes de raisons des 3 premières recommandations,
 * dédupliqués, plafonnés. Le moteur n'expose pas de `reasons` global —
 * ce sont les raisons par recommandation qui portent l'explicabilité.
 */
export function qualificationReasons(
  orientation: OrientationResult,
  max = 10,
): string[] {
  const out: string[] = [];
  for (const rec of orientation.recommendations.slice(0, 3)) {
    for (const r of rec.reasons) {
      if (!out.includes(r)) out.push(r);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Construit le payload Prisma pour Qualification (sans createdAt auto). */
export function toQualificationData(
  memberId: string,
  orientation: OrientationResult,
) {
  return {
    memberId,
    archetype: dominantArchetype(orientation.scores),
    // Scores typé {builder,…} côté moteur → objet JSON brut côté Prisma.
    scores: { ...orientation.scores } as Prisma.InputJsonValue,
    confidence: orientation.confidence,
    reasons: qualificationReasons(orientation),
    engineVersion: QUALIFICATION_ENGINE_VERSION,
  };
}
