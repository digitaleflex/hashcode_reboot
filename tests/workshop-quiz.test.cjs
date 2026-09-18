/**
 * Unit tests — scoring serveur des quiz ATELIERS (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/workshop-quiz.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - publicQuestions / scoreAttempt / canAttempt
 *    from src/lib/workshop-quiz.ts
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - NON-FUITE : publicQuestions() n'expose JAMAIS correctJson (test
 *    d'absence de clé) — garde-fou fondamental du protocole §17
 *  - scoring : single, multiple (match exact, ordre insensible,
 *    choix partiel = faux), true_false
 *  - barème : points, total, percent floor, seuil atteint pile → passed
 *  - garde-fous : longueur désalignée → null, seuil invalide → null,
 *    correctJson corrompu → null, quiz sans question → null
 *  - canAttempt : null = illimité, borne stricte
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/workshop-quiz.ts ──

function publicQuestions(questions) {
  return questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      let options = [];
      try {
        const parsed = JSON.parse(q.optionsJson);
        if (Array.isArray(parsed)) options = parsed.map((o) => String(o));
      } catch {
        options = [];
      }
      return {
        id: q.id,
        order: q.order,
        type: q.type,
        prompt: q.prompt,
        options,
        points: q.points,
      };
    });
}

function parseCorrect(type, correctJson) {
  try {
    const parsed = JSON.parse(correctJson);
    if (type === "multiple") {
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((c) => Number.isInteger(c) && c >= 0)) {
        return [...parsed].sort((a, b) => a - b);
      }
      return null;
    }
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

function answerToSet(answer) {
  if (typeof answer === "number") {
    if (!Number.isInteger(answer) || answer < 0) return null;
    return [answer];
  }
  if (Array.isArray(answer)) {
    const idx = answer.map((c) => Number(c));
    if (idx.some((c) => !Number.isInteger(c) || c < 0)) return null;
    return [...idx].sort((a, b) => a - b);
  }
  return null;
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function scoreAttempt(questions, answers, passThreshold) {
  if (questions.length === 0) return null;
  if (!Array.isArray(answers) || answers.length !== questions.length) return null;
  if (!Number.isInteger(passThreshold) || passThreshold < 0 || passThreshold > 100) return null;

  const ordered = questions.slice().sort((a, b) => a.order - b.order);

  const perQuestion = [];
  let score = 0;
  let total = 0;

  for (let i = 0; i < ordered.length; i++) {
    const q = ordered[i];
    const correctIndices = parseCorrect(q.type, q.correctJson);
    if (correctIndices === null) return null;
    total += q.points;

    const correctSet = answerToSet(correctIndices);
    const userSet = answerToSet(answers[i]);
    if (userSet === null) return null;

    const correct = correctSet !== null && sameSet(correctSet, userSet);

    perQuestion.push({
      questionId: q.id,
      type: q.type,
      correct,
      pointsEarned: correct ? q.points : 0,
    });
    if (correct) score += q.points;
  }

  const percent = total > 0 ? Math.floor((score / total) * 100) : 0;
  return { score, total, percent, passed: percent >= passThreshold, perQuestion };
}

function canAttempt(maxAttempts, attemptsCount) {
  if (maxAttempts === null) return true;
  return attemptsCount < maxAttempts;
}

// ── Fixtures ──

const Q1 = {
  id: "q1",
  order: 0,
  type: "single",
  prompt: "Que fait git commit ?",
  optionsJson: '["Enregistre localement", "Pousse vers GitHub"]',
  correctJson: "0",
  points: 2,
};

const Q2 = {
  id: "q2",
  order: 1,
  type: "true_false",
  prompt: "git push est une opération locale ?",
  optionsJson: '["Vrai", "Faux"]',
  correctJson: "1",
  points: 1,
};

const Q3 = {
  id: "q3",
  order: 2,
  type: "multiple",
  prompt: "Quelles commandes créent un commit ?",
  optionsJson: '["git commit", "git merge --no-ff", "git status"]',
  correctJson: "[0,1]",
  points: 2,
};

// ── Tests ──

describe("publicQuestions — non-fuite des réponses", () => {
  test("aucune clé correctJson n'est exposée, options dé-JSON-ifiées", () => {
    const pub = publicQuestions([Q1, Q2, Q3]);
    for (const q of pub) {
      assert.equal("correctJson" in q, false, `correctJson exposé pour ${q.id}`);
      assert.equal("correct" in q, false);
      assert.ok(Array.isArray(q.options));
    }
    assert.deepEqual(pub[0].options, ["Enregistre localement", "Pousse vers GitHub"]);
  });

  test("questions triées par order", () => {
    const pub = publicQuestions([Q2, Q1]);
    assert.equal(pub[0].id, "q1");
    assert.equal(pub[1].id, "q2");
  });

  test("optionsJson corrompu → options vides (jamais de crash)", () => {
    const pub = publicQuestions([{ ...Q1, optionsJson: "not-json" }]);
    assert.deepEqual(pub[0].options, []);
  });
});

describe("scoreAttempt — barème", () => {
  test("tout juste → score = total, passed au seuil", () => {
    const r = scoreAttempt([Q1, Q2, Q3], [0, 1, [1, 0]], 80);
    assert.equal(r.score, 5);
    assert.equal(r.total, 5);
    assert.equal(r.percent, 100);
    assert.equal(r.passed, true);
  });

  test("match multiple insensible à l'ordre", () => {
    const r = scoreAttempt([Q3], [[0, 1]], 70);
    assert.equal(r.score, 2);
    assert.equal(r.passed, true);
  });

  test("choix partiel multiple = faux (all-or-nothing)", () => {
    const r = scoreAttempt([Q3], [[0]], 70);
    assert.equal(r.score, 0);
    assert.equal(r.percent, 0);
    assert.equal(r.passed, false);
    assert.equal(r.perQuestion[0].correct, false);
  });

  test("exactement au seuil → passed", () => {
    // Q1 seule : 2 points, 2/2 = 100 ≥ 100
    const r = scoreAttempt([Q1], [0], 100);
    assert.equal(r.passed, true);
    // 2 points sur 3 avec seuil 50 → 66 ≥ 50 → passed
    const r2 = scoreAttempt([Q1, Q2], [0, 0], 50);
    assert.equal(r2.percent, 66);
    assert.equal(r2.passed, true);
  });

  test("sous le seuil → pas passed", () => {
    const r = scoreAttempt([Q1, Q2], [0, 0], 100);
    assert.equal(r.percent, 66);
    assert.equal(r.passed, false);
  });

  test("order des réponses suit l'order des questions (pas l'ordre d'entrée)", () => {
    // Questions entrées [Q2, Q1] → triées [Q1 (correct 0), Q2 (correct 1)].
    // Réponses [0, 0] → Q1 correcte, Q2 incorrecte.
    const r = scoreAttempt([Q2, Q1], [0, 0], 70);
    assert.equal(r.score, 2);
    assert.equal(r.perQuestion.find((p) => p.questionId === "q1").correct, true);
    assert.equal(r.perQuestion.find((p) => p.questionId === "q2").correct, false);
  });
});

describe("scoreAttempt — garde-fous", () => {
  test("longueur désalignée → null (jamais un score arbitraire)", () => {
    assert.equal(scoreAttempt([Q1, Q2], [0], 70), null);
    assert.equal(scoreAttempt([Q1], [0, 1], 70), null);
  });

  test("seuil invalide → null", () => {
    assert.equal(scoreAttempt([Q1], [0], 101), null);
    assert.equal(scoreAttempt([Q1], [0], -1), null);
  });

  test("quiz sans question → null", () => {
    assert.equal(scoreAttempt([], [], 70), null);
  });

  test("correctJson corrompu → null (pas de crash, pas de score)", () => {
    assert.equal(scoreAttempt([{ ...Q1, correctJson: "corrompu" }], [0], 70), null);
    assert.equal(scoreAttempt([{ ...Q3, correctJson: "[]" }], [[0]], 70), null);
  });

  test("réponse hors forme → null", () => {
    assert.equal(scoreAttempt([Q1], ["0"], 70), null);
    assert.equal(scoreAttempt([Q1], [-1], 70), null);
  });
});

describe("canAttempt — tentatives répétées (§17)", () => {
  test("maxAttempts null → illimité", () => {
    assert.equal(canAttempt(null, 0), true);
    assert.equal(canAttempt(null, 100), true);
  });

  test("borne stricte", () => {
    assert.equal(canAttempt(3, 0), true);
    assert.equal(canAttempt(3, 2), true);
    assert.equal(canAttempt(3, 3), false);
    assert.equal(canAttempt(1, 1), false);
  });
});
