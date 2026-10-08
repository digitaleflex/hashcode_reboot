/**
 * Turnstile anti-bot (#215) — helper pur + fail-open dev / fail-closed prod.
 *
 * Comme tests/acquisition-state.test.ts, ces tests importent le VRAI code
 * TS via tsx : aucune logique réimplémentée, aucun appel réseau (fetch
 * injecté en stub). Aucune CJK dans ce fichier.
 *
 * Run: tsx --test tests/turnstile.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  extractTurnstileToken,
  shouldBypassTurnstile,
  verifyTurnstile,
} from "../src/lib/turnstile";

const devEnv = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
const prodEnv = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
const devNoSecret = { ...devEnv } as NodeJS.ProcessEnv;

function stubFetch(success: boolean) {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return { json: async () => ({ success }) };
  }) as unknown as typeof fetch;
  return { fetchFn, calls: () => calls };
}

function throwingFetch() {
  const fetchFn = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  return fetchFn;
}

describe("extractTurnstileToken — champ body optionnel, jamais bloquant", () => {
  test("token valide extrait (trim)", () => {
    assert.equal(extractTurnstileToken({ turnstileToken: "  tok123 " }), "tok123");
  });

  test("absent / non-chaîne / vide → null", () => {
    assert.equal(extractTurnstileToken({}), null);
    assert.equal(extractTurnstileToken(null), null);
    assert.equal(extractTurnstileToken([]), null);
    assert.equal(extractTurnstileToken({ turnstileToken: 42 }), null);
    assert.equal(extractTurnstileToken({ turnstileToken: "   " }), null);
  });

  test("token géant rejeté (borne anti-abus)", () => {
    assert.equal(
      extractTurnstileToken({ turnstileToken: "x".repeat(2049) }),
      null,
    );
    assert.equal(
      extractTurnstileToken({ turnstileToken: "x".repeat(2048) })?.length,
      2048,
    );
  });
});

describe("shouldBypassTurnstile — fail-open dev uniquement", () => {
  test("clé absente + dev → bypass", () => {
    assert.equal(shouldBypassTurnstile(devNoSecret), true);
  });

  test("clé absente + prod → pas de bypass (fail-closed)", () => {
    assert.equal(shouldBypassTurnstile(prodEnv), false);
  });

  test("clé présente → pas de bypass (dev comme prod)", () => {
    const dev = { ...devEnv, TURNSTILE_SECRET_KEY: "s" } as NodeJS.ProcessEnv;
    const prod = { ...prodEnv, TURNSTILE_SECRET_KEY: "s" } as NodeJS.ProcessEnv;
    assert.equal(shouldBypassTurnstile(dev), false);
    assert.equal(shouldBypassTurnstile(prod), false);
  });
});

describe("verifyTurnstile — matrice dev/prod", () => {
  test("clé absente : dev skip (warn), prod refus", async () => {
    assert.deepEqual(
      await verifyTurnstile(null, { env: devNoSecret }),
      { ok: true, skipped: true },
    );
    assert.deepEqual(await verifyTurnstile(null, { env: prodEnv }), {
      ok: false,
    });
  });

  test("token absent : rien n'est envoyé en dev (fetch non appelé)", async () => {
    const { fetchFn, calls } = stubFetch(true);
    const res = await verifyTurnstile(null, {
      secret: "s",
      fetchFn,
      env: devEnv,
    });
    assert.deepEqual(res, { ok: true, skipped: true });
    assert.equal(calls(), 0);
  });

  test("token absent en prod → refus sans créer le membre", async () => {
    const { fetchFn, calls } = stubFetch(true);
    const res = await verifyTurnstile(null, {
      secret: "s",
      fetchFn,
      env: prodEnv,
    });
    assert.deepEqual(res, { ok: false });
    assert.equal(calls(), 0);
  });

  test("succès Cloudflare → ok (dev comme prod)", async () => {
    for (const env of [devEnv, prodEnv]) {
      const { fetchFn } = stubFetch(true);
      assert.deepEqual(
        await verifyTurnstile("tok", { secret: "s", fetchFn, env }),
        { ok: true },
      );
    }
  });

  test("refus Cloudflare : dev skip, prod refus", async () => {
    const bad1 = stubFetch(false);
    assert.deepEqual(
      await verifyTurnstile("tok", {
        secret: "s",
        fetchFn: bad1.fetchFn,
        env: devEnv,
      }),
      { ok: true, skipped: true },
    );
    const bad2 = stubFetch(false);
    assert.deepEqual(
      await verifyTurnstile("tok", {
        secret: "s",
        fetchFn: bad2.fetchFn,
        env: prodEnv,
      }),
      { ok: false },
    );
  });

  test("erreur réseau : dev skip, prod refus (fail-closed)", async () => {
    assert.deepEqual(
      await verifyTurnstile("tok", {
        secret: "s",
        fetchFn: throwingFetch(),
        env: devEnv,
      }),
      { ok: true, skipped: true },
    );
    assert.deepEqual(
      await verifyTurnstile("tok", {
        secret: "s",
        fetchFn: throwingFetch(),
        env: prodEnv,
      }),
      { ok: false },
    );
  });
});
