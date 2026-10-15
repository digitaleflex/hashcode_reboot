/**
 * Moteur de progression missions (#232-b) — transitions et progression.
 * Pur, sans DB. Run: tsx --test tests/missions-engine.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ASSIGNMENT_STATUSES,
  SUBMISSION_STATUSES,
  REVIEW_DECISIONS,
  assignmentStatusSchema,
  submissionStatusSchema,
  reviewDecisionSchema,
  missionStatusSchema,
  type AssignmentStatus,
  type MissionStatus,
  type SubmissionStatus,
} from "../src/lib/missions/types";
import {
  applyReview,
  canTransitionAssignment,
  canTransitionMission,
  canTransitionSubmission,
  deriveProgress,
  isTerminalAssignmentStatus,
  isTerminalSubmissionStatus,
  nextAttempt,
} from "../src/lib/missions/engine";

describe("unions : statuts fermés, jamais d'enum Prisma", () => {  test("schémas Zod rejettent l'inconnu", () => {
    assert.ok(!assignmentStatusSchema.safeParse("DONE").success);
    assert.ok(!submissionStatusSchema.safeParse("DONE").success);
    assert.ok(!reviewDecisionSchema.safeParse("MAYBE").success);
    assert.ok(!missionStatusSchema.safeParse("LIVE").success);
    assert.ok(assignmentStatusSchema.safeParse("ACTIVE").success);
  });
});

describe("assignations : graphe de transitions", () => {
  const valid: Array<[AssignmentStatus, AssignmentStatus]> = [
    ["UPCOMING", "ACTIVE"],
    ["UPCOMING", "ABANDONED"],
    ["ACTIVE", "SUBMITTED"],
    ["ACTIVE", "ABANDONED"],
    ["SUBMITTED", "VALIDATED"],
    ["SUBMITTED", "REJECTED"],
    ["SUBMITTED", "ACTIVE"],
    ["REJECTED", "SUBMITTED"],
    ["REJECTED", "ABANDONED"],
  ];
  for (const [from, to] of valid) {
    test(`${from} → ${to} autorisé`, () => {
      assert.equal(canTransitionAssignment(from, to), true);
    });
  }

  const invalid: Array<[AssignmentStatus, AssignmentStatus]> = [
    ["ACTIVE", "VALIDATED"],
    ["ACTIVE", "REJECTED"],
    ["UPCOMING", "SUBMITTED"],
    ["UPCOMING", "VALIDATED"],
    ["SUBMITTED", "ABANDONED"],
    ["SUBMITTED", "UPCOMING"],
    ["REJECTED", "VALIDATED"],
    ["REJECTED", "ACTIVE"],
    ["VALIDATED", "ACTIVE"],
    ["VALIDATED", "SUBMITTED"],
    ["ABANDONED", "ACTIVE"],
    ["ABANDONED", "SUBMITTED"],
  ];
  for (const [from, to] of invalid) {
    test(`${from} → ${to} refusé`, () => {
      assert.equal(canTransitionAssignment(from, to), false);
    });
  }

  test("terminaux : VALIDATED et ABANDONED sans sortie, les autres reliés", () => {
    assert.equal(isTerminalAssignmentStatus("VALIDATED"), true);
    assert.equal(isTerminalAssignmentStatus("ABANDONED"), true);
    for (const s of ASSIGNMENT_STATUSES) {
      const targets = ASSIGNMENT_STATUSES.filter((t) => canTransitionAssignment(s, t));
      if (s === "VALIDATED" || s === "ABANDONED") {
        assert.deepEqual(targets, [], `${s} terminal`);
      } else {
        assert.ok(targets.length > 0, `${s} a au moins une sortie`);
      }
    }
  });
});

describe("soumissions : graphe de transitions", () => {
  test("PENDING → revue ou décision directe", () => {
    for (const to of ["IN_REVIEW", "APPROVED", "REVISION", "REJECTED"] as SubmissionStatus[]) {
      assert.equal(canTransitionSubmission("PENDING", to), true);
    }
  });

  test("IN_REVIEW → décisions finales", () => {
    for (const to of ["APPROVED", "REVISION", "REJECTED"] as SubmissionStatus[]) {
      assert.equal(canTransitionSubmission("IN_REVIEW", to), true);
    }
    assert.equal(canTransitionSubmission("IN_REVIEW", "PENDING"), false);
  });

  test("APPROVED/REVISION/REJECTED terminaux (resoumettre = nouvel attempt)", () => {
    for (const s of ["APPROVED", "REVISION", "REJECTED"] as SubmissionStatus[]) {
      assert.equal(isTerminalSubmissionStatus(s), true);
      for (const t of SUBMISSION_STATUSES) {
        assert.equal(canTransitionSubmission(s, t), false);
      }
    }
    assert.equal(isTerminalSubmissionStatus("PENDING"), false);
  });

  test("nextAttempt : 1 si vide, sinon max+1 (idempotent)", () => {
    assert.equal(nextAttempt([]), 1);
    assert.equal(nextAttempt([1]), 2);
    assert.equal(nextAttempt([1, 2, 2]), 3);
    assert.equal(nextAttempt([3, 1]), 4);
  });
});

describe("applyReview : idempotent, sans effet de bord", () => {
  test("chaque décision mappe soumission + assignation", () => {
    assert.deepEqual(applyReview("IN_REVIEW", "APPROVED"), {
      submissionStatus: "APPROVED",
      assignmentStatus: "VALIDATED",
      validated: true,
    });
    assert.deepEqual(applyReview("PENDING", "REVISION"), {
      submissionStatus: "REVISION",
      assignmentStatus: "ACTIVE",
      validated: false,
    });
    assert.deepEqual(applyReview("IN_REVIEW", "REJECTED"), {
      submissionStatus: "REJECTED",
      assignmentStatus: "REJECTED",
      validated: false,
    });
  });

  test("rejouer la même décision rend le même état", () => {
    for (const d of REVIEW_DECISIONS) {
      const once = applyReview("PENDING", d);
      const twice = applyReview(once.submissionStatus, d);
      assert.deepEqual(twice, once, `idempotence ${d}`);
    }
  });
});

describe("mission éditoriale : DRAFT → PUBLISHED → ARCHIVED", () => {
  test("publier, dépublier, archiver, republication", () => {
    assert.equal(canTransitionMission("DRAFT", "PUBLISHED"), true);
    assert.equal(canTransitionMission("PUBLISHED", "ARCHIVED"), true);
    assert.equal(canTransitionMission("PUBLISHED", "DRAFT"), true);
    assert.equal(canTransitionMission("ARCHIVED", "PUBLISHED"), true);
  });

  test("refusés : archiver un brouillon, toucher un archivé autrement", () => {
    const bad: Array<[MissionStatus, MissionStatus]> = [
      ["DRAFT", "ARCHIVED"],
      ["DRAFT", "DRAFT"],
      ["ARCHIVED", "DRAFT"],
      ["ARCHIVED", "ARCHIVED"],
      ["PUBLISHED", "PUBLISHED"],
    ];
    for (const [from, to] of bad) {
      assert.equal(canTransitionMission(from, to), false, `${from} → ${to}`);
    }
  });
});

describe("deriveProgress : progression requêtable", () => {
  test("vide → zéros, taux 0", () => {
    const p = deriveProgress([]);
    assert.deepEqual(p.validatedMissionIds, []);
    assert.equal(p.started, 0);
    assert.equal(p.completionRate, 0);
  });

  test("comptes par statut, validées uniques, taux", () => {
    const p = deriveProgress([
      { missionId: "m1", status: "VALIDATED" },
      { missionId: "m1", status: "VALIDATED" },
      { missionId: "m2", status: "ACTIVE" },
      { missionId: "m3", status: "SUBMITTED" },
      { missionId: "m4", status: "REJECTED" },
      { missionId: "m5", status: "ABANDONED" },
      { missionId: "m6", status: "UPCOMING" },
    ]);
    assert.equal(p.started, 6);
    assert.equal(p.validated, 2);
    assert.equal(p.upcoming, 1);
    assert.deepEqual(p.validatedMissionIds, ["m1"]);
    assert.equal(p.completionRate, 2 / 6);
  });
});
