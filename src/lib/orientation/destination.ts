import {
  createActivityCatalogue,
  getActivityById,
  getActivityCatalogue,
  type ActivityCatalogue,
} from "./catalogue";

/**
 * Resolve a recommendation id to a safe internal destination.
 * Unknown or non-published ids intentionally fall back to the activity index.
 */
export function resolveActivityDestination(
  id: string,
  fallback = "/evenements",
  catalogue: ActivityCatalogue = getActivityCatalogue(),
): string {
  const activity = getActivityById(id, catalogue);
  return activity?.status === "published" && activity.url ? activity.url : fallback;
}

/** Build a catalogue from an explicit activity set (primarily for adapters/tests). */
export { createActivityCatalogue };
