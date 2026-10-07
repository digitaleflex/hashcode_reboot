/**
 * HASHCODE REBOOT — Historique des évaluations (#155, #147).
 *
 * Append-only : une ligne `ProfileSnapshot` par évaluation significative.
 * Jamais mise à jour, jamais supprimée. L'historique rend chaque
 * recommandation passée traçable (version moteur + données + résultat).
 *
 * `buildSnapshotData` est pure et testée ; `recordSnapshot` est un
 * adaptateur DB fin, à appeler en non-bloquant (jamais sur le chemin
 * critique d'une réponse).
 */

import { db } from "@/lib/db";
import type { OrientationResult } from "./types";
import type { DynamicProfile } from "@/lib/profiling/layers";
import { DYNAMIC_PROFILE_VERSION } from "@/lib/profiling/layers";

/** Ligne prête à persister (sans id/createdAt générés par Prisma). */
export interface SnapshotData {
  memberId: string;
  engineVersion: string;
  dynamicVersion: string;
  scoresJson: string;
  confidence: number;
  archetypesJson: string;
  effectiveLevel: string;
  status: string;
  nextBestActionId: string | null;
}

/**
 * Construit la ligne d'historique depuis le résultat d'orientation et le
 * profil dynamique (pure). Les scores bruts y sont conservés pour l'analyse
 * interne — ils ne sont JAMAIS renvoyés au client (voir les routes).
 */
export function buildSnapshotData(
  memberId: string,
  orientation: OrientationResult,
  layered: DynamicProfile | null,
): SnapshotData {
  return {
    memberId,
    engineVersion: orientation.engineVersion,
    dynamicVersion: DYNAMIC_PROFILE_VERSION,
    scoresJson: JSON.stringify(orientation.scores),
    confidence: orientation.confidence,
    archetypesJson: JSON.stringify({
      dominant: layered?.inferred.dominant ?? null,
      secondary: layered?.inferred.secondary ?? null,
    }),
    effectiveLevel: layered?.effectiveLevel ?? orientation.level ?? "beginner",
    status: orientation.status,
    nextBestActionId: orientation.nextBestAction?.id ?? null,
  };
}

/**
 * Persiste un snapshot + un événement analytics dédié (lecture future).
 * Ne lève jamais : l'historique ne doit pas casser le parcours.
 */
export async function recordSnapshot(data: SnapshotData): Promise<void> {
  try {
    await Promise.allSettled([
      db.profileSnapshot.create({ data }),
      db.analyticsEvent.create({
        data: {
          type: "orientation_scored",
          memberId: data.memberId,
          ref: `${data.engineVersion}:${data.status}`,
        },
      }),
    ]);
  } catch {
    /* l'historique ne doit jamais casser le parcours */
  }
}
