/**
 * Tests — Orientation Engine V1 (src/lib/orientation/).
 *
 * Contrairement aux autres tests `.cjs` du dépôt (qui réimplémentent la logique
 * en miroir), ces tests importent le VRAI code TS via tsx : ils vérifient donc
 * réellement le moteur, sans risque de dérive miroir.
 *
 * Run:  tsx --test tests/orientation.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  orientationEngine,
  ORIENTATION_ENGINE_VERSION,
} from "../src/lib/orientation/engine";
import { computeScores, extractFeatures } from "../src/lib/orientation/scoring";
import { computeConfidence, missingFields } from "../src/lib/orientation/confidence";
import { matchActivities } from "../src/lib/orientation/matching";
import { AVAILABLE_ACTIVITIES } from "../src/lib/orientation/features";
import type { ProfileAnswers } from "../src/lib/profiling/types";

/** Profil complet de base — surchargeable. */
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

describe("orientation — scoring", () => {
  test("retourne 4 scores bornés [0,1]", () => {
    const s = computeScores(profile());
    for (const k of ["builder", "strategist", "creator", "catalyst"] as const) {
      assert.ok(s[k] >= 0 && s[k] <= 1, `${k}=${s[k]} hors [0,1]`);
    }
  });

  test("débutant web + projet + pratique → builder dominant", () => {
    const s = computeScores(profile());
    assert.equal(
      orientationEngine.dominantArchetype(profile()),
      "builder",
      `scores=${JSON.stringify(s)}`,
    );
  });

  test("apprentissage groupe + mentorat → catalyst dominant", () => {
    const s = computeScores(
      profile({ learningStyle: "group", mentoringInterest: "yes", goal: "employment" }),
    );
    assert.equal(
      orientationEngine.dominantArchetype(
        profile({ learningStyle: "group", mentoringInterest: "yes", goal: "employment" }),
      ),
      "catalyst",
      `scores=${JSON.stringify(s)}`,
    );
  });

  test("stratège : business + parcours structuré → strategist dominant", () => {
    const p = profile({ goal: "business", learningStyle: "path", level: "advanced" });
    assert.equal(orientationEngine.dominantArchetype(p), "strategist");
  });

  test("extractFeatures dérive les features attendues", () => {
    const f = extractFeatures(profile());
    assert.ok(f.has("goal:project"));
    assert.ok(f.has("level:beginner"));
    assert.ok(f.has("style:practice"));
    assert.ok(f.has("domain:web"));
  });

  test("déterministe : même profil → mêmes scores", () => {
    const a = computeScores(profile());
    const b = computeScores(profile());
    assert.deepEqual(a, b);
  });
});

describe("orientation — confiance", () => {
  test("profil complet → confiance élevée (> 0.7)", () => {
    assert.ok(computeConfidence(profile()) > 0.7);
  });

  test("confiance ≠ score (mesures distinctes)", () => {
    const p = profile({ goal: "upskill", learningStyle: "path" });
    const scores = computeScores(p);
    const confidence = computeConfidence(p);
    assert.notEqual(confidence, scores.builder);
  });

  test("email jetable → confiance réduite", () => {
    const clean = computeConfidence(profile());
    const disposable = computeConfidence(profile({ email: "x@mailinator.com" }));
    assert.ok(disposable < clean);
  });

  test("missingFields liste les champs structurants absents", () => {
    const missing = missingFields(profile({ email: "", level: undefined }));
    assert.ok(missing.includes("email"));
    assert.ok(missing.includes("level"));
  });
});

describe("orientation — matching", () => {
  test("ne renvoie que des activités publiées", () => {
    const matches = matchActivities(profile());
    const publishedIds = new Set(
      AVAILABLE_ACTIVITIES.filter((a) => a.status === "published").map((a) => a.id),
    );
    for (const m of matches) {
      assert.ok(publishedIds.has(m.activity.id), `${m.activity.id} non publiée`);
    }
  });

  test("chaque match porte au moins une raison", () => {
    const matches = matchActivities(profile()).filter((m) => m.score > 0);
    assert.ok(matches.length > 0);
    for (const m of matches) assert.ok(m.reasons.length > 0, m.activity.id);
  });

  test("trié par pertinence décroissante", () => {
    const matches = matchActivities(profile());
    for (let i = 1; i < matches.length; i++) {
      assert.ok(matches[i - 1].score >= matches[i].score);
    }
  });
});

describe("orientation — evaluate()", () => {
  test("profil complet → status OK + nextBestAction non nul", () => {
    const r = orientationEngine.evaluate(profile());
    assert.equal(r.status, "OK");
    assert.ok(r.recommendations.length > 0);
    assert.ok(r.nextBestAction, "nextBestAction attendu");
    assert.equal(r.engineVersion, ORIENTATION_ENGINE_VERSION);
  });

  test("Next Best Action pointe sur la meilleure recommandation", () => {
    const r = orientationEngine.evaluate(profile());
    assert.ok(r.nextBestAction);
    assert.equal(r.nextBestAction!.id, r.recommendations[0].id);
    assert.ok(r.nextBestAction!.reason.length > 0);
  });

  test("données insuffisantes → INSUFFICIENT_DATA, aucune reco forcée", () => {
    const r = orientationEngine.evaluate(profile({ primaryDomain: undefined }));
    assert.equal(r.status, "INSUFFICIENT_DATA");
    assert.equal(r.recommendations.length, 0);
    assert.equal(r.nextBestAction, null);
    assert.ok((r.missing ?? []).includes("primaryDomain"));
  });

  test("résultat reproductible et versionné", () => {
    const a = orientationEngine.evaluate(profile());
    const b = orientationEngine.evaluate(profile());
    assert.deepEqual(a, b);
    assert.equal(a.engineVersion, ORIENTATION_ENGINE_VERSION);
  });

  test("chaque recommandation est explicable (raisons non vides)", () => {
    const r = orientationEngine.evaluate(profile());
    for (const rec of r.recommendations) {
      assert.ok(rec.reasons.length > 0, rec.id);
      assert.ok(rec.score >= 0 && rec.score <= 1, rec.id);
    }
  });

  test("les recommandations sont limitées (≤ 5)", () => {
    const r = orientationEngine.evaluate(profile());
    assert.ok(r.recommendations.length <= 5);
  });
});
