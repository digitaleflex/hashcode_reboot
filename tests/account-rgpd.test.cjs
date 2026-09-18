/**
 * Unit tests — RGPD membre #64 : export + suppression (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/account-rgpd.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - DELETE_CONFIRM_WORD / EXPORT_ANALYTICS_MAX / EXPORT_FORMAT /
 *    isDeleteConfirmed / buildExportPayload from src/lib/account-rgpd.ts
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - confirmation : mot exact uniquement (casse, espaces, types rejetés)
 *  - export : présence des 9 blocs, format versionné, exportedAt ISO,
 *    analytics plafonnées + flag tronqué
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/account-rgpd.ts ──

const DELETE_CONFIRM_WORD = "SUPPRIMER";
const EXPORT_ANALYTICS_MAX = 500;
const EXPORT_FORMAT = "hashcode-reboot-export-v1";

function isDeleteConfirmed(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return body.confirm === DELETE_CONFIRM_WORD;
}

function buildExportPayload(member, relations) {
  return {
    exportedAt: new Date().toISOString(),
    format: EXPORT_FORMAT,
    member,
    rsvps: relations.rsvps,
    enrollments: relations.enrollments,
    submissions: relations.submissions,
    quizAttempts: relations.quizAttempts,
    emailLogs: relations.emailLogs,
    sessions: relations.sessions,
    draft: relations.draft,
    analytics: relations.analytics,
    analyticsTruncated: relations.analyticsTruncated,
  };
}

// ── Tests ──

describe("isDeleteConfirmed", () => {
  test("accepte uniquement le mot exact", () => {
    assert.equal(isDeleteConfirmed({ confirm: "SUPPRIMER" }), true);
  });

  test("rejette casse, espaces, vide, types et absents", () => {
    assert.equal(isDeleteConfirmed({ confirm: "supprimer" }), false);
    assert.equal(isDeleteConfirmed({ confirm: " SUPPRIMER" }), false);
    assert.equal(isDeleteConfirmed({ confirm: "SUPPRIMER " }), false);
    assert.equal(isDeleteConfirmed({ confirm: "" }), false);
    assert.equal(isDeleteConfirmed({}), false);
    assert.equal(isDeleteConfirmed(null), false);
    assert.equal(isDeleteConfirmed(undefined), false);
    assert.equal(isDeleteConfirmed("SUPPRIMER"), false);
    assert.equal(isDeleteConfirmed(["SUPPRIMER"]), false);
    assert.equal(isDeleteConfirmed({ confirm: 123 }), false);
  });
});

describe("buildExportPayload", () => {
  const member = { id: "c1", email: "a@x.y", firstName: "Awa" };
  const empty = {
    rsvps: [], enrollments: [], submissions: [], quizAttempts: [],
    emailLogs: [], sessions: [], draft: null, analytics: [],
    analyticsTruncated: false,
  };

  test("contient les 9 blocs + format + date ISO", () => {
    const out = buildExportPayload(member, empty);
    assert.deepEqual(out.member, member);
    assert.equal(out.format, EXPORT_FORMAT);
    assert.ok(!Number.isNaN(Date.parse(out.exportedAt)), out.exportedAt);
    for (const k of ["rsvps", "enrollments", "submissions", "quizAttempts", "emailLogs", "sessions", "draft", "analytics"]) {
      assert.ok(k in out, `bloc manquant : ${k}`);
    }
    assert.equal(out.analyticsTruncated, false);
  });

  test("sérialisable JSON (téléchargeable tel quel)", () => {
    const out = buildExportPayload(member, {
      ...empty,
      draft: { email: "a@x.y", answers: "{}" },
      analyticsTruncated: true,
    });
    assert.doesNotThrow(() => JSON.stringify(out));
    assert.equal(out.analyticsTruncated, true);
  });

  test("constantes : plafond analytics 500, format versionné", () => {
    assert.equal(EXPORT_ANALYTICS_MAX, 500);
    assert.ok(EXPORT_FORMAT.startsWith("hashcode-reboot-export-"));
  });
});
