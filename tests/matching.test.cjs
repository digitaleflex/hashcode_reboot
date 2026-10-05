/**
 * Unit tests — matching mentorat #61 (fonctions pures).
 *
 * Run:  node --import tsx --test tests/matching.test.cjs
 *
 * Ce test importe la VRAIE source `src/lib/matching.ts` (D18) — il ne
 * réimplémente rien. Les trois fonctions testées (`parseSpecialties`,
 * `scoreMatch`, `suggestMentors`) sont bien des exports publics du module,
 * donc le contrat est vérifié directement.
 *
 * Coverage:
 *  - barème : +30 domaine, +20 spécialités, +20 fréquence, +10 pays,
 *    +20 budget concret, plafond 100
 *  - parse : tableau, JSON string, JSON corrompu, null
 *  - tri : score desc, puis charge asc, puis niveau
 *  - top 5 par défaut, `limit` explicite
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  parseSpecialties,
  scoreMatch,
  suggestMentors,
} = require("../src/lib/matching.ts");

// ── Fixtures ──

const MENTEE = {
  primaryDomain: "cybersecurity",
  domainSpecialty: ["pentest", "osint"],
  mentoringFrequency: "weekly",
  country: "BJ",
  budgetRange: "20000-30000",
};

const PERFECT_MENTOR = {
  id: "m1",
  primaryDomain: "cybersecurity",
  domainSpecialty: ["pentest", "soc"],
  mentoringFrequency: "weekly",
  country: "BJ",
  level: "advanced",
  activeMentees: 0,
};

// ── Tests ──

describe("parseSpecialties", () => {
  test("tableau, JSON string, corrompu, null", () => {
    assert.deepEqual(parseSpecialties(["a", "b"]), ["a", "b"]);
    assert.deepEqual(parseSpecialties('["a","b"]'), ["a", "b"]);
    assert.deepEqual(parseSpecialties("pas du json"), []);
    assert.deepEqual(parseSpecialties(null), []);
    assert.deepEqual(parseSpecialties(undefined), []);
    assert.deepEqual(parseSpecialties('{"a":1}'), []);
  });

  test("JSON scalar ou objet non-tableau → []", () => {
    assert.deepEqual(parseSpecialties("42"), []);
    assert.deepEqual(parseSpecialties("null"), []);
    assert.deepEqual(parseSpecialties(""), []);
  });
});

describe("scoreMatch (barème spec)", () => {
  test("match parfait = 100 (30+20+20+10+20)", () => {
    const r = scoreMatch(MENTEE, PERFECT_MENTOR);
    assert.equal(r.score, 100);
    assert.deepEqual(r.reasons, [
      "same-domain",
      "specialty-overlap",
      "same-frequency",
      "same-country",
      "concrete-budget",
    ]);
    assert.equal(r.mentorId, "m1");
  });

  test("aucun point commun sauf budget concret = 20", () => {
    const r = scoreMatch(MENTEE, {
      id: "m2",
      primaryDomain: "web",
      domainSpecialty: ["react"],
      mentoringFrequency: "monthly",
      country: "FR",
      level: "beginner",
      activeMentees: 0,
    });
    assert.equal(r.score, 20);
    assert.deepEqual(r.reasons, ["concrete-budget"]);
  });

  test("spécialités mentor en JSON string sont parsées", () => {
    const r = scoreMatch(MENTEE, {
      ...PERFECT_MENTOR,
      id: "m4",
      domainSpecialty: '["osint"]',
    });
    assert.ok(r.reasons.includes("specialty-overlap"));
    assert.equal(r.score, 100);
  });

  test("budget non renseigné (unknown/not_now/null) = pas de +20", () => {
    for (const b of ["unknown", "not_now", null]) {
      const r = scoreMatch({ ...MENTEE, budgetRange: b }, PERFECT_MENTOR);
      assert.equal(r.score, 80, `budget=${b}`);
      assert.ok(!r.reasons.includes("concrete-budget"));
    }
  });

  test("champs null côté mentor = pas de crash, pas de points", () => {
    const r = scoreMatch(MENTEE, {
      id: "m3",
      primaryDomain: null,
      domainSpecialty: null,
      mentoringFrequency: null,
      country: null,
      level: null,
      activeMentees: 0,
    });
    assert.equal(r.score, 20); // seul le budget du mentoré compte
    assert.deepEqual(r.reasons, ["concrete-budget"]);
  });

  test("spécialités du mentoré non vides mais disjointes = pas de +20", () => {
    const r = scoreMatch(MENTEE, {
      ...PERFECT_MENTOR,
      id: "m5",
      domainSpecialty: ["frontend", "backend"],
    });
    assert.ok(!r.reasons.includes("specialty-overlap"));
    assert.equal(r.score, 80);
  });
});

describe("suggestMentors", () => {
  test("tri score desc, top 5 par défaut", () => {
    const mentors = Array.from({ length: 7 }, (_, i) => ({
      id: `m${i}`,
      primaryDomain: i < 3 ? "cybersecurity" : "web",
      domainSpecialty: [],
      mentoringFrequency: null,
      country: null,
      level: "advanced",
      activeMentees: 0,
    }));
    const out = suggestMentors(MENTEE, mentors);
    assert.equal(out.length, 5);
    assert.ok(out[0].score >= out[4].score);
  });

  test("égalité de score → moins chargé d'abord, puis niveau", () => {
    const a = { ...PERFECT_MENTOR, id: "a", activeMentees: 2 };
    const b = { ...PERFECT_MENTOR, id: "b", activeMentees: 0 };
    const c = { ...PERFECT_MENTOR, id: "c", activeMentees: 0, level: "beginner" };
    const out = suggestMentors(MENTEE, [a, b, c]);
    assert.deepEqual(
      out.map((r) => r.mentorId),
      ["b", "c", "a"],
    );
  });

  test("score décroissant en tête de liste", () => {
    const out = suggestMentors(MENTEE, [
      PERFECT_MENTOR,
      {
        ...PERFECT_MENTOR,
        id: "weak",
        primaryDomain: "web",
        domainSpecialty: [],
        mentoringFrequency: null,
        country: "FR",
      },
    ]);
    assert.deepEqual(
      out.map((r) => r.score),
      [100, 20],
    );
  });

  test("limit explicite respecté ; limit <= 0 → au moins 1", () => {
    const mentors = [1, 2, 3, 4].map((i) => ({ ...PERFECT_MENTOR, id: `m${i}` }));
    assert.equal(suggestMentors(MENTEE, mentors, 2).length, 2);
    assert.equal(suggestMentors(MENTEE, mentors, 0).length, 1);
  });

  test("liste de mentors vide → []", () => {
    assert.deepEqual(suggestMentors(MENTEE, []), []);
  });
});