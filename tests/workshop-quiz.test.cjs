/**
 * Unit tests — scoring serveur des quiz ATELIERS (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/workshop-quiz.test.cjs
 *
 * Ce fichier IMPORTE la vraie source src/lib/workshop-quiz.ts (plus aucun
 * miroir réimplémenté) : les assertions portent sur le code exécuté en
 * production, donc un bug dans workshop-quiz.ts fait échouer ce test au
 * lieu de passer au vert.
 *
 * Coverage:
 *  - NON-FUITE : publicQuestions() n'expose JAMAIS correctJson (test
 *    d'absence de clé) — garde-fou fondamental du protocole §17
 *  - scoring : single, multiple (match exact, ordre insensible,
 *    choix partiel = faux), true_false
 *  - barème : points, total, percent floor, seuil atteint pile → passed
 *  - garde-fous : longueur désalignée → null, seuil invalide → null,
 *    correctJson corrompu ou de mauvaise forme → null, quiz sans question
 *    → null
 *  - canAttempt : null = illimité, borne stricte
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Vraie source (require TypeScript via tsx) ───────────────────────────────

const { canAttempt, publicQuestions, scoreAttempt } = require("../src/lib/workshop-quiz.ts");

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

  test("la sortie ne contient aucune valeur de correctJson (anti-fuite en profondeur)", () => {
    // Au-delà de la simple absence de clé : aucune chaîne de la réponse
    // correcte ne doit apparaître dans la projection sérialisée.
    const pub = publicQuestions([{ ...Q1, correctJson: '"SECRET_ANSWER"' }]);
    assert.equal(JSON.stringify(pub).includes("SECRET_ANSWER"), false);
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

  test("optionsJson non-tableau (objet JSON) → options vides", () => {
    const pub = publicQuestions([{ ...Q1, optionsJson: '{"0":"a"}' }]);
    assert.deepEqual(pub[0].options, []);
  });

  test("les options sont normalisées en chaînes", () => {
    const pub = publicQuestions([{ ...Q1, optionsJson: "[1, true, null]" }]);
    assert.deepEqual(pub[0].options, ["1", "true", "null"]);
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

  test("trop de choix multiple = faux (ensemble non identique)", () => {
    const r = scoreAttempt([Q3], [[0, 1, 2]], 70);
    assert.equal(r.score, 0);
    assert.equal(r.passed, false);
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

  test("perQuestion suit l'ordre des questions triées, pas l'ordre d'entrée", () => {
    const r = scoreAttempt([Q2, Q1], [0, 0], 70);
    assert.deepEqual(r.perQuestion.map((p) => p.questionId), ["q1", "q2"]);
  });

  test("perQuestion : pointsEarned = points si correct, 0 sinon", () => {
    const r = scoreAttempt([Q1, Q2], [0, 0], 70);
    assert.deepEqual(
      r.perQuestion.map((p) => p.pointsEarned),
      [2, 0],
    );
    assert.deepEqual(r.perQuestion.map((p) => p.type), ["single", "true_false"]);
  });

  test("un quiz à 0 point ne vaut pas 100% (percent 0, pas de division par zéro)", () => {
    const r = scoreAttempt([{ ...Q1, points: 0 }], [0], 100);
    assert.equal(r.total, 0);
    assert.equal(r.percent, 0);
    assert.equal(r.passed, false);
  });

  test("indice de réponse hors options → compté faux, pas de crash", () => {
    // Une réponse forgée n'y gagne rien : l'ensemble ne correspond pas.
    const r = scoreAttempt([Q1], [99], 70);
    assert.equal(r.score, 0);
    assert.equal(r.perQuestion[0].correct, false);
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

  test("seuil non entier → null", () => {
    assert.equal(scoreAttempt([Q1], [0], 50.5), null);
  });

  test("seuil 0 et 100 acceptés aux bornes", () => {
    assert.notEqual(scoreAttempt([Q1], [0], 0), null);
    assert.notEqual(scoreAttempt([Q1], [0], 100), null);
  });

  test("quiz sans question → null", () => {
    assert.equal(scoreAttempt([], [], 70), null);
  });

  test("correctJson corrompu → null (pas de crash, pas de score)", () => {
    assert.equal(scoreAttempt([{ ...Q1, correctJson: "corrompu" }], [0], 70), null);
    assert.equal(scoreAttempt([{ ...Q3, correctJson: "[]" }], [[0]], 70), null);
  });

  test("correctJson de mauvaise forme → null (tableau sur single, négatif, null)", () => {
    assert.equal(scoreAttempt([{ ...Q1, correctJson: "[0]" }], [0], 70), null);
    assert.equal(scoreAttempt([{ ...Q1, correctJson: "-1" }], [0], 70), null);
    assert.equal(scoreAttempt([{ ...Q1, correctJson: "null" }], [0], 70), null);
  });

  test("une question corrompée annule TOUT le quiz (pas de score partiel)", () => {
    assert.equal(scoreAttempt([Q1, { ...Q2, correctJson: "nope" }], [0, 1], 70), null);
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
