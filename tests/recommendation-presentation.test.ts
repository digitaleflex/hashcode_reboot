import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getActivityPresentation } from "../src/lib/orientation/presentation";

describe("recommendation presentation", () => {
  it("resolves published activities by stable id", () => {
    const activity = getActivityPresentation("challenge-git-essentials");
    assert.equal(activity?.title, "Challenge Git Essentials");
    assert.equal(activity?.status, "published");
  });

  it("returns null for an unknown recommendation id", () => {
    assert.equal(getActivityPresentation("unknown-activity"), null);
  });
});
