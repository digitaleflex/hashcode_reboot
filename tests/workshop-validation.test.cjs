/**
 * Unit tests — validation pure du domaine ATELIERS.
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/workshop-validation.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - validateSubmission and parseAnswers of src/lib/workshop-validation.ts
 *    (the only two exports that file still has real callers for).
 *    The create/update validators for workshop, week, session, activity,
 *    deliverable, review, quiz and question are GONE from the source: the
 *    pedagogical structure is produced by an idempotent seed and no admin
 *    CRUD route exists in v1 (docs/ateliers/adr-001-decisions.md, D2).
 *    Mirroring them here would have kept green tests protecting rules no
 *    route ever applied.
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - submission: URL required for URL types, text bounds, empty content
 *  - answers: shape only (number | number[]), negative index rejected
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/workshop-validation.ts ──

const DELIVERABLE_URL_TYPES = ["url", "github_repo", "pull_request", "project", "deployed_url", "screenshot"];

function optStr(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function parseHttpUrl(v) {
  const s = optStr(v);
  if (s === null) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.toString();
  } catch {
    return false;
  }
}

function validateSubmission(body, deliverableType) {
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return { ok: false, error: "Le contenu du livrable est requis." };
  if (DELIVERABLE_URL_TYPES.includes(deliverableType)) {
    const url = parseHttpUrl(content);
    if (url === null || url === false) {
      return { ok: false, error: "Une URL http(s) valide est attendue pour ce type de livrable." };
    }
    if (url.length > 2048) return { ok: false, error: "URL trop longue (max 2048 caractères)." };
    return { ok: true, data: { content: url } };
  }
  if (deliverableType === "text") {
    if (content.length > 10000) {
      return { ok: false, error: "Texte trop long (max 10000 caractères)." };
    }
    return { ok: true, data: { content } };
  }
  return { ok: false, error: "Type de livrable inconnu." };
}

function parseAnswers(v) {
  if (!Array.isArray(v)) return { ok: false, error: "answers doit être un tableau." };
  const answers = [];
  for (const entry of v) {
    if (typeof entry === "number") {
      if (!Number.isInteger(entry) || entry < 0) {
        return { ok: false, error: "answers : indices invalides." };
      }
      answers.push(entry);
    } else if (Array.isArray(entry)) {
      const idx = entry.map((c) => Number(c));
      if (idx.some((c) => !Number.isInteger(c) || c < 0)) {
        return { ok: false, error: "answers : indices invalides." };
      }
      answers.push(idx);
    } else {
      return { ok: false, error: "answers : chaque entrée doit être un indice ou un tableau." };
    }
  }
  return { ok: true, answers };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("validateSubmission", () => {
  test("type url : URL valide normalisée", () => {
    const r = validateSubmission({ content: "https://github.com/user/repo" }, "github_repo");
    assert.equal(r.ok, true);
    assert.equal(r.data.content, "https://github.com/user/repo");
  });

  test("type url : texte brut rejeté", () => {
    assert.equal(validateSubmission({ content: "regardez mon repo" }, "url").ok, false);
  });

  test("type text : contenu libre accepté", () => {
    const r = validateSubmission({ content: "Ma synthèse de la séance…" }, "text");
    assert.equal(r.ok, true);
  });

  test("contenu vide rejeté", () => {
    assert.equal(validateSubmission({ content: "   " }, "text").ok, false);
  });

  test("URL trop longue rejetée", () => {
    assert.equal(validateSubmission({ content: "https://x.com/" + "a".repeat(2048) }, "url").ok, false);
  });
});

describe("parseAnswers (forme)", () => {
  test("indices et tableaux d'indices acceptés", () => {
    const r = parseAnswers([0, [1, 2], 1]);
    assert.deepEqual(r, { ok: true, answers: [0, [1, 2], 1] });
  });

  test("non-tableau rejeté", () => {
    assert.equal(parseAnswers({ 0: 1 }).ok, false);
  });

  test("entrée texte rejetée", () => {
    assert.equal(parseAnswers(["a"]).ok, false);
  });

  test("indice négatif rejeté", () => {
    assert.equal(parseAnswers([-1]).ok, false);
    assert.equal(parseAnswers([[0, -1]]).ok, false);
  });
});