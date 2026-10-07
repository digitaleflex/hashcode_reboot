import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { orientationEngine, ORIENTATION_ENGINE_VERSION } from "../src/lib/orientation/engine";
import { NEXT_ACTION_CONFIDENCE_THRESHOLD } from "../src/lib/orientation/recommendationEngine";
import { resolveActivityDestination } from "../src/lib/orientation/destination";
import { AVAILABLE_ACTIVITIES } from "../src/lib/orientation/features";
import { createActivityCatalogue } from "../src/lib/orientation/destination";
import { profileSchema } from "../src/lib/profiling/validate";
import type { ProfileAnswers } from "../src/lib/profiling/types";
import type { AvailableActivity } from "../src/lib/orientation/features";

function profile(overrides: Partial<ProfileAnswers> = {}): ProfileAnswers {
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
    threeMonthGoal: "Construire ma première interface web et la publier.",
    ...overrides,
  };
}

describe("phase 6 — orientation states", () => {
  test("OK + Next Best Action", () => {
    const result = orientationEngine.evaluate(profile());

    assert.equal(result.status, "OK");
    assert.ok(result.recommendations.length > 0);
    assert.ok(result.nextBestAction);
    assert.equal(result.nextBestAction?.id, result.recommendations[0].id);
    assert.ok(result.confidence >= NEXT_ACTION_CONFIDENCE_THRESHOLD);
  });

  test("OK sans Next Best Action est atteignable avec un profil complet mais faible confiance", () => {
    const result = orientationEngine.evaluate(
      profile({
        email: "ama@example.com",
        learningStyle: "practice",
        mentoringInterest: "no",
        threeMonthGoal: "Test",
      }),
    );

    assert.equal(result.status, "OK");
    assert.ok(result.recommendations.length > 0);
    assert.equal(result.nextBestAction, null);
    const parsed = profileSchema.safeParse(profile({ threeMonthGoal: "Test" }));
    assert.equal(parsed.success, true);
    assert.ok(result.confidence < NEXT_ACTION_CONFIDENCE_THRESHOLD);
  });

  test("INSUFFICIENT_DATA", () => {
    const result = orientationEngine.evaluate(
      profile({ primaryDomain: undefined }),
    );

    assert.equal(result.status, "INSUFFICIENT_DATA");
    assert.deepEqual(result.recommendations, []);
    assert.equal(result.nextBestAction, null);
    assert.ok(result.missing?.includes("primaryDomain"));
  });

  test("les recommandations embarquent les métadonnées du catalogue live", () => {
    const liveActivity: AvailableActivity = {
      id: "event:live-42",
      type: "event",
      title: "Session Live Web",
      description: "Une session réellement publiée en base.",
      domains: ["web"],
      levels: ["beginner"],
      goals: ["project"],
      status: "published",
      url: "/evenements/live-42",
    };
    const result = orientationEngine.evaluateWithActivities(profile(), [liveActivity]);

    assert.equal(result.status, "OK");
    assert.equal(result.recommendations[0]?.id, liveActivity.id);
    assert.equal(result.recommendations[0]?.activity?.title, liveActivity.title);
    assert.equal(result.recommendations[0]?.activity?.url, liveActivity.url);
  });

  test("NO_MATCH", () => {
    const result = orientationEngine.evaluateWithActivities(profile(), []);

    assert.equal(result.status, "NO_MATCH");
    assert.deepEqual(result.recommendations, []);
    assert.equal(result.nextBestAction, null);
  });

  test("les résultats restent versionnés et déterministes", () => {
    const first = orientationEngine.evaluate(profile());
    const second = orientationEngine.evaluate(profile());

    assert.equal(first.engineVersion, ORIENTATION_ENGINE_VERSION);
    assert.deepEqual(first, second);
  });
});

describe("phase 6 — destination hardening", () => {
  test("toutes les activités publiées ont une destination résoluble", () => {
    for (const activity of AVAILABLE_ACTIVITIES.filter(
      (candidate) => candidate.status === "published",
    )) {
      assert.ok(
        resolveActivityDestination(activity.id).length > 0,
        activity.id,
      );
    }
  });

  test("un ID inconnu utilise le fallback sans inventer de route", () => {
    assert.equal(
      resolveActivityDestination("activity-that-does-not-exist"),
      "/evenements",
    );
  });

  test("un catalogue injecté permet de résoudre une destination live publiée", () => {
    const liveActivity: AvailableActivity = {
      id: "event:live-42",
      type: "event",
      title: "Session Live Web",
      description: "Une session réellement publiée en base.",
      status: "published",
      url: "/evenements/live-42",
    };
    assert.equal(
      resolveActivityDestination(liveActivity.id, "/evenements", createActivityCatalogue([liveActivity])),
      liveActivity.url,
    );
  });

  test("une activité non publiée ne devient jamais une destination active", () => {
    const draft = {
      ...AVAILABLE_ACTIVITIES[0],
      id: "phase6-draft-only",
      status: "draft" as const,
    };

    assert.equal(
      resolveActivityDestination(draft.id, "/evenements"),
      "/evenements",
    );
  });
});
