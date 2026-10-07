import { ACTIVITY_BY_ID } from "./features";

/**
 * Resolve a recommendation id to a safe internal destination.
 * Unknown ids intentionally fall back to the activity index.
 */
export function resolveActivityDestination(id: string, fallback = "/evenements"): string {
  const activity = ACTIVITY_BY_ID.get(id);
  return activity?.status === "published" && activity.url ? activity.url : fallback;
}
