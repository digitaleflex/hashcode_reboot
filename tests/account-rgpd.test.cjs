/**
 * Unit tests — RGPD membre #64 : export + suppression (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/account-rgpd.test.cjs
 *
 * D18 — ce fichier teste la VRAIE source `src/lib/account-rgpd.ts`, importée via
 * `tsx`. Plus aucun miroir : `DELETE_CONFIRM_WORD`, `EXPORT_ANALYTICS_MAX`,
 * `EXPORT_FORMAT`, `isDeleteConfirmed` et `buildExportPayload` sont exécutés
 * depuis la source, donc une régression dans `/api/account/route.ts:63` ou
 * `/api/account/export/route.ts:89` échoue ici au lieu de passer au vert à côté
 * d'un bug.
 *
 * (L'ancien en-tête « Mirrors — .cjs can't import TS » était faux : `tsx` est
 * utilisé par `npm run test:unit` et un `.test.cjs` importe le TS sans effort.)
 *
 * Coverage:
 *  - confirmation : mot exact uniquement (casse, espaces, types rejetés)
 *  - export : les 12 clés attendues (liste fermée), format versionné,
 *    exportedAt ISO, blocs draft/analytics, flag analyticsTruncated
 */

"use strict";

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

// ── Source de production (pas de miroir) ──

/** Module réel, chargé une fois pour tous les tests du fichier. */
let rgpd;
const sourceReady = import("../src/lib/account-rgpd.ts").then((m) => {
  rgpd = m;
});

before(() => sourceReady);

// ── Tests ──

describe("isDeleteConfirmed", () => {
  test("accepte uniquement le mot exact", () => {
    assert.equal(rgpd.isDeleteConfirmed({ confirm: "SUPPRIMER" }), true);
  });

  test("rejette casse, espaces, vide, types et absents", () => {
    const { isDeleteConfirmed } = rgpd;
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

  test("le mot de confirmation vient bien de la constante partagée", () => {
    // `DataSection.tsx:56,63` compare le même mot : si la constante change,
    // l'UI et l'API bougent ensemble — ce test verrouille la valeur.
    assert.equal(rgpd.DELETE_CONFIRM_WORD, "SUPPRIMER");
    assert.equal(
      rgpd.isDeleteConfirmed({ confirm: rgpd.DELETE_CONFIRM_WORD }),
      true,
    );
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
    const out = rgpd.buildExportPayload(member, empty);
    assert.deepEqual(out.member, member);
    assert.equal(out.format, rgpd.EXPORT_FORMAT);
    assert.ok(!Number.isNaN(Date.parse(out.exportedAt)), out.exportedAt);
    for (const k of ["rsvps", "enrollments", "submissions", "quizAttempts", "emailLogs", "sessions", "draft", "analytics"]) {
      assert.ok(k in out, `bloc manquant : ${k}`);
    }
    assert.equal(out.analyticsTruncated, false);
  });

  test("liste de clés fermée : aucun bloc perdu, aucun bloc ajouté", () => {
    // Le miroir ne testait que la présence de 8 blocs : un bloc renommé ou
    // supprimé passait au vert. La liste ci-dessous est celle de la source.
    const out = rgpd.buildExportPayload(member, empty);
    assert.deepEqual(Object.keys(out).sort(), [
      "analytics",
      "analyticsTruncated",
      "draft",
      "emailLogs",
      "enrollments",
      "exportedAt",
      "format",
      "member",
      "quizAttempts",
      "rsvps",
      "sessions",
      "submissions",
    ]);
  });

  test("relaie les relations telles quelles (référence, pas de copie)", () => {
    const rsvps = [{ id: "r1" }];
    const out = rgpd.buildExportPayload(member, { ...empty, rsvps });
    assert.equal(out.rsvps, rsvps, "le payload doit référencer les relations reçues");
  });

  test("sérialisable JSON (téléchargeable tel quel)", () => {
    const out = rgpd.buildExportPayload(member, {
      ...empty,
      draft: { email: "a@x.y", answers: "{}" },
      analyticsTruncated: true,
    });
    assert.doesNotThrow(() => JSON.stringify(out));
    assert.equal(out.analyticsTruncated, true);
  });

  test("constantes : plafond analytics 500, format versionné", () => {
    assert.equal(rgpd.EXPORT_ANALYTICS_MAX, 500);
    assert.equal(rgpd.EXPORT_FORMAT, "hashcode-reboot-export-v1");
    assert.ok(rgpd.EXPORT_FORMAT.startsWith("hashcode-reboot-export-"));
  });
});
