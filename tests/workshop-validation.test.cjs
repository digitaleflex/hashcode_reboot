/**
 * Unit tests — validation pure du domaine ATELIERS.
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/workshop-validation.test.cjs
 *
 * Ce fichier IMPORTE la vraie source src/lib/workshop-validation.ts (plus
 * aucun miroir réimplémenté) : les assertions portent sur le code exécuté
 * en production, donc un bug dans workshop-validation.ts fait échouer ce
 * test au lieu de passer au vert.
 *
 * Ce qui n'est PAS testé, volontairement : aucun validateur de création ni
 * de mise à jour pour workshop, semaine, séance, activité, livrable, quiz
 * ou question. La structure pédagogique est produite par le seed
 * idempotent et aucune route admin de CRUD de structure n'existe en v1
 * (docs/ateliers/adr-001-decisions.md, décision D2) : il n'y a donc rien à
 * tester de ce côté.
 *
 * Coverage:
 *  - unions fermées réellement exportées par la source
 *  - submission: URL http(s) obligatoire pour les 6 types URL, normalisation,
 *    bornes de longueur, contenu vide, type inconnu
 *  - answers: shape only (number | number[]), negative index rejected
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Vraie source (require TypeScript via tsx) ───────────────────────────────

const {
  DELIVERABLE_URL_TYPES,
  parseAnswers,
  validateSubmission,
} = require("../src/lib/workshop-validation.ts");

// ── Tests ────────────────────────────────────────────────────────────────────

describe("unions fermées de workshop-validation.ts", () => {
  test("les 6 types de livrable URL sont ceux documentés", () => {
    // Cette liste pilote l'OBLIGATION d'URL dans validateSubmission :
    // toute dérive ici rendrait un type de livrable acceptant du texte libre.
    assert.deepEqual([...DELIVERABLE_URL_TYPES], [
      "url",
      "github_repo",
      "pull_request",
      "project",
      "deployed_url",
      "screenshot",
    ]);
  });
});

describe("validateSubmission", () => {
  test("type url : URL valide normalisée", () => {
    const r = validateSubmission({ content: "https://github.com/user/repo" }, "github_repo");
    assert.equal(r.ok, true);
    assert.equal(r.data.content, "https://github.com/user/repo");
  });

  test("URL normalisée : le source reçoit la forme canonique", () => {
    // `new URL().toString()` ajoute le slash racine absent de la saisie.
    const r = validateSubmission({ content: "https://github.com" }, "url");
    assert.equal(r.ok, true);
    assert.equal(r.data.content, "https://github.com/");
  });

  test("les 6 types URL refusent tous un texte brut", () => {
    for (const type of DELIVERABLE_URL_TYPES) {
      const r = validateSubmission({ content: "regardez mon repo" }, type);
      assert.equal(r.ok, false, `${type} a accepté du texte libre`);
      assert.equal(
        r.error,
        "Une URL http(s) valide est attendue pour ce type de livrable.",
      );
    }
  });

  test("type text : contenu libre accepté", () => {
    const r = validateSubmission({ content: "Ma synthèse de la séance…" }, "text");
    assert.equal(r.ok, true);
    assert.equal(r.data.content, "Ma synthèse de la séance…");
  });

  test("contenu vide rejeté", () => {
    const r = validateSubmission({ content: "   " }, "text");
    assert.equal(r.ok, false);
    assert.equal(r.error, "Le contenu du livrable est requis.");
  });

  test("URL trop longue rejetée", () => {
    assert.equal(validateSubmission({ content: "https://x.com/" + "a".repeat(2048) }, "url").ok, false);
  });

  test("schéma non http(s) rejeté (ftp://, javascript:)", () => {
    assert.equal(validateSubmission({ content: "ftp://x.com/a" }, "url").ok, false);
    assert.equal(validateSubmission({ content: "javascript:alert(1)" }, "url").ok, false);
  });

  test("type de livrable inconnu rejeté", () => {
    const r = validateSubmission({ content: "peu importe" }, "image");
    assert.equal(r.ok, false);
    assert.equal(r.error, "Type de livrable inconnu.");
  });

  test("texte de 10000 caractères accepté, 10001 rejeté", () => {
    assert.equal(validateSubmission({ content: "a".repeat(10000) }, "text").ok, true);
    assert.equal(validateSubmission({ content: "a".repeat(10001) }, "text").ok, false);
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

  test("indice non entier (1.5) rejeté", () => {
    assert.equal(parseAnswers([1.5]).ok, false);
  });

  test("chaîne numérique acceptée dans un tableau d'indices", () => {
    // Comportement réel : Number(c) est appliqué aux entrées de tableau.
    const r = parseAnswers([["0", "1"]]);
    assert.deepEqual(r, { ok: true, answers: [[0, 1]] });
  });
});
