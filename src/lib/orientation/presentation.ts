import {
  getActivityById,
  getActivityCatalogue,
  type ActivityCatalogue,
} from "./catalogue";
import type { AvailableActivity } from "./features";

export function getActivityPresentation(
  id: string,
  catalogue: ActivityCatalogue = getActivityCatalogue(),
): AvailableActivity | null {
  const activity = getActivityById(id, catalogue);
  return activity?.status === "published" ? activity : null;
}
