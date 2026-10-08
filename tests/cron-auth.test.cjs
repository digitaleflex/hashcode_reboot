/**
 * Tests — authentification Bearer des routes /api/cron/* (fenêtre de grâce).
 * No server required. Le helper est en TypeScript : les tests .cjs ne peuvent
 * pas l'importer, donc on recopie sa logique pure (comparaison à temps
 * constant contre SECRET puis PREVIOUS) et on vérifie la conformité des
 * sources (les 8 routes délèguent au helper, sans timingSafeEqual local).
 *
 * Run:  node --test tests/cron-auth.test.cjs
 *
 * Coverage:
 *  - token == CRON_SECRET accepté
 *  - token == CRON_SECRET_PREVIOUS accepté (fenêtre de grâce)
 *  - token inconnu refusé
 *  - PREVIOUS vide ou non défini → refusé (pas de match sur chaîne vide)
 *  - secrets absents → refusé sans throw
 *  - les 8 routes cron utilisent isCronAuthed et n'ont plus de timingSafeEqual
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const HELPER_PATH = path.join(ROOT, "src/lib/cron-auth.ts");
const CRON_ROUTES = [
  "activation-relance",
  "admin-alerts",
  "collect-metrics",
  "email-alerts",
  "event-reminders",
  "health-alert",
  "keepalive",
  "relance",
];

// ── Miroir pur de src/lib/cron-auth.ts ──
// Même logique : header complet `Bearer <secret>` comparé en temps constant,
// d'abord contre CRON_SECRET, puis contre CRON_SECRET_PREVIOUS (grâce).
// Retourne { ok, grace } au lieu d'un booléen pour observer la branche.

function headerMatches(authHeader, secret) {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  return timingSafeEqual(a, b);
}

function isCronAuthedMirror(authHeader, env) {
  if (headerMatches(authHeader, env.CRON_SECRET)) return { ok: true, grace: false };
  if (headerMatches(authHeader, env.CRON_SECRET_PREVIOUS))
    return { ok: true, grace: true };
  return { ok: false, grace: false };
}

describe("cron-auth — logique miroir (SECRET / PREVIOUS)", () => {
  test("token == CRON_SECRET accepté, hors grâce", () => {
    const r = isCronAuthedMirror("Bearer nouveau-secret", {
      CRON_SECRET: "nouveau-secret",
      CRON_SECRET_PREVIOUS: "ancien-secret",
    });
    assert.deepEqual(r, { ok: true, grace: false });
  });

  test("token == CRON_SECRET_PREVIOUS accepté, branche grâce", () => {
    const r = isCronAuthedMirror("Bearer ancien-secret", {
      CRON_SECRET: "nouveau-secret",
      CRON_SECRET_PREVIOUS: "ancien-secret",
    });
    assert.deepEqual(r, { ok: true, grace: true });
  });

  test("token inconnu refusé", () => {
    const r = isCronAuthedMirror("Bearer n-importe-quoi", {
      CRON_SECRET: "nouveau-secret",
      CRON_SECRET_PREVIOUS: "ancien-secret",
    });
    assert.deepEqual(r, { ok: false, grace: false });
  });

  test("header absent refusé", () => {
    const r = isCronAuthedMirror("", {
      CRON_SECRET: "nouveau-secret",
      CRON_SECRET_PREVIOUS: "ancien-secret",
    });
    assert.deepEqual(r, { ok: false, grace: false });
  });

  test("PREVIOUS vide → refusé (pas de match sur chaîne vide)", () => {
    const r = isCronAuthedMirror("Bearer ", {
      CRON_SECRET: "nouveau-secret",
      CRON_SECRET_PREVIOUS: "",
    });
    assert.deepEqual(r, { ok: false, grace: false });
  });

  test("PREVIOUS non défini → seul SECRET matche", () => {
    const env = { CRON_SECRET: "nouveau-secret" };
    assert.deepEqual(isCronAuthedMirror("Bearer nouveau-secret", env), {
      ok: true,
      grace: false,
    });
    assert.deepEqual(isCronAuthedMirror("Bearer autre", env), {
      ok: false,
      grace: false,
    });
  });

  test("secrets absents → refusé sans throw", () => {
    assert.doesNotThrow(() => {
      const r = isCronAuthedMirror("Bearer x", {});
      assert.deepEqual(r, { ok: false, grace: false });
    });
  });

  test("longueur différente → refusé sans throw (garde timingSafeEqual)", () => {
    assert.doesNotThrow(() => {
      const r = isCronAuthedMirror("Bearer court", {
        CRON_SECRET: "un-secret-beaucoup-plus-long",
      });
      assert.deepEqual(r, { ok: false, grace: false });
    });
  });
});

describe("cron-auth — conformité des sources", () => {
  test("le helper compare en temps constant et ne loggue aucun secret", () => {
    const src = fs.readFileSync(HELPER_PATH, "utf8");
    assert.ok(src.includes("timingSafeEqual"), "timingSafeEqual attendu");
    assert.ok(src.includes("CRON_SECRET_PREVIOUS"), "PREVIOUS attendu");
    assert.ok(
      src.includes("console.warn") && src.includes("fenêtre de grâce active"),
      "avertissement de grâce attendu",
    );
    assert.ok(!src.includes("console.log"), "aucun console.log (bruyant)");
  });

  for (const slug of CRON_ROUTES) {
    test(`route ${slug} : délègue à isCronAuthed, sans timingSafeEqual local`, () => {
      const src = fs.readFileSync(
        path.join(ROOT, "src/app/api/cron", slug, "route.ts"),
        "utf8",
      );
      assert.ok(src.includes("isCronAuthed"), `${slug} doit appeler isCronAuthed`);
      assert.ok(
        src.includes("@/lib/cron-auth"),
        `${slug} doit importer @/lib/cron-auth`,
      );
      assert.ok(
        !src.includes("timingSafeEqual"),
        `${slug} ne doit plus comparer le secret en local`,
      );
    });
  }
});
