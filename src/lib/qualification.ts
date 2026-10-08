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

// ── Qualification acquisition #211 ───────────────────────────────────────
// Ligne "acquisition" (snapshot de qualifyLead) vs ligne "orientation"
// (toQualificationData ci-dessus) : le discriminant est le préfixe "acq-"
// de ruleVersion. archetype = NULL explicite (aucun archétype produit côté
// acquisition — voir boundary § Forbidden Duplication). Colonnes portées
// par la migration prisma/migrations/*_qualification_acquisition_fields.

import type { AcquisitionQualification } from "./qualification/acquisition";

/** Construit le payload Prisma d'une ligne Qualification d'acquisition. */
export function toAcquisitionQualificationData(
  memberId: string,
  result: AcquisitionQualification,
) {
  return {
    memberId,
    archetype: null,
    scores: {
      qualificationScore: result.score,
    } as Prisma.InputJsonValue,
    confidence: null,
    reasons: result.reasons,
    engineVersion: result.ruleVersion,
    qualificationScore: result.score,
    status: result.status,
    ruleVersion: result.ruleVersion,
  };
}
