import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createActivityCatalogue,
  getActivityById,
  getPublishedActivities,
} from "../src/lib/orientation/catalogue";
import { matchActivities } from "../src/lib/orientation/matching";
import { getActivityPresentation } from "../src/lib/orientation/presentation";
import { resolveActivityDestination } from "../src/lib/orientation/destination";
import type { AvailableActivity } from "../src/lib/orientation/features";
import type { ProfileAnswers } from "../src/lib/profiling/types";

function profile(): ProfileAnswers {
  return {
    firstName: "Ama",
    lastName: "D.",
    email: "ama@example.com",
    phone: "",
    country: "BJ",
    city: "",
    primaryDomain: "web",
    level: "beginner",
    goal: "project",
    availability: "2-5h",
    learningStyle: "practice",
    mentoringInterest: "no",
    threeMonthGoal: "Construire ma première interface web.",
  };
}

const liveActivity: AvailableActivity = {
  id: "event:catalogue-live-42",
  type: "event",
  title: "Session Live Web",
  description: "Activité publiée depuis le catalogue injecté.",
  domains: ["web"],
  levels: ["beginner"],
  goals: ["project"],
  status: "published",
  url: "/evenements/live-42",
};

describe("phase 8 — canonical activity catalogue", () => {
  it("exposes published activities from one canonical map", () => {
    const catalogue = createActivityCatalogue([liveActivity]);
    assert.equal(getActivityById(liveActivity.id, catalogue), liveActivity);
    assert.deepEqual(getPublishedActivities(catalogue), [liveActivity]);
  });

  it("shares the same injected catalogue across matching, presentation and routing", () => {
    const catalogue = createActivityCatalogue([liveActivity]);
    const matches = matchActivities(profile(), catalogue);
    assert.equal(matches[0]?.activity.id, liveActivity.id);
    assert.equal(getActivityPresentation(liveActivity.id, catalogue)?.title, liveActivity.title);
    assert.equal(
      resolveActivityDestination(liveActivity.id, "/evenements", catalogue),
      liveActivity.url,
    );
  });

  it("never exposes draft activities through presentation or routing", () => {
    const draft = { ...liveActivity, id: "event:draft", status: "draft" as const };
    const catalogue = createActivityCatalogue([draft]);

    assert.equal(getActivityPresentation(draft.id, catalogue), null);
    assert.equal(resolveActivityDestination(draft.id, "/evenements", catalogue), "/evenements");
  });

  it("falls back safely for unknown ids", () => {
    const catalogue = createActivityCatalogue([liveActivity]);
    assert.equal(
      resolveActivityDestination("event:unknown", "/evenements", catalogue),
      "/evenements",
    );
    assert.equal(getActivityPresentation("event:unknown", catalogue), null);
  });
});
