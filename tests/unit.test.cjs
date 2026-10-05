/**
 * Unit tests — logique serveur pure et réellement importée.
 *
 * Run:  node --import tsx --test tests/unit.test.cjs
 *
 * D18 — ce fichier importe désormais le VRAI code source. Il réimplémentait
 * tout en local (« cjs can't import TS »), ce qui est faux depuis que
 * `npm run test:unit` utilise `node --import tsx`.
 *
 * SECTIONS SUPPRIMÉES en D18, et pourquoi :
 *
 * 1. `admin-auth: token issuance & verification` (10 tests)
 * 2. `admin-auth: identity token format` (7 tests)
 *    → testaient la logique HMAC du passcode admin (table `AdminKey`). Cette
 *      feature a été supprimée (le passcode est devenu une connexion
 *      Better Auth email/password ; `admin-auth.ts` n'exporte plus aucune
 *      fonction d'émission/vérification de token). Ces 17 tests passaient au
 *      vert en ne testant plus rien : une fausse assurance sur le mécanisme
 *      d'accès le plus sensible de l'application.
 *
 * 3. `soft-delete: filter logic` (2 tests)
 *    → testaient `withSoftDelete`, supprimé avec `prisma-extensions.ts` en D11
 *      (fichier mort, 0 consommateur). Le test affirmait
 *      `activeRecord.deletedAt === filter.deletedAt` sur deux objets qu'il
 *      venait de créer lui-même : une tautologie, il ne testait que la
 *      sémantique de `===` en JavaScript.
 *
 * `audit: admin event types` (2 tests) supprimé aussi : `audit()` est bien
 * exporté mais écrit en base via Prisma — non testable sans DB. Le test
 * vérifierait que des chaînes sont des chaînes. À couvrir par les tests
 * d'intégration si cejugement a de la valeur.
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// Vraie source, pas un miroir.
const { rateLimit, memoryRateLimit, retryAfterHeader, RATE_LIMITS } = require("../src/lib/rate-limit.ts");
const { rateKey } = require("../src/lib/rate-limit-key.ts");
const { adminAllowList } = require("../src/lib/admin-auth.ts");

/** Construit un objet minimal compatible avec ce que rateKey()/checkCSRF lisent. */
function fakeReq({ ip, headers = {} } = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ip,
    headers: { get: (k) => map.get(String(k).toLowerCase()) ?? null },
    nextUrl: { origin: "https://app.test", hostname: "app.test" },
    method: "GET",
  };
}

describe("rateKey: IP extraction (import réel)", () => {
  test("retourne req.ip en priorité (respecte x-forwarded-for via Next)", () => {
    assert.equal(rateKey(fakeReq({ ip: "203.0.113.9" })), "203.0.113.9");
  });

  test("retombe sur la première entrée de x-forwarded-for si req.ip est absent", () => {
    const req = fakeReq({
      headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1, 10.0.0.2" },
    });
    assert.equal(rateKey(req), "198.51.100.1");
  });

  test("retombe sur x-real-ip si x-forwarded-for est absent", () => {
    const req = fakeReq({ headers: { "x-real-ip": "192.0.2.44" } });
    assert.equal(rateKey(req), "192.0.2.44");
  });

  test("retombe sur 'anon' si aucun en-tête d'IP n'est présent", () => {
    assert.equal(rateKey(fakeReq({})), "anon");
  });

  test("tolère les espaces autour de l'entrée x-forwarded-for", () => {
    const req = fakeReq({ headers: { "x-forwarded-for": "  198.51.100.7 ,10.0.0.1" } });
    assert.equal(rateKey(req), "198.51.100.7");
  });
});

describe("admin-auth: allow-list (import réel)", () => {
  test("adminAllowList() retourne un tableau", () => {
    assert.ok(Array.isArray(adminAllowList()));
  });

  test("toute entrée est une adresse email normalisée", () => {
    for (const entry of adminAllowList()) {
      assert.match(entry, /@/, `entrée non-email : "${entry}"`);
      assert.equal(entry, entry.trim().toLowerCase(), `entrée non normalisée : "${entry}"`);
    }
  });

  test("pas de doublon dans l'allow-list", () => {
    const list = adminAllowList();
    const unique = new Set(list);
    assert.equal(
      list.length,
      unique.size,
      `doublons dans ADMIN_OPERATORS/VIEWERS : ${list.length} entrées, ${unique.size} uniques`,
    );
  });

  test("ne renvoie jamais undefined (une liste vide signifie « personne admin », fail-closed)", () => {
    // La sémantique est load-bearing : `admin-auth.ts`Fail-closed sur une
    // liste vide. Si cette fonction renvoyait undefined, un `?.includes`
    // ouvrirait l'espace admin à tout le monde.
    assert.notEqual(adminAllowList(), undefined);
    assert.notEqual(adminAllowList(), null);
  });
});

describe("rate-limit: seau à jetons en mémoire (import réel)", () => {
  // D18 : `memoryRateLimit` a été exporté pour ces tests. Avant, cette
  // arithmétique de recharge n'était couverte que par un MIROIR local, donc
  // sa correctivité n'a jamais été vérifiée contre cette implémentation.
  const cfg = { capacity: 3, windowMs: 3_000 }; // 1 jeton / seconde

  test("un seau neuf est plein", () => {
    const r = memoryRateLimit(`fresh-${Math.random()}`, cfg);
    assert.equal(r.ok, true);
    assert.equal(r.remaining, cfg.capacity - 1);
  });

  test("consomme un jeton par appel jusqu'à épuisement", () => {
    const key = `drain-${Math.random()}`;
    for (let i = 0; i < cfg.capacity; i++) {
      assert.equal(memoryRateLimit(key, cfg).ok, true, `appel ${i + 1} aurait dû passer`);
    }
    const denied = memoryRateLimit(key, cfg);
    assert.equal(denied.ok, false, "le 4e appel doit être refusé");
    assert.equal(denied.remaining, 0);
  });

  test("retourne un retryAfterMs positif quand il refuse", () => {
    const key = `retry-${Math.random()}`;
    for (let i = 0; i < cfg.capacity; i++) memoryRateLimit(key, cfg);
    const denied = memoryRateLimit(key, cfg);
    assert.ok(denied.retryAfterMs > 0, "retryAfterMs doit être > 0 pour que le client attende");
  });

  test("recharge au fil du temps (attente réelle courte)", async () => {
    // 1 jeton/seconde : après ~1,1 s un jeton doit être rendu.
    const key = `refill-${Math.random()}`;
    for (let i = 0; i < cfg.capacity; i++) memoryRateLimit(key, cfg);
    assert.equal(memoryRateLimit(key, cfg).ok, false, "doit être épuisé avant recharge");

    await new Promise((r) => setTimeout(r, 1_100));
    assert.equal(
      memoryRateLimit(key, cfg).ok,
      true,
      "après 1,1 s à 1 jeton/s, un jeton doit être disponible",
    );
  });

  test("les clés sont isolées (une IP ne consomme pas le budget d'une autre)", () => {
    const a = `iso-a-${Math.random()}`;
    const b = `iso-b-${Math.random()}`;
    for (let i = 0; i < cfg.capacity; i++) memoryRateLimit(a, cfg);
    assert.equal(memoryRateLimit(a, cfg).ok, false, "clé A doit être épuisée");
    assert.equal(memoryRateLimit(b, cfg).ok, true, "clé B doit être intacte");
  });

  test("jamais de jetons au-delà de la capacité (pas d'overfill)", async () => {
    const key = `overfill-${Math.random()}`;
    await new Promise((r) => setTimeout(r, 50));
    memoryRateLimit(key, cfg);
    await new Promise((r) => setTimeout(r, 1_100));
    const r = memoryRateLimit(key, cfg);
    assert.ok(
      r.remaining <= cfg.capacity,
      `remaining=${r.remaining} ne doit jamais dépasser capacity=${cfg.capacity}`,
    );
  });
});

describe("rate-limit: API publique (import réel)", () => {
  test("retryAfterHeader convertit les ms en secondes entières", () => {
    assert.equal(retryAfterHeader(5000), "5");
    assert.equal(retryAfterHeader(1500), "2");
    assert.equal(retryAfterHeader(0), "0");
  });

  test("retryAfterHeader retombe sur le fallback si la valeur est invalide", () => {
    // Garde-fou documenté dans rate-limit.ts (RFC 7231 §7.1.3 : delta-seconds
    // doit être un entier non négatif).
    assert.equal(retryAfterHeader(Number.NaN, 2000), "2");
    assert.equal(retryAfterHeader(Number.POSITIVE_INFINITY, 2000), "2");
    assert.equal(retryAfterHeader(-500, 2000), "0");
  });

  test("RATE_LIMITS expose des capacités et fenêtres cohérentes", () => {
    assert.ok(RATE_LIMITS.login.capacity > 0);
    assert.ok(RATE_LIMITS.login.windowMs > 0);
    assert.ok(RATE_LIMITS.write.capacity > 0);
    assert.ok(RATE_LIMITS.write.windowMs > 0);
    // La fenêtre d'écriture doit être plus large que celle de connexion.
    assert.ok(RATE_LIMITS.write.windowMs > RATE_LIMITS.login.windowMs);
  });

  test("rateLimit() dégrade sur la mémoire quand Redis est indisponible", async () => {
    // Pas d'assertion sur l_requests exacts : sans Redis configuré,
    // `rateLimit()` bascule sur le seau mémoire. Ce qui compte est que
    // l'appel NE LÈVE PAS — c'est la garantie que le rate limiting ne
    // devient un point de défaillance.
    const first = await rateLimit("d18-test-key", { capacity: 2, windowMs: 60_000 });
    assert.equal(typeof first.ok, "boolean");
    assert.equal(typeof first.remaining, "number");
    assert.equal(typeof first.retryAfterMs, "number");
  });
});