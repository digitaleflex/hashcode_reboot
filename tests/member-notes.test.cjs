/**
 * Unit tests — notes datées des membres (#100).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/member-notes.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - noteSchema in src/app/api/members/[id]/notes/route.ts (POST) :
 *    content trim, min 1, max 2000.
 *  - memberId guard : cuid requis (membre existant, sinon 404).
 *  - GET ordering : createdAt desc.
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - validation: trim, vide rejeté, bornes 1/2000, pile 2000 ok, 2001 rejeté
 *  - memberId: cuid requis (vide / non-cuid rejeté)
 *  - tri: desc sur createdAt
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirror of noteSchema (src/app/api/members/[id]/notes/route.ts) ──

const NOTE_CONTENT_MAX = 2000;

function validateNoteContent(v) {
  if (typeof v !== "string") {
    return { ok: false, error: "Le contenu de la note est requis." };
  }
  const content = v.trim();
  if (content.length < 1) {
    return { ok: false, error: "Le contenu de la note est requis." };
  }
  if (content.length > NOTE_CONTENT_MAX) {
    return { ok: false, error: "Note trop longue (max 2000 caractères)." };
  }
  return { ok: true, content };
}

// ── Mirror of the memberId guard (cuid, sinon 404) ──

const CUID_RE = /^c[a-z0-9]{7,}$/i;

function isValidMemberId(v) {
  return typeof v === "string" && CUID_RE.test(v.trim());
}

// ── Mirror of GET ordering (createdAt desc) ──

function sortNotesDesc(notes) {
  return [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("validateNoteContent", () => {
  test("happy path — contenu conservé trimmé", () => {
    const r = validateNoteContent("  Suivi téléphonique OK  ");
    assert.deepEqual(r, { ok: true, content: "Suivi téléphonique OK" });
  });

  test("vide / espaces rejetés", () => {
    assert.equal(validateNoteContent("").ok, false);
    assert.equal(validateNoteContent("   ").ok, false);
    assert.equal(validateNoteContent("\n\t ").ok, false);
  });

  test("non-chaîne rejetée", () => {
    assert.equal(validateNoteContent(null).ok, false);
    assert.equal(validateNoteContent(undefined).ok, false);
    assert.equal(validateNoteContent(42).ok, false);
    assert.equal(validateNoteContent(["note"]).ok, false);
  });

  test("borne basse : 1 caractère accepté", () => {
    assert.deepEqual(validateNoteContent("x"), { ok: true, content: "x" });
  });

  test("borne haute : pile 2000 accepté", () => {
    const r = validateNoteContent("a".repeat(2000));
    assert.equal(r.ok, true);
    assert.equal(r.content.length, 2000);
  });

  test("2001 caractères rejetés", () => {
    const r = validateNoteContent("a".repeat(2001));
    assert.equal(r.ok, false);
    assert.match(r.error, /2000/);
  });

  test("espaces autour ne comptent pas (trim avant bornes)", () => {
    const r = validateNoteContent(`  ${"a".repeat(2000)}  `);
    assert.equal(r.ok, true);
    assert.equal(r.content.length, 2000);
  });

  test("multiligne conservée (textarea)", () => {
    const r = validateNoteContent("Ligne 1\nLigne 2");
    assert.deepEqual(r, { ok: true, content: "Ligne 1\nLigne 2" });
  });
});

describe("memberId guard", () => {
  test("cuid accepté", () => {
    assert.equal(isValidMemberId("cm3x4m2830000abc123def456"), true);
  });

  test("vide / non-cuid rejeté (→ 404 côté route)", () => {
    assert.equal(isValidMemberId(""), false);
    assert.equal(isValidMemberId("   "), false);
    assert.equal(isValidMemberId(null), false);
    assert.equal(isValidMemberId(undefined), false);
    assert.equal(isValidMemberId("not-a-cuid!"), false);
    assert.equal(isValidMemberId("12345"), false);
  });
});

describe("GET ordering", () => {
  test("tri createdAt desc (plus récent d'abord)", () => {
    const notes = [
      { id: "a", createdAt: "2026-10-01T10:00:00.000Z" },
      { id: "b", createdAt: "2026-10-07T10:00:00.000Z" },
      { id: "c", createdAt: "2026-10-03T10:00:00.000Z" },
    ];
    const sorted = sortNotesDesc(notes);
    assert.deepEqual(
      sorted.map((n) => n.id),
      ["b", "c", "a"],
    );
  });

  test("ne mute pas le tableau d'entrée", () => {
    const notes = [
      { id: "a", createdAt: "2026-10-01T10:00:00.000Z" },
      { id: "b", createdAt: "2026-10-07T10:00:00.000Z" },
    ];
    sortNotesDesc(notes);
    assert.equal(notes[0].id, "a");
  });
});
