/**
 * Tests — Profiling Engine V1 layers (src/lib/profiling/dynamicProfile.ts).
 *
 * Like tests/orientation.test.ts, these import the REAL TS code via tsx.
 *
 * Run:  npx tsx --test tests/profiling-layers.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildLayeredProfile,
  isObservedEmpty,
} from "../src/lib/profiling/dynamicProfile";
import type { ObservedSignals } from "../src/lib/profiling/dynamicProfile";
import type { ProfileAnswers } from "../src/lib/profiling/types";

/** Declared profile fixture — overridable. */
function declared(overrides: Partial<ProfileAnswers> = {}): ProfileAnswers {
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

/** Observed signals fixture — empty by default, overridable. */
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

describe("profiling-layers — empty observed", () => {
  test("observed vide → INSUFFICIENT_DATA, niveau déclaré, confiance 0", () => {
    const d = declared();
    const o = observed();
    assert.equal(isObservedEmpty(o), true);
    const p = buildLayeredProfile(d, o);
    assert.equal(p.status, "INSUFFICIENT_DATA");
    assert.equal(p.effectiveLevel, d.level);
    assert.equal(p.observedConfidence, 0);
    assert.ok(p.explanations.includes("observed:empty"));
    assert.equal(p.levelUpgradeSuggested, false);
    assert.equal(p.domainAffinityShift, null);
  });
});

describe("profiling-layers — level upgrade", () => {
  test("beginner + 2 complétions → 1 seul cran vers practicing", () => {
    const p = buildLayeredProfile(
      declared({ level: "beginner" }),
      observed({ workshopsCompleted: 2, lastActivityAt: "2026-01-01" }),
    );
    assert.equal(p.status, "OK");
    assert.equal(p.levelUpgradeSuggested, true);
    assert.equal(p.effectiveLevel, "practicing");
  });

  test("beginner + 10 complétions → toujours 1 seul cran", () => {
    const p = buildLayeredProfile(
      declared({ level: "beginner" }),
      observed({ workshopsCompleted: 10, lastActivityAt: "2026-01-01" }),
    );
    assert.equal(p.levelUpgradeSuggested, true);
    assert.equal(p.effectiveLevel, "practicing");
  });

  test("advanced + 5 complétions → reste advanced, flag false", () => {
    const p = buildLayeredProfile(
      declared({ level: "advanced" }),
      observed({ workshopsCompleted: 5, lastActivityAt: "2026-01-01" }),
    );
    assert.equal(p.effectiveLevel, "advanced");
    assert.equal(p.levelUpgradeSuggested, false);
  });
});

describe("profiling-layers — mentoring override", () => {
  test("mentoringInterest no + mentoringRequested → explication, niveau inchangé", () => {
    const d = declared({ level: "beginner", mentoringInterest: "no" });
    const p = buildLayeredProfile(
      d,
      observed({ mentoringRequested: true, lastActivityAt: "2026-01-01" }),
    );
    assert.ok(
      p.explanations.includes("mentoring:observed-overrides-declared"),
    );
    assert.equal(p.effectiveLevel, d.level);
    assert.equal(p.levelUpgradeSuggested, false);
  });
});

describe("profiling-layers — déterminisme", () => {
  test("2 appels identiques → JSON.stringify identique", () => {
    const d = declared();
    const o = observed({ workshopsCompleted: 3, eventsJoined: 1 });
    const a = JSON.stringify(buildLayeredProfile(d, o));
    const b = JSON.stringify(buildLayeredProfile(d, o));
    assert.equal(a, b);
  });
});
