import { describe, expect, it } from "vitest";
import { getActivityPresentation } from "../src/lib/orientation/presentation";

describe("recommendation presentation", () => {
  it("resolves published activities by stable id", () => {
    const activity = getActivityPresentation("challenge-git-essentials");
    expect(activity?.title).toBe("Challenge Git Essentials");
    expect(activity?.status).toBe("published");
  });

  it("returns null for an unknown recommendation id", () => {
    expect(getActivityPresentation("unknown-activity")).toBeNull();
  });
});
