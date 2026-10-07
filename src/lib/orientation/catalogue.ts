import { ACTIVITY_BY_ID, AVAILABLE_ACTIVITIES, type AvailableActivity } from "./features";

/**
 * Canonical access layer for orientation activities.
 *
 * The seed remains the current local source of truth. Runtime callers can
 * inject another catalogue (for example the DB adapter) without changing
 * matching, presentation, or destination code.
 */
export type ActivityCatalogue = ReadonlyMap<string, AvailableActivity>;

export function createActivityCatalogue(
  activities: readonly AvailableActivity[] = AVAILABLE_ACTIVITIES,
): ActivityCatalogue {
  return new Map(activities.map((activity) => [activity.id, activity]));
}

export const DEFAULT_ACTIVITY_CATALOGUE: ActivityCatalogue = ACTIVITY_BY_ID;

export function getActivityCatalogue(): ActivityCatalogue {
  return DEFAULT_ACTIVITY_CATALOGUE;
}

export function getPublishedActivities(
  catalogue: ActivityCatalogue = DEFAULT_ACTIVITY_CATALOGUE,
): AvailableActivity[] {
  return Array.from(catalogue.values()).filter(
    (activity) => activity.status === "published",
  );
}

export function getActivityById(
  id: string,
  catalogue: ActivityCatalogue = DEFAULT_ACTIVITY_CATALOGUE,
): AvailableActivity | null {
  return catalogue.get(id) ?? null;
}
