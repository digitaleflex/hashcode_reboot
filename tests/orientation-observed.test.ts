/**
 * Tests — M5 boucle comportementale (toObservedSignals, pure).
 *
 * Teste le VRAI code TS via tsx. Le loader DB (`loadObservedSignals`)
 * n'est pas testé ici (adaptateur fin, I/O) — la normalisation pure
 * couvre la logique de la boucle OBSERVE → RE-SCORE.
 *
 * Run:  tsx --test tests/orientation-observed.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { toObservedSignals } from "../src/lib/orientation/observed";
import { isObservedEmpty } from "../src/lib/profiling/dynamicProfile";

describe("m5 — toObservedSignals", () => {
  test("entrée vide → signaux nuls + lastActivityAt null", () => {
    const s = toObservedSignals({
      workshopsStarted: 0,
      workshopsCompleted: 0,
      eventsJoined: 0,
      mentoringRequested: false,
      invitationClicks: 0,
      invitationAccepted: false,
      invitationSent: false,
      activityDates: [],
    });
    assert.deepEqual(s, {
      workshopsStarted: 0,
      workshopsCompleted: 0,
      eventsJoined: 0,
      mentoringRequested: false,
      recosAccepted: 0,
      recosIgnored: 0,
      lastActivityAt: null,
    });
    assert.ok(isObservedEmpty(s));
  });

  test("activité mixte → compteurs + dernière date (max)", () => {
    const s = toObservedSignals({
      workshopsStarted: 2,
      workshopsCompleted: 1,
      eventsJoined: 3,
      mentoringRequested: true,
      invitationClicks: 0,
      invitationAccepted: false,
      invitationSent: true,
      activityDates: [
        "2026-09-01T10:00:00.000Z",
        new Date("2026-10-01T10:00:00.000Z"),
        null,
        "not-a-date",
      ],
    });
    assert.equal(s.workshopsStarted, 2);
    assert.equal(s.eventsJoined, 3);
    assert.equal(s.lastActivityAt, "2026-10-01T10:00:00.000Z");
    assert.ok(!isObservedEmpty(s));
  });

  test("invitation acceptée → recosAccepted ≥ 1, jamais recosIgnored", () => {
    const s = toObservedSignals({
      workshopsStarted: 0,
      workshopsCompleted: 0,
      eventsJoined: 0,
      mentoringRequested: false,
      invitationClicks: 0,
      invitationAccepted: true,
      invitationSent: true,
      activityDates: [],
    });
    assert.ok(s.recosAccepted >= 1);
    assert.equal(s.recosIgnored, 0);
  });

  test("invitation envoyée sans clic ni acceptation → recosIgnored = 1", () => {
    const s = toObservedSignals({
      workshopsStarted: 0,
      workshopsCompleted: 0,
      eventsJoined: 0,
      mentoringRequested: false,
      invitationClicks: 0,
      invitationAccepted: false,
      invitationSent: true,
      activityDates: [],
    });
    assert.equal(s.recosAccepted, 0);
    assert.equal(s.recosIgnored, 1);
  });

  test("compteurs négatifs ou NaN → normalisés à 0", () => {
    const s = toObservedSignals({
      workshopsStarted: -5,
      workshopsCompleted: Number.NaN,
      eventsJoined: 2.9,
      mentoringRequested: false,
      invitationClicks: 0,
      invitationAccepted: false,
      invitationSent: false,
      activityDates: [],
    });
    assert.equal(s.workshopsStarted, 0);
    assert.equal(s.workshopsCompleted, 0);
    assert.equal(s.eventsJoined, 2);
  });

  test("déterministe : même entrée → même sortie", () => {
    const input = {
      workshopsStarted: 1,
      workshopsCompleted: 1,
      eventsJoined: 1,
      mentoringRequested: true,
      invitationClicks: 2,
      invitationAccepted: true,
      invitationSent: true,
      activityDates: ["2026-08-15T12:00:00.000Z"],
    };
    assert.deepEqual(toObservedSignals(input), toObservedSignals(input));
  });
});
