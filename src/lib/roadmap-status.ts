/**
 * Statuts roadmap pilotés par les données (#234).
 *
 * Seule la VIVACITÉ est pilotée (booléen par jalon) : les libellés restent
 * i18n. Règles documentées et testées :
 *   - challenges : live ⇔ ≥1 mission PUBLISHED ;
 *   - workshops : live ⇔ ≥1 atelier published ;
 *   - projects / mentoring / registry : éditoriaux (false), faute de source.
 */
export interface RoadmapCounts {
  missionsPublished: number;
  workshopsPublished: number;
}

export type RoadmapKey = "challenges" | "workshops" | "projects" | "mentoring" | "registry";

export type RoadmapLive = Record<RoadmapKey, boolean>;

export function deriveRoadmapLive(counts: RoadmapCounts): RoadmapLive {
  return {
    challenges: counts.missionsPublished > 0,
    workshops: counts.workshopsPublished > 0,
    projects: false,
    mentoring: false,
    registry: false,
  };
}
