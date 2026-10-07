import { ACTIVITY_BY_ID, AVAILABLE_ACTIVITIES, type AvailableActivity } from "./features";

type ActivityCatalogue = ReadonlyMap<string, AvailableActivity>;

const DEFAULT_CATALOGUE: ActivityCatalogue = ACTIVITY_BY_ID;

/**
 * Resolve a recommendation id to a safe internal destination.
 * Unknown or non-published ids intentionally fall back to the activity index.
 *
 * The catalogue override is test-only infrastructure: production callers use
 * the static catalogue above, while tests can exercise known draft/archive
 * entries without mutating the production catalogue.
 */
export function resolveActivityDestination(
  id: string,
  fallback = "/evenements",
  catalogue: ActivityCatalogue = DEFAULT_CATALOGUE,
): string {
  const activity = catalogue.get(id);
  return activity?.status === "published" && activity.url ? activity.url : fallback;
}

/** Build a catalogue from an explicit activity set (primarily for tests). */
export function createActivityCatalogue(
  activities: readonly AvailableActivity[] = AVAILABLE_ACTIVITIES,
): ActivityCatalogue {
  return new Map(activities.map((activity) => [activity.id, activity]));
}
