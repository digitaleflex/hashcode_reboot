/**
 * Unit tests — moteur de progression ATELIERS (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/workshop-progression.test.cjs
 *
 * Ce fichier IMPORTE la vraie source src/lib/workshop-progression.ts (plus
 * aucun miroir réimplémenté) : les assertions portent sur le code exécuté
 * en production, donc un bug dans workshop-progression.ts fait échouer ce
 * test au lieu de passer au vert.
 *
 * Coverage:
 *  - session state: no-ghost-conditions (no deliverable/quiz → COMPLETED),
 *    submission lifecycle (PENDING/IN_REVIEW/REVISION/REJECTED/APPROVED),
 *    review-overrides-status, quiz-only sessions, approved+quiz pending
 *  - unlock chain: sequential (N unlocked iff N-1 COMPLETED), lock prime
 *  - unlock override: ne fabrique jamais un COMPLETED
 *  - date gate: futur verrouillé, précision à la milliseconde
 *  - summary: percent, next index, isComplete
 *  - helpers: pickLatestSubmission (attempt max), deriveQuizState
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Vraie source (require TypeScript via tsx) ───────────────────────────────

const {
  SESSION_STATES,
  applyDateGate,
  applyUnlockChain,
  applyUnlockOverride,
  computeSessionState,
  deriveQuizState,
  pickLatestSubmission,
  summarizeWorkshop,
} = require("../src/lib/workshop-progression.ts");

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

describe("SESSION_STATES — contrat fermé", () => {
  test("les 8 états pédagogiques déclarés", () => {
    // La liste est la source de vérité du client et de la sérialisation :
    // une dérive ici se propagerait à toute l'UI.
    assert.deepEqual(
      [...SESSION_STATES],
      [
        "LOCKED",
        "NOT_STARTED",
        "IN_PROGRESS",
        "SUBMITTED",
        "IN_REVIEW",
        "REVISION",
        "REJECTED",
        "COMPLETED",
      ],
    );
  });
});

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

  test("review APPROVED prime sur une soumission PENDING → COMPLETED", () => {
    const s = computeSessionState(
      deliverableSession({
        latestSubmissionStatus: "PENDING",
        latestReviewDecision: "APPROVED",
      }),
    );
    assert.equal(s, "COMPLETED");
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

  test("jamais LOCKED : le verrou est l'affaire de applyUnlockChain", () => {
    // Contrat documenté : une séance ne peut pas se verrouiller elle-même.
    const statuses = [null, "PENDING", "IN_REVIEW", "REVISION", "REJECTED", "APPROVED"];
    const quizStates = ["NOT_STARTED", "PASSED", "FAILED"];
    for (const status of statuses) {
      for (const decision of statuses) {
        for (const quizState of quizStates) {
          for (const hasQuiz of [true, false]) {
            const s = computeSessionState(
              deliverableSession({
                latestSubmissionStatus: status,
                latestReviewDecision: decision,
                quizState,
                hasQuiz,
              }),
            );
            assert.notEqual(s, "LOCKED", `LOCKED retourné pour ${status}/${decision}`);
            assert.ok(SESSION_STATES.includes(s), `état hors union : ${s}`);
          }
        }
      }
    }
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

  test("la review d'un livrable inexistant est ignorée", () => {
    // hasDeliverable=false : pas de livrable effectif, donc pas de statut de
    // soumission à considérer — le quiz seul décide.
    const s = computeSessionState({
      ...quizOnly,
      latestReviewDecision: "REJECTED",
      quizState: "PASSED",
    });
    assert.equal(s, "COMPLETED");
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

  test("liste vide → liste vide", () => {
    assert.deepEqual(applyUnlockChain([]), []);
  });
});

describe("applyUnlockOverride (déblocage admin)", () => {
  test("override true → LOCKED devient NOT_STARTED (jamais COMPLETED)", () => {
    const out = applyUnlockOverride(["LOCKED", "NOT_STARTED"], [true, true]);
    assert.deepEqual(out, ["NOT_STARTED", "NOT_STARTED"]);
  });

  test("override false/null → état inchangé", () => {
    const out = applyUnlockOverride(["LOCKED", "NOT_STARTED"], [false, false]);
    assert.deepEqual(out, ["LOCKED", "NOT_STARTED"]);
  });

  test("l'override n'écrase jamais un état pédagogique calculé", () => {
    const out = applyUnlockOverride(
      ["COMPLETED", "SUBMITTED", "IN_PROGRESS"],
      [true, true, true],
    );
    assert.deepEqual(out, ["COMPLETED", "SUBMITTED", "IN_PROGRESS"]);
  });

  test("combiné chaîne + override : S02 ouverte même sans S01 complétée", () => {
    const chained = applyUnlockChain(["NOT_STARTED", "NOT_STARTED"]);
    assert.deepEqual(chained, ["NOT_STARTED", "LOCKED"]);
    const out = applyUnlockOverride(chained, [false, true]);
    assert.deepEqual(out, ["NOT_STARTED", "NOT_STARTED"]);
  });

  test("override plus court que la liste → pas de crash", () => {
    const out = applyUnlockOverride(["LOCKED", "LOCKED", "LOCKED"], [true]);
    assert.deepEqual(out, ["NOT_STARTED", "LOCKED", "LOCKED"]);
  });

  test("override prime aussi sur le gate calendaire", () => {
    // Ordre serveur (workshop-server.ts) : chaîne → date → override.
    const chained = applyUnlockChain(["NOT_STARTED"]);
    const dateGated = applyDateGate(
      chained,
      [new Date("2026-09-25T20:00:00.000Z")],
      new Date("2026-09-18T12:00:00.000Z"),
    );
    assert.deepEqual(dateGated, ["LOCKED"]);
    const out = applyUnlockOverride(dateGated, [true]);
    assert.deepEqual(out, ["NOT_STARTED"]);
  });
});

describe("applyDateGate (gate calendaire anti-livrables-en-avance)", () => {
  const NOW = new Date("2026-09-18T12:00:00.000Z");
  const PAST = new Date("2026-09-10T20:00:00.000Z");
  const FUTURE = new Date("2026-09-25T20:00:00.000Z");

  test("date future → LOCKED même si la chaîne l'avait débloquée", () => {
    const out = applyDateGate(["NOT_STARTED", "NOT_STARTED"], [null, FUTURE], NOW);
    assert.deepEqual(out, ["NOT_STARTED", "LOCKED"]);
  });

  test("date passée ou absente → état conservé", () => {
    const out = applyDateGate(
      ["COMPLETED", "NOT_STARTED", "IN_PROGRESS"],
      [PAST, null, PAST],
      NOW,
    );
    assert.deepEqual(out, ["COMPLETED", "NOT_STARTED", "IN_PROGRESS"]);
  });

  test("déjà LOCKED par la chaîne → reste LOCKED (pas de réouverture)", () => {
    const out = applyDateGate(["LOCKED", "LOCKED"], [null, null], NOW);
    assert.deepEqual(out, ["LOCKED", "LOCKED"]);
  });

  test("précision minute : 20h00 reste verrouillée à 19h59, ouverte à 20h00", () => {
    const at = new Date("2026-09-18T20:00:00.000Z");
    assert.deepEqual(
      applyDateGate(["NOT_STARTED"], [at], new Date("2026-09-18T19:59:00.000Z")),
      ["LOCKED"],
    );
    assert.deepEqual(
      applyDateGate(["NOT_STARTED"], [at], new Date("2026-09-18T20:00:00.000Z")),
      ["NOT_STARTED"],
    );
  });

  test("combiné chaîne + date : S02 complétée mais S03 future → S03 LOCKED", () => {
    const chained = applyUnlockChain(["COMPLETED", "NOT_STARTED", "NOT_STARTED"]);
    assert.deepEqual(chained, ["COMPLETED", "NOT_STARTED", "LOCKED"]);
    const gated = applyDateGate(chained, [null, null, FUTURE], NOW);
    assert.deepEqual(gated, ["COMPLETED", "NOT_STARTED", "LOCKED"]);
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

  test("nextSessionIndex saute une séance LOCKED après une complétée", () => {
    // La progression ne doit jamais pointer une séance encore verrouillée.
    const s = summarizeWorkshop(["COMPLETED", "LOCKED", "NOT_STARTED"]);
    assert.equal(s.nextSessionIndex, 2);
    assert.equal(s.isComplete, false);
  });

  test("percent arrondi à l'entier inférieur", () => {
    const s = summarizeWorkshop(["COMPLETED", "COMPLETED", "NOT_STARTED"]);
    assert.equal(s.percent, 66);
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

  test("pickLatestSubmission : une seule soumission → elle-même", () => {
    const only = { attempt: 1, status: "PENDING" };
    assert.equal(pickLatestSubmission([only]), only);
  });

  test("deriveQuizState : PASSED dès qu'une tentative passe", () => {
    assert.equal(deriveQuizState([]), "NOT_STARTED");
    assert.equal(deriveQuizState([{ passed: false }]), "FAILED");
    assert.equal(deriveQuizState([{ passed: false }, { passed: true }]), "PASSED");
  });
});
