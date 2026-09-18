/**
 * Unit tests — moteur de progression ATELIERS (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/workshop-progression.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - computeSessionState / applyUnlockChain / summarizeWorkshop /
 *    pickLatestSubmission / deriveQuizState
 *    from src/lib/workshop-progression.ts
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - session state: no-ghost-conditions (no deliverable/quiz → COMPLETED),
 *    submission lifecycle (PENDING/IN_REVIEW/REVISION/REJECTED/APPROVED),
 *    review-overrides-status, quiz-only sessions, approved+quiz pending
 *  - unlock chain: sequential (N unlocked iff N-1 COMPLETED), lock prime
 *  - summary: percent, next index, isComplete
 *  - helpers: pickLatestSubmission (attempt max), deriveQuizState
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/workshop-progression.ts ──

function computeSessionState(input) {
  const deliverableEffective = input.hasDeliverable && input.deliverableRequired;
  const quizEffective = input.hasQuiz && input.quizRequired;

  if (!deliverableEffective && !quizEffective) return "COMPLETED";

  const deliverableStatus =
    input.latestReviewDecision ?? input.latestSubmissionStatus ?? null;

  if (deliverableEffective) {
    switch (deliverableStatus) {
      case "APPROVED":
        return quizEffective && input.quizState !== "PASSED" ? "IN_PROGRESS" : "COMPLETED";
      case "IN_REVIEW":
        return "IN_REVIEW";
      case "REVISION":
        return "REVISION";
      case "REJECTED":
        return "REJECTED";
      case "PENDING":
        return "SUBMITTED";
      default:
        if (quizEffective && input.quizState === "PASSED") return "IN_PROGRESS";
        if (quizEffective && input.quizState === "FAILED") return "IN_PROGRESS";
        return "NOT_STARTED";
    }
  }

  if (quizEffective) {
    if (input.quizState === "PASSED") return "COMPLETED";
    if (input.quizState === "FAILED") return "IN_PROGRESS";
    return "NOT_STARTED";
  }

  return "COMPLETED";
}

function applyUnlockChain(states) {
  const out = [];
  for (let i = 0; i < states.length; i++) {
    const previousCompleted = i === 0 || out[i - 1] === "COMPLETED";
    out.push(previousCompleted ? states[i] : "LOCKED");
  }
  return out;
}

function summarizeWorkshop(states) {
  const total = states.length;
  const completed = states.filter((s) => s === "COMPLETED").length;
  const nextSessionIndex = states.findIndex((s) => s !== "COMPLETED" && s !== "LOCKED");
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.floor((completed / total) * 100),
    nextSessionIndex: nextSessionIndex === -1 ? null : nextSessionIndex,
    isComplete: total > 0 && completed === total,
  };
}

function pickLatestSubmission(submissions) {
  if (submissions.length === 0) return null;
  return submissions.reduce((a, b) => (b.attempt > a.attempt ? b : a));
}

function deriveQuizState(attempts) {
  if (attempts.length === 0) return "NOT_STARTED";
  return attempts.some((a) => a.passed) ? "PASSED" : "FAILED";
}

// ── Factories ──

/** Séance par défaut : livrable requis effectif, pas de quiz, rien soumis. */
function deliverableSession(overrides = {}) {
  return {
    hasDeliverable: true,
    deliverableRequired: true,
    hasQuiz: false,
    quizRequired: true,
    latestSubmissionStatus: null,
    latestReviewDecision: null,
    quizState: "NOT_STARTED",
    ...overrides,
  };
}

// ── Tests ──

describe("computeSessionState — condition fantôme interdite", () => {
  test("sans livrable ni quiz effectif → COMPLETED dès le déblocage", () => {
    const s = computeSessionState({
      hasDeliverable: false,
      deliverableRequired: true, // flag true mais AUCUN livrable : jamais fantôme
      hasQuiz: false,
      quizRequired: true,
      latestSubmissionStatus: null,
      latestReviewDecision: null,
      quizState: "NOT_STARTED",
    });
    assert.equal(s, "COMPLETED");
  });

  test("livrable existant mais requis=false → complétée sans soumission", () => {
    const s = computeSessionState(deliverableSession({ deliverableRequired: false }));
    assert.equal(s, "COMPLETED");
  });

  test("livrable requis existant → NOT_STARTED sans soumission", () => {
    assert.equal(computeSessionState(deliverableSession()), "NOT_STARTED");
  });
});

describe("computeSessionState — cycle de soumission", () => {
  test("PENDING → SUBMITTED", () => {
    assert.equal(
      computeSessionState(deliverableSession({ latestSubmissionStatus: "PENDING" })),
      "SUBMITTED",
    );
  });

  test("IN_REVIEW → IN_REVIEW", () => {
    assert.equal(
      computeSessionState(deliverableSession({ latestSubmissionStatus: "IN_REVIEW" })),
      "IN_REVIEW",
    );
  });

  test("REVISION → REVISION (correction demandée)", () => {
    assert.equal(
      computeSessionState(deliverableSession({ latestSubmissionStatus: "REVISION" })),
      "REVISION",
    );
  });

  test("REJECTED → REJECTED", () => {
    assert.equal(
      computeSessionState(deliverableSession({ latestSubmissionStatus: "REJECTED" })),
      "REJECTED",
    );
  });

  test("APPROVED sans quiz effectif → COMPLETED", () => {
    assert.equal(
      computeSessionState(deliverableSession({ latestSubmissionStatus: "APPROVED" })),
      "COMPLETED",
    );
  });

  test("APPROVED + quiz requis non passé → IN_PROGRESS (reste le quiz)", () => {
    const s = computeSessionState(
      deliverableSession({
        latestSubmissionStatus: "APPROVED",
        hasQuiz: true,
        quizRequired: true,
        quizState: "FAILED",
      }),
    );
    assert.equal(s, "IN_PROGRESS");
  });

  test("APPROVED + quiz passé → COMPLETED", () => {
    const s = computeSessionState(
      deliverableSession({
        latestSubmissionStatus: "APPROVED",
        hasQuiz: true,
        quizRequired: true,
        quizState: "PASSED",
      }),
    );
    assert.equal(s, "COMPLETED");
  });

  test("la REVIEW rendue fait foi sur le statut de la soumission", () => {
    // Soumission PENDING mais review REVISION rendue → REVISION.
    const s = computeSessionState(
      deliverableSession({
        latestSubmissionStatus: "PENDING",
        latestReviewDecision: "REVISION",
      }),
    );
    assert.equal(s, "REVISION");
  });

  test("resoumission (nouvelle PENDING après REVISION) → SUBMITTED", () => {
    // Nouvelle soumission : latestSubmissionStatus repasse à PENDING,
    // la review REVISION est attachée à l'ancienne soumission → null ici.
    const s = computeSessionState(
      deliverableSession({
        latestSubmissionStatus: "PENDING",
        latestReviewDecision: null,
      }),
    );
    assert.equal(s, "SUBMITTED");
  });

  test("quiz tenté sans soumission → IN_PROGRESS (pas NOT_STARTED)", () => {
    const s = computeSessionState(
      deliverableSession({
        hasQuiz: true,
        quizRequired: true,
        quizState: "FAILED",
      }),
    );
    assert.equal(s, "IN_PROGRESS");
  });
});

describe("computeSessionState — quiz seul", () => {
  const quizOnly = {
    hasDeliverable: false,
    deliverableRequired: true,
    hasQuiz: true,
    quizRequired: true,
    latestSubmissionStatus: null,
    latestReviewDecision: null,
  };

  test("quiz pas commencé → NOT_STARTED", () => {
    assert.equal(computeSessionState({ ...quizOnly, quizState: "NOT_STARTED" }), "NOT_STARTED");
  });

  test("quiz raté → IN_PROGRESS", () => {
    assert.equal(computeSessionState({ ...quizOnly, quizState: "FAILED" }), "IN_PROGRESS");
  });

  test("quiz passé → COMPLETED", () => {
    assert.equal(computeSessionState({ ...quizOnly, quizState: "PASSED" }), "COMPLETED");
  });
});

describe("applyUnlockChain", () => {
  test("la première séance est toujours débloquée", () => {
    const out = applyUnlockChain(["SUBMITTED", "LOCKED", "LOCKED"]);
    assert.deepEqual(out, ["SUBMITTED", "LOCKED", "LOCKED"]);
  });

  test("S01 COMPLETED → S02 débloquée, S03 verrouillée", () => {
    const out = applyUnlockChain(["COMPLETED", "NOT_STARTED", "NOT_STARTED"]);
    assert.deepEqual(out, ["COMPLETED", "NOT_STARTED", "LOCKED"]);
  });

  test("chaîne complète : chaque COMPLETED débloque la suivante", () => {
    const out = applyUnlockChain(["COMPLETED", "COMPLETED", "IN_PROGRESS", "NOT_STARTED"]);
    assert.deepEqual(out, ["COMPLETED", "COMPLETED", "IN_PROGRESS", "LOCKED"]);
  });

  test("le verrou ÉCRASE un état calculé d'une séance non débloquée", () => {
    // Données résiduelles (soumission importée) sur S02 alors que S01 n'est
    // pas complétée : le verrou serveur prime.
    const out = applyUnlockChain(["SUBMITTED", "SUBMITTED"]);
    assert.deepEqual(out, ["SUBMITTED", "LOCKED"]);
  });
});

describe("summarizeWorkshop", () => {
  test("compteurs, pourcentage et prochaine séance", () => {
    const s = summarizeWorkshop(["COMPLETED", "COMPLETED", "SUBMITTED", "NOT_STARTED", "LOCKED"]);
    assert.equal(s.total, 5);
    assert.equal(s.completed, 2);
    assert.equal(s.percent, 40);
    assert.equal(s.nextSessionIndex, 2);
    assert.equal(s.isComplete, false);
  });

  test("parcours terminé", () => {
    const s = summarizeWorkshop(["COMPLETED", "COMPLETED", "COMPLETED"]);
    assert.equal(s.isComplete, true);
    assert.equal(s.nextSessionIndex, null);
    assert.equal(s.percent, 100);
  });

  test("parcours vide → 0%", () => {
    const s = summarizeWorkshop([]);
    assert.equal(s.percent, 0);
    assert.equal(s.isComplete, false);
  });
});

describe("pickLatestSubmission / deriveQuizState", () => {
  test("pickLatestSubmission : attempt max fait foi, ordre d'entrée ignoré", () => {
    const latest = pickLatestSubmission([
      { attempt: 1, status: "REVISION" },
      { attempt: 3, status: "PENDING" },
      { attempt: 2, status: "APPROVED" },
    ]);
    assert.equal(latest.attempt, 3);
    assert.equal(latest.status, "PENDING");
  });

  test("pickLatestSubmission : vide → null", () => {
    assert.equal(pickLatestSubmission([]), null);
  });

  test("deriveQuizState : PASSED dès qu'une tentative passe", () => {
    assert.equal(deriveQuizState([]), "NOT_STARTED");
    assert.equal(deriveQuizState([{ passed: false }]), "FAILED");
    assert.equal(deriveQuizState([{ passed: false }, { passed: true }]), "PASSED");
  });
});
