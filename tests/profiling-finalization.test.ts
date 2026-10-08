/**
 * Tests — finalisation #155/#147 (niveau effectif).
 *
 * Teste le VRAI code TS via tsx : résolution avec niveau effectif
 * (les données observées alimentent les recommandations).
 * `loadObservedSignals` n'est pas testé ici (adaptateur fin, I/O) —
 * la logique pure couvre les règles métier.
 * L'historique d'évaluation est porté par `Qualification` (append-only,
 * arbitrage C1) : aucun builder de snapshot testé ici.
 *
 * Run:  tsx --test tests/profiling-finalization.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { resolveOrientation } from "../src/lib/orientation/resolve";
import { AVAILABLE_ACTIVITIES } from "../src/lib/orientation/features";
import type { AvailableActivity } from "../src/lib/orientation/features";
import type { ObservedSignals } from "../src/lib/profiling/layers";
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

function observed(overrides: Partial<ObservedSignals> = {}): ObservedSignals {
  return {
    workshopsStarted: 0,
    workshopsCompleted: 0,
    eventsJoined: 0,
    mentoringRequested: false,
    recosAccepted: 0,
    recosIgnored: 0,
    lastActivityAt: null,
    ...overrides,
  };
}

describe("finalisation — resolveOrientation", () => {
  test("sans observed → évaluation sur le déclaré, usedEffectiveLevel false", () => {
    const r = resolveOrientation(profile(), null, AVAILABLE_ACTIVITIES);
    assert.equal(r.layered, null);
    assert.equal(r.usedEffectiveLevel, false);
    assert.equal(r.orientation.status, "OK");
  });

  test("observed vide → pas d'upgrade, recos au niveau déclaré", () => {
    const r = resolveOrientation(profile(), observed(), AVAILABLE_ACTIVITIES);
    assert.equal(r.usedEffectiveLevel, false);
    assert.equal(r.layered?.effectiveLevel, "beginner");
  });

  test("2 complétions → recos calculées au niveau effectif (practicing)", () => {
    const practicingOnly: AvailableActivity[] = [
      {
        id: "practicing-only",
        type: "workshop",
        title: "Atelier practicing",
        description: "",
        status: "published",
        domains: ["web"],
        levels: ["practicing"],
        goals: ["project"],
        learningStyles: ["practice"],
      },
    ];
    const obs = observed({ workshopsStarted: 2, workshopsCompleted: 2 });
    const r = resolveOrientation(profile(), obs, practicingOnly);
    assert.equal(r.layered?.levelUpgradeSuggested, true);
    assert.equal(r.usedEffectiveLevel, true);
    assert.equal(r.orientation.recommendations[0].id, "practicing-only");

    // Sans observed, la même activité matche moins bien (pas de bonus niveau).
    const base = resolveOrientation(profile(), null, practicingOnly);
    assert.ok(
      r.orientation.recommendations[0].score >
        base.orientation.recommendations[0].score,
      "le niveau effectif doit améliorer le score de la recommandation",
    );
  });

  test("déterministe : même entrée → même sortie", () => {
    const obs = observed({ workshopsStarted: 3, eventsJoined: 2 });
    const a = resolveOrientation(profile(), obs, AVAILABLE_ACTIVITIES);
    const b = resolveOrientation(profile(), obs, AVAILABLE_ACTIVITIES);
    assert.deepEqual(a, b);
  });
});
