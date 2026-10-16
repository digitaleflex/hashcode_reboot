/**
 * Parcours auth — mapping d'erreurs, masquage email, anti open-redirect (#112).
 *
 * Importe l'implémentation RÉELLE (pas un miroir) : toute dérive de
 * `src/lib/auth-ui.ts` casse ici. Enjeu : aucun texte serveur ne doit
 * fuiter à l'écran (USER_NOT_FOUND, 500…) et `next` ne doit jamais
 * sortir du site.
 * Run: tsx --test tests/auth-ui.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NEXT,
  classifyAuthError,
  maskEmail,
  sanitizeNext,
} from "../src/lib/auth-ui";

describe("sanitizeNext : seuls les chemins internes", () => {
  test("internes acceptés tels quels", () => {
    assert.equal(sanitizeNext("/dashboard"), "/dashboard");
    assert.equal(sanitizeNext("/admin/stats"), "/admin/stats");
    assert.equal(sanitizeNext("/verify-otp?email=a@b.c"), "/verify-otp?email=a@b.c");
  });

  test("externes et protocol-relative → défaut", () => {
    for (const bad of ["//evil.com", "//evil.com/x", "https://evil.com", "javascript:alert(1)", "", null, undefined]) {
      assert.equal(sanitizeNext(bad), DEFAULT_NEXT, JSON.stringify(bad));
    }
  });
});

describe("classifyAuthError : codes stables uniquement", () => {
  test("OTP expiré / tentatives / invalide", () => {
    assert.equal(classifyAuthError({ code: "OTP_EXPIRED" }), "expired");
    assert.equal(classifyAuthError({ code: "TOO_MANY_ATTEMPTS" }), "tooManyAttempts");
    assert.equal(classifyAuthError({ code: "INVALID_OTP" }), "invalid");
    // Anti-énumération : existence du compte indiscernable d'un code invalide.
    assert.equal(classifyAuthError({ code: "USER_NOT_FOUND" }), "invalid");
  });

  test("rate-limit et pannes", () => {
    assert.equal(classifyAuthError({ status: 429 }), "rateLimited");
    assert.equal(classifyAuthError({ code: "RATE_LIMITED" }), "rateLimited");
    assert.equal(classifyAuthError({ status: 500 }), "unavailable");
    assert.equal(classifyAuthError({ status: 503 }), "unavailable");
  });

  test("transport illisible → network, jamais de throw", () => {
    for (const bad of [null, undefined, 42, "boom", {}]) {
      assert.equal(classifyAuthError(bad), "network", JSON.stringify(bad));
    }
  });
});

describe("maskEmail : anti shoulder-surfing", () => {
  test("local masqué, domaine lisible", () => {
    assert.equal(maskEmail("awa@hashcode.fr"), "a**@hashcode.fr");
    assert.equal(maskEmail("abcdef@hashcode.fr"), "a***@hashcode.fr");
  });

  test("sans @ → dégradé sans throw", () => {
    assert.equal(maskEmail(""), "");
    assert.equal(maskEmail("no-at-sign"), "n***");
  });
});
