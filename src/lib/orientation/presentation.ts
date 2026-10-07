import { AVAILABLE_ACTIVITIES, type AvailableActivity } from "./features";

const ACTIVITY_BY_ID = new Map(AVAILABLE_ACTIVITIES.map((activity) => [activity.id, activity]));

export function getActivityPresentation(id: string): AvailableActivity | null {
  return ACTIVITY_BY_ID.get(id) ?? null;
}
