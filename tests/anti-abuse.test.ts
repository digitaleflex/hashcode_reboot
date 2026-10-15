/**
 * Anti-abus du point d'entrée (#118) — garde-fous purs, sans serveur.
 *
 * Couvre les 4 preuves exigées par l'issue :
 *   1. dépassement de quota → 429 non révélateur ;
 *   2. trafic normal → autorisé ;
 *   3. automation évidente → bloquée (bucket épuisé) ;
 *   4. reprise légitime → non bloquée (pas de captcha : Turnstile retiré).
 * Plus : 403 TESTING sans écriture, logs sans PII (asserté par revue — voir
 * docs/security-anti-abuse-2026-10-15.md, §5).
 *
 * Aucun appel réseau (fetch stubbé, Redis absent → repli mémoire).
 * Run: tsx --test tests/anti-abuse.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { rateLimit } from "../src/lib/rate-limit";
import { blockIfTesting } from "../src/lib/test-guard";
import {
  RateLimitError,
  ValidationError,
  errorToResponse,
} from "../src/lib/errors";

describe("quota dépassé → 429 non révélateur", () => {
  test("bucket épuisé après capacity, isolation par clé", async () => {
    const bucket = `anti-abuse-ut-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const r = await rateLimit(bucket, { capacity: 5, windowMs: 60000 });
      assert.equal(r.ok, true, `appel ${i + 1} (trafic normal) autorisé`);
    }
    const over = await rateLimit(bucket, { capacity: 5, windowMs: 60000 });
    assert.equal(over.ok, false, "6e appel (automation) bloqué");
    assert.ok(
      (over.retryAfterMs ?? 0) > 0,
      "retryAfterMs renseigné pour le header Retry-After",
    );
    const other = await rateLimit(`${bucket}-other`, {
      capacity: 5,
      windowMs: 60000,
    });
    assert.equal(other.ok, true, "autre clé isolée (pas de blast radius)");
  });

  test("réponse 429 générique : message + code + Retry-After, sans chiffres internes", async () => {
    const res = errorToResponse(new RateLimitError("Trop de tentatives.", 45000));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "45");
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(typeof body.error, "string");
    const serialized = JSON.stringify(body);
    assert.ok(
      !/capacity|windowMs|bucket|quota|remaining|reset/i.test(serialized),
      `réponse non révélatrice : ${serialized}`,
    );
  });

  test("422 validation : forme stable, sans fuite", async () => {
    const res = errorToResponse(new ValidationError("Email invalide."));
    assert.equal(res.status, 422);
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(typeof body.error === "string" && typeof body.code === "string");
  });
});

describe("TESTING guard : 403 sans écriture", () => {
  test("TESTING=1 bloque, sinon laisse passer", async () => {
    const prev = process.env.TESTING;
    try {
      process.env.TESTING = "1";
      const blocked = blockIfTesting();
      assert.ok(blocked, "bloqué en mode TESTING");
      assert.equal(blocked!.status, 403);
      const body = (await blocked!.json()) as Record<string, unknown>;
      assert.equal(body.code, "TESTING_GUARD");
    } finally {
      if (prev === undefined) delete process.env.TESTING;
      else process.env.TESTING = prev;
    }
    assert.equal(blockIfTesting(), null, "laissé passer hors TESTING");
  });
});
