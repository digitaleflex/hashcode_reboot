/**
 * Unit tests — matching mentorat #61 (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/matching.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - parseSpecialties / scoreMatch / suggestMentors from src/lib/matching.ts
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - barème : +30 domaine, +20 spécialités, +20 fréquence, +10 pays,
 *    +20 budget concret, plafond 100
 *  - parse : tableau, JSON string, JSON corrompu, null
 *  - tri : score desc, puis charge asc, puis niveau
 *  - top 5 par défaut
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/matching.ts ──

function parseSpecialties(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const CONCRETE_BUDGETS = new Set([
  "<2500", "2500-5000", "5000-10000", "10000-20000", "20000-30000", ">30000",
]);

function scoreMatch(mentee, mentor) {
  let score = 0;
  const reasons = [];
  if (mentee.primaryDomain && mentor.primaryDomain && mentee.primaryDomain === mentor.primaryDomain) {
    score += 30; reasons.push("same-domain");
  }
  const menteeSpecs = new Set(parseSpecialties(mentee.domainSpecialty));
  const overlap = parseSpecialties(mentor.domainSpecialty).filter((s) => menteeSpecs.has(s));
  if (overlap.length > 0) { score += 20; reasons.push("specialty-overlap"); }
  if (mentee.mentoringFrequency && mentor.mentoringFrequency && mentee.mentoringFrequency === mentor.mentoringFrequency) {
    score += 20; reasons.push("same-frequency");
  }
  if (mentee.country && mentor.country && mentee.country === mentor.country) {
    score += 10; reasons.push("same-country");
  }
  if (mentee.budgetRange && CONCRETE_BUDGETS.has(mentee.budgetRange)) {
    score += 20; reasons.push("concrete-budget");
  }
  return { mentorId: mentor.id, score: Math.min(100, score), reasons };
}

const LEVEL_RANK = { advanced: 0, autonomous: 1, practicing: 2, beginner: 3 };

function suggestMentors(mentee, mentors, limit = 5) {
  return mentors
    .map((m) => ({ result: scoreMatch(mentee, m), mentor: m }))
    .sort((a, b) => {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score;
      if (a.mentor.activeMentees !== b.mentor.activeMentees) return a.mentor.activeMentees - b.mentor.activeMentees;
      const ra = LEVEL_RANK[a.mentor.level ?? ""] ?? 99;
      const rb = LEVEL_RANK[b.mentor.level ?? ""] ?? 99;
      return ra - rb;
    })
    .slice(0, Math.max(1, limit))
    .map((x) => x.result);
}

// ── Tests ──

const MENTEE = {
  primaryDomain: "cybersecurity",
  domainSpecialty: ["pentest", "osint"],
  mentoringFrequency: "weekly",
  country: "BJ",
  budgetRange: "20000-30000",
};

const PERFECT_MENTOR = {
  id: "m1", primaryDomain: "cybersecurity", domainSpecialty: ["pentest", "soc"],
  mentoringFrequency: "weekly", country: "BJ", level: "advanced", activeMentees: 0,
};

describe("parseSpecialties", () => {
  test("tableau, JSON string, corrompu, null", () => {
    assert.deepEqual(parseSpecialties(["a", "b"]), ["a", "b"]);
    assert.deepEqual(parseSpecialties('["a","b"]'), ["a", "b"]);
    assert.deepEqual(parseSpecialties("pas du json"), []);
    assert.deepEqual(parseSpecialties(null), []);
    assert.deepEqual(parseSpecialties(undefined), []);
    assert.deepEqual(parseSpecialties('{"a":1}'), []);
  });
});

describe("scoreMatch (barème spec)", () => {
  test("match parfait = 100 (30+20+20+10+20)", () => {
    const r = scoreMatch(MENTEE, PERFECT_MENTOR);
    assert.equal(r.score, 100);
    assert.deepEqual(r.reasons, ["same-domain", "specialty-overlap", "same-frequency", "same-country", "concrete-budget"]);
  });

  test("aucun point commun sauf budget concret = 20", () => {
    const r = scoreMatch(MENTEE, {
      id: "m2", primaryDomain: "web", domainSpecialty: ["react"],
      mentoringFrequency: "monthly", country: "FR", level: "beginner", activeMentees: 0,
    });
    assert.equal(r.score, 20);
    assert.deepEqual(r.reasons, ["concrete-budget"]);
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
      id: "m3", primaryDomain: null, domainSpecialty: null,
      mentoringFrequency: null, country: null, level: null, activeMentees: 0,
    });
    assert.equal(r.score, 20); // seul le budget du mentoré compte
  });
});

describe("suggestMentors", () => {
  test("tri score desc, top 5 par défaut", () => {
    const mentors = Array.from({ length: 7 }, (_, i) => ({
      id: `m${i}`, primaryDomain: i < 3 ? "cybersecurity" : "web",
      domainSpecialty: [], mentoringFrequency: null, country: null,
      level: "advanced", activeMentees: 0,
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
    assert.deepEqual(out.map((r) => r.mentorId), ["b", "c", "a"]);
  });
});
