/**
 * Tests — M4 catalogue DB + matching étendu (src/lib/orientation/).
 *
 * Teste le VRAI code TS via tsx : mappers Workshop/Event, catalogue injecté,
 * sens inverse activity → members. Le loader DB (`loadPublishedActivities`)
 * n'est pas testé ici (adaptateur fin, I/O) — les mappers purs couvrent
 * la logique de sélection.
 *
 * Run:  tsx --test tests/orientation-activities.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  workshopToActivity,
  eventToActivity,
} from "../src/lib/orientation/activities";
import {
  matchActivityList,
  rankMembersForActivity,
} from "../src/lib/orientation/matching";
import { orientationEngine } from "../src/lib/orientation/engine";
import { AVAILABLE_ACTIVITIES } from "../src/lib/orientation/features";
import type { AvailableActivity } from "../src/lib/orientation/features";
import type { ProfileAnswers } from "../src/lib/profiling/types";

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

function activity(overrides: Partial<AvailableActivity> = {}): AvailableActivity {
  return {
    id: "test:activity",
    type: "challenge",
    title: "Test",
    description: "",
    status: "published",
    ...overrides,
  };
}

describe("m4 — workshopToActivity", () => {
  test("workshop publié → activité workshop avec ciblage", () => {
    const a = workshopToActivity({
      id: "1",
      slug: "git-bases",
      title: "Git bases",
      description: "d",
      domain: "web",
      level: "beginner",
    });
    assert.ok(a);
    assert.equal(a!.type, "workshop");
    assert.equal(a!.id, "workshop:git-bases");
    assert.deepEqual(a!.domains, ["web"]);
    assert.deepEqual(a!.levels, ["beginner"]);
  });

  test("domaine/niveau inconnus → ouverts (jamais exclus)", () => {
    const a = workshopToActivity({
      id: "1",
      slug: "x",
      title: "X",
      description: null,
      domain: "quantique",
      level: "gourou",
    });
    assert.ok(a);
    assert.equal(a!.domains, undefined);
    assert.equal(a!.levels, undefined);
  });

  test("domaine/level null → ouverts à tous", () => {
    const a = workshopToActivity({
      id: "1",
      slug: "x",
      title: "X",
      description: null,
      domain: null,
      level: null,
    });
    assert.ok(a);
    assert.equal(a!.domains, undefined);
  });
});

describe("m4 — eventToActivity", () => {
  test("event meetup → activité event", () => {
    const a = eventToActivity({
      id: "e1",
      title: "Meetup",
      description: null,
      type: "meetup",
      domain: "ai",
      level: null,
      url: null,
    });
    assert.ok(a);
    assert.equal(a!.type, "event");
    assert.equal(a!.id, "event:e1");
    assert.equal(a!.url, "/evenements");
  });

  test("event workshop → activité workshop", () => {
    const a = eventToActivity({
      id: "e2",
      title: "W",
      description: null,
      type: "workshop",
      domain: null,
      level: null,
      url: "https://meet.example/x",
    });
    assert.ok(a);
    assert.equal(a!.type, "workshop");
    assert.equal(a!.url, "https://meet.example/x");
  });

  test("type inconnu → null (jamais recommandé)", () => {
    assert.equal(
      eventToActivity({
        id: "e3",
        title: "Y",
        description: null,
        type: "teleportation",
        domain: null,
        level: null,
        url: null,
      }),
      null,
    );
  });
});

describe("m4 — catalogue injecté", () => {
  test("matchActivityList ignore les non-publiées", () => {
    const matches = matchActivityList(profile(), [
      activity({ id: "a1" }),
      activity({ id: "a2", status: "draft" }),
      activity({ id: "a3", status: "archived" }),
    ]);
    assert.deepEqual(matches.map((m) => m.activity.id), ["a1"]);
  });

  test("evaluateWithActivities trie par pertinence sur liste custom", () => {
    const r = orientationEngine.evaluateWithActivities(profile(), [
      activity({
        id: "far",
        type: "content",
        domains: ["cybersecurity"],
        levels: ["advanced"],
      }),
      activity({
        id: "near",
        type: "challenge",
        domains: ["web"],
        levels: ["beginner"],
        goals: ["project"],
        learningStyles: ["practice"],
      }),
    ]);
    assert.equal(r.status, "OK");
    assert.equal(r.recommendations[0].id, "near");
    assert.equal(r.nextBestAction!.id, "near");
  });

  test("liste vide → NO_MATCH, rien d'inventé", () => {
    const r = orientationEngine.evaluateWithActivities(profile(), []);
    assert.equal(r.status, "NO_MATCH");
    assert.equal(r.recommendations.length, 0);
    assert.equal(r.nextBestAction, null);
  });

  test("catalogue DB vide → seed statique de repli utilisable", () => {
    const r = orientationEngine.evaluateWithActivities(
      profile(),
      AVAILABLE_ACTIVITIES,
    );
    assert.equal(r.status, "OK");
    assert.ok(r.nextBestAction);
  });
});

describe("m4 — sens inverse activity → members", () => {
  const act = activity({
    id: "w1",
    type: "workshop",
    domains: ["web"],
    levels: ["beginner"],
  });

  test("classe les membres par pertinence décroissante", () => {
    const ranked = rankMembersForActivity(act, [
      { id: "m-far", answers: profile({ primaryDomain: "ai", level: "advanced" }) },
      { id: "m-near", answers: profile() },
    ]);
    assert.equal(ranked[0].id, "m-near");
    assert.ok(ranked[0].score >= ranked[1].score);
  });

  test("activité non publiée → aucun classement", () => {
    assert.deepEqual(
      rankMembersForActivity(activity({ status: "draft" }), [
        { id: "m", answers: profile() },
      ]),
      [],
    );
  });

  test("limite respectée", () => {
    const members = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      answers: profile(),
    }));
    assert.equal(rankMembersForActivity(act, members, 3).length, 3);
  });
});
