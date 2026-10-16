/**
 * Qualité des leads (#105) — score et règles, sans DB.
 * Run: tsx --test tests/lead-quality.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { coherenceFlags, scoreCompleteness } from "../src/lib/lead-quality";

const full = {
  lastName: "D",
  phone: "+22990000000",
  city: "Cotonou",
  secondaryDomains: '["ai"]',
  goal: "project",
  goalProjectStage: "idea",
  availabilityTimes: "soirs",
  mentoringInterest: "yes",
  mentoringTypes: '["technique"]',
  mentoringFrequency: "hebdo",
  mentoringDomain: "web",
  budgetWillingness: "yes",
  budgetRange: "2500-5000",
  threeMonthGoal: "Lancer mon projet",
};

describe("scoreCompleteness : 0–100 sur champs pertinents", () => {
  test("profil plein (projet+mentorat) → 100", () => {
    assert.equal(scoreCompleteness(full), 100);
  });

  test("vide → 0 (champs toujours pertinents manquants)", () => {
    assert.equal(scoreCompleteness({}), 0);
  });

  test("conditionnels non pertinents ignorés", () => {
    // goal=employment : stage projet et champs mentorat hors sujet.
    const s = scoreCompleteness({ goal: "employment", goalSituation: "salarie" });
    assert.ok(s > 0 && s <= 100, `score=${s}`);
    // Même ligne sans situation : cohérence signalée séparément, mais le
    // champ n'est compté que s'il est pertinent (il l'est ici).
    const without = scoreCompleteness({ goal: "employment" });
    assert.ok(without < s, `${without} < ${s}`);
  });

  test("JSON invalide / tableau vide = non rempli", () => {
    assert.ok(
      scoreCompleteness({ mentoringInterest: "yes", mentoringTypes: "[]" }) < 100,
    );
    assert.ok(
      scoreCompleteness({ mentoringInterest: "yes", mentoringTypes: "pas-json" }) < 100,
    );
  });
});

describe("coherenceFlags : codes stables", () => {
  test("3 règles + vide", () => {
    assert.deepEqual(coherenceFlags({ goal: "employment" }), [
      "EMPLOYMENT_WITHOUT_SITUATION",
    ]);
    assert.deepEqual(coherenceFlags({ mentoringInterest: "yes", mentoringTypes: "[]" }), [
      "MENTORING_WITHOUT_TYPES",
    ]);
    assert.deepEqual(coherenceFlags({ goal: "project" }), ["PROJECT_WITHOUT_STAGE"]);
    assert.deepEqual(coherenceFlags({}), []);
    assert.deepEqual(
      coherenceFlags({ goal: "employment", goalSituation: "x" }),
      [],
    );
  });
});
