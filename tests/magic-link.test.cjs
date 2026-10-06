/**
 * Unit tests — Magic link auth flow (onboarding + login) + filtre open-redirect.
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/magic-link.test.cjs
 *
 * D18/D19 — ce fichier teste la VRAIE source, plus aucun miroir :
 *   - src/lib/verify-email.ts → buildVerifyUrl, requestEmailLink,
 *                              confirmEmailLink, isEmailVerified
 *   - src/lib/auth-ui.ts      → sanitizeNext
 *
 * Ce qui a été RETIRÉ (tests verts sans tester le code de production) :
 *   - §4 `generateOtp`, §5 `hashOtp`/`verifyOtpHash` (+ require("bcryptjs")),
 *     §6 `isValidOtpFormat` : ces 14 tests portaient sur `src/lib/account-otp.ts`,
 *     fichier SUPPRIMÉ lors de la migration Better Auth. Ils passaient au vert en
 *     ne testant que des fonctions locales : un bug dans l'OTP Better Auth
 *     (`emailOTP`) passait sans bruit.
 *   - §1 `parseLinkEntry` (10 tests) : la fonction n'est PAS exportée par
 *     `src/lib/verify-email.ts` et n'est atteinte que par la branche Redis
 *     (`redis.get` + `parseLinkEntry`), que le repli mémoire ne traverse
 *     jamais. Elle n'est donc couverte nulle part aujourd'hui — à reprendre
 *     avec un vrai test d'intégration Redis (D19), pas avec un miroir local.
 *
 * Le chemin testé est le fallback MÉMOIRE (`KV_REST_API_URL`/`TOKEN` absents),
 * seul chemin déterministe sans service externe : les variables KV sont
 * neutralisées puis restaurées en `after()`.
 *
 * Conséquence de cette bascule : les fonctions de `verify-email.ts` sont
 * stateful au niveau module (Map mémoire + cooldown 60 s par email). Chaque
 * test utilise donc une adresse différente, et le cooldown est franchi avec
 * `mock.timers` (horloge seule) plutôt qu'en attendant 60 s réelles.
 *
 * Coverage:
 *  - buildVerifyUrl : SITE_URL > URL > défaut prod, slash final, encodage
 *  - requestEmailLink : token, normalisation email, cooldown 60 s, invalidation
 *    de l'ancien lien au renvoi
 *  - confirmEmailLink : longueur mini 16 (frontière), token inconnu → expired,
 *    usage unique
 *  - isEmailVerified : false avant confirmation, true après, normalisation,
 *    expiration à 30 jours
 *  - sanitizeNext : filtre anti open-redirect réel de login/ + verify-otp/
 */

"use strict";

const { test, describe, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

// ── Source de production (pas de miroir) ──

/** Valeurs d'origine, restaurées en `after()`. */
const savedEnv = {};
let verifyEmail;
let authUi;

/**
 * Force le fallback MÉMOIRE : sans ces variables, `getRedis()` renvoie null et
 * le store mémoire prend le relais — seul chemin déterministe sans service
 * externe. Refait dans `beforeEach` (et pas seulement au top-level) car tsx
 * charge `.env` à la PREMIÈRE résolution de module : le fichier `.env` du repo
 * définit `KV_REST_API_URL`/`KV_REST_API_TOKEN`, et il lèverait après le
 * top-level du fichier de test.
 */
function forceMemoryStore() {
  for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
    savedEnv[k] = savedEnv[k] ?? process.env[k];
    delete process.env[k];
  }
}

before(async () => {
  verifyEmail = await import("../src/lib/verify-email.ts");
  authUi = await import("../src/lib/auth-ui.ts");
  forceMemoryStore();
});

beforeEach(() => {
  forceMemoryStore();
});

after(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/**
 * Avance l'horloge de `ms` avant d'exécuter `fn`, puis restaure l'horloge réelle.
 * Seule l'API `Date` est simulée : ni les timers ni `randomBytes` ne sont touchés.
 */
async function withFakeClock(ms, fn) {
  mock.timers.enable({ apis: ["Date"], now: Date.now() });
  try {
    mock.timers.tick(ms);
    return await fn();
  } finally {
    mock.timers.reset();
  }
}

/** Snapshot/restore des 2 variables d'URL, pour tester chaque branche. */
function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 1) verify-email — buildVerifyUrl (source réelle)
// ═══════════════════════════════════════════════════════════════════

describe("verify-email: buildVerifyUrl (source réelle)", () => {
  test("utilise NEXT_PUBLIC_SITE_URL quand elle est définie", () => {
    const url = withEnv(
      { NEXT_PUBLIC_SITE_URL: "https://example.com", NEXT_PUBLIC_URL: undefined },
      () => verifyEmail.buildVerifyUrl("abc123"),
    );
    assert.equal(url, "https://example.com/verify-email?token=abc123");
  });

  test("retire le slash final du base", () => {
    const url = withEnv(
      { NEXT_PUBLIC_SITE_URL: "https://example.com/", NEXT_PUBLIC_URL: undefined },
      () => verifyEmail.buildVerifyUrl("tok"),
    );
    assert.equal(url, "https://example.com/verify-email?token=tok");
  });

  test("replie sur NEXT_PUBLIC_URL si SITE_URL est absente", () => {
    const url = withEnv(
      { NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_URL: "https://fallback.com" },
      () => verifyEmail.buildVerifyUrl("x"),
    );
    assert.equal(url, "https://fallback.com/verify-email?token=x");
  });

  test("replie sur l'URL de production si les deux sont absentes", () => {
    const url = withEnv(
      { NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_URL: undefined },
      () => verifyEmail.buildVerifyUrl("y"),
    );
    assert.equal(url, "https://reboot.joinhashcode.com/verify-email?token=y");
  });

  test("URL-encode le token", () => {
    const url = withEnv(
      { NEXT_PUBLIC_SITE_URL: "https://x.com", NEXT_PUBLIC_URL: undefined },
      () => verifyEmail.buildVerifyUrl("a/b+c"),
    );
    assert.ok(url.includes("token=a%2Fb%2Bc"), url);
  });

  test("le lien est toujours absolu (jamais localhost en prod)", () => {
    const url = withEnv(
      { NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_URL: undefined },
      () => verifyEmail.buildVerifyUrl("z"),
    );
    assert.ok(url.startsWith("https://"), url);
    assert.doesNotThrow(() => new URL(url));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2) verify-email — flux complet sur le fallback mémoire (source réelle)
// ═══════════════════════════════════════════════════════════════════

describe("verify-email: requestEmailLink (fallback mémoire)", () => {
  test("le store mémoire est bien celui utilisé (pas de Redis)", () => {
    // Garde-fou : `.env` du repo définit KV_REST_API_URL/KV_REST_API_TOKEN. Si
    // ils ne sont pas neutralisés, les tests suivants écriraient dans le vrai
    // Upstash et couvriraient la branche Redis au lieu du repli mémoire.
    assert.equal(process.env.KV_REST_API_URL, undefined);
    assert.equal(process.env.KV_REST_API_TOKEN, undefined);
  });

  test("renvoie ok=true et un token exploitable", async () => {
    const r = await verifyEmail.requestEmailLink("token-shape@example.com");
    assert.equal(r.ok, true);
    assert.equal(typeof r.token, "string");
    assert.ok(r.token.length >= 16, `token trop court : ${r.token.length}`);
    // randomBytes(32).toString("base64url") → alphabet URL-safe, sans "=".
    assert.match(r.token, /^[A-Za-z0-9_-]+$/);
    // Le token produit est directement acceptable par confirmEmailLink.
    const c = await verifyEmail.confirmEmailLink(r.token);
    assert.deepEqual(c, { ok: true, email: "token-shape@example.com" });
  });

  test("normalise l'email (trim + minuscule) — prouvé par la confirmation", async () => {
    const r = await verifyEmail.requestEmailLink("  Norm.Email@Example.COM  ");
    assert.equal(r.ok, true);
    // Le lien est indexé sur l'email normalisé : c'est lui qui ressort.
    const c = await verifyEmail.confirmEmailLink(r.token);
    assert.deepEqual(c, { ok: true, email: "norm.email@example.com" });
  });

  test("bloque un second envoi pendant le cooldown", async () => {
    const first = await verifyEmail.requestEmailLink("cooldown@example.com");
    assert.equal(first.ok, true);
    const second = await verifyEmail.requestEmailLink("cooldown@example.com");
    assert.equal(second.ok, false);
    assert.equal(second.token, "", "aucun token ne doit être émis pendant le cooldown");
    assert.equal(typeof second.cooldownSec, "number");
    assert.ok(second.cooldownSec > 0 && second.cooldownSec <= 60, String(second.cooldownSec));
  });

  test("après le cooldown : nouveau token ET ancien lien invalidé", async () => {
    const first = await verifyEmail.requestEmailLink("resend@example.com");
    assert.equal(first.ok, true);

    const second = await withFakeClock(61_000, () =>
      verifyEmail.requestEmailLink("resend@example.com"),
    );
    assert.equal(second.ok, true);
    assert.notEqual(second.token, first.token, "un nouveau lien doit être émis");

    // L'ancien lien est purgé : il ne marche plus.
    assert.deepEqual(await verifyEmail.confirmEmailLink(first.token), {
      ok: false,
      reason: "expired",
    });
    // Le nouveau, lui, fonctionne.
    assert.deepEqual(await verifyEmail.confirmEmailLink(second.token), {
      ok: true,
      email: "resend@example.com",
    });
  });

  test("deux emails différents obtiennent des liens indépendants", async () => {
    const a = await verifyEmail.requestEmailLink("indep-a@example.com");
    const b = await verifyEmail.requestEmailLink("indep-b@example.com");
    assert.equal(a.ok && b.ok, true);
    assert.notEqual(a.token, b.token);

    assert.deepEqual(await verifyEmail.confirmEmailLink(a.token), {
      ok: true,
      email: "indep-a@example.com",
    });
    // Confirmer A ne vérifie pas B.
    assert.equal(await verifyEmail.isEmailVerified("indep-a@example.com"), true);
    assert.equal(await verifyEmail.isEmailVerified("indep-b@example.com"), false);
  });
});

describe("verify-email: confirmEmailLink", () => {
  test("rejette un token vide, absent ou trop court (< 16 caractères)", async () => {
    const invalid = { ok: false, reason: "invalid" };
    assert.deepEqual(await verifyEmail.confirmEmailLink(""), invalid);
    assert.deepEqual(await verifyEmail.confirmEmailLink("   "), invalid);
    assert.deepEqual(await verifyEmail.confirmEmailLink(null), invalid);
    assert.deepEqual(await verifyEmail.confirmEmailLink(undefined), invalid);
    assert.deepEqual(await verifyEmail.confirmEmailLink("short"), invalid);
    assert.deepEqual(await verifyEmail.confirmEmailLink("x".repeat(15)), invalid);
  });

  test("frontière de longueur : 16 caractères passe le filtre puis → expired", async () => {
    // 16 = longueur minimale acceptée : le token est bien formé pour le code,
    // il n'est simplement pas dans le store → "expired", pas "invalid".
    assert.deepEqual(await verifyEmail.confirmEmailLink("x".repeat(16)), {
      ok: false,
      reason: "expired",
    });
  });

  test("token inconnu mais bien formé → expired", async () => {
    assert.deepEqual(
      await verifyEmail.confirmEmailLink("unknown-token-xxxxxxxxxxxxxxxx"),
      { ok: false, reason: "expired" },
    );
  });

  test("confirmation réussie, puis rejeu refusé (usage unique)", async () => {
    const r = await verifyEmail.requestEmailLink("single-use@example.com");
    assert.equal(r.ok, true);

    assert.deepEqual(await verifyEmail.confirmEmailLink(r.token), {
      ok: true,
      email: "single-use@example.com",
    });
    // Rejeu du même lien : refusé.
    assert.deepEqual(await verifyEmail.confirmEmailLink(r.token), {
      ok: false,
      reason: "expired",
    });
  });

  test("la confirmation marque l'email comme vérifié", async () => {
    const r = await verifyEmail.requestEmailLink("marked@example.com");
    assert.equal(await verifyEmail.isEmailVerified("marked@example.com"), false);
    await verifyEmail.confirmEmailLink(r.token);
    assert.equal(await verifyEmail.isEmailVerified("marked@example.com"), true);
  });
});

describe("verify-email: isEmailVerified", () => {
  test("false pour un email jamais demandé", async () => {
    assert.equal(await verifyEmail.isEmailVerified("jamais@example.com"), false);
  });

  test("true après confirmation", async () => {
    const r = await verifyEmail.requestEmailLink("verified@example.com");
    await verifyEmail.confirmEmailLink(r.token);
    assert.equal(await verifyEmail.isEmailVerified("verified@example.com"), true);
  });

  test("normalise l'email (casse + espaces)", async () => {
    const r = await verifyEmail.requestEmailLink("Case@Test.com");
    await verifyEmail.confirmEmailLink(r.token);
    assert.equal(await verifyEmail.isEmailVerified("  CASE@test.COM  "), true);
  });

  test("false après 30 jours (expiration du flag, TTL réel)", async () => {
    const email = "ttl@example.com";
    const r = await verifyEmail.requestEmailLink(email);
    await verifyEmail.confirmEmailLink(r.token);
    assert.equal(await verifyEmail.isEmailVerified(email), true);

    await withFakeClock(30 * 24 * 60 * 60 * 1000 + 1_000, async () => {
      assert.equal(await verifyEmail.isEmailVerified(email), false);
    });
  });
});

describe("verify-email: flux complet (request → confirm → verified)", () => {
  test("le flux passe par toutes les étapes", async () => {
    const email = "flow@example.com";

    const r = await verifyEmail.requestEmailLink(email);
    assert.equal(r.ok, true);

    assert.deepEqual(await verifyEmail.confirmEmailLink(r.token), {
      ok: true,
      email,
    });
    assert.equal(await verifyEmail.isEmailVerified(email), true);

    // D34 — après consommation du lien, un renvoi ne produit PLUS un cooldown.
    //
    // Avant D34, ce test affirmait `cooldownSec > 0` : l'utilisateur déjà
    // vérifié recevait un 429 « réessaie dans 60 s » alors qu'aucun envi n'a
    // lieu et qu'aucune attente n'a de sens. `requestEmailLink` court-circuite
    // désormais sur le flag et signale `alreadyVerified`.
    //
    // Le cooldown reste vérifié séparément, sur une adresse NON vérifiée —
    // c'est le cas qui a du sens.
    const again = await verifyEmail.requestEmailLink(email);
    assert.equal(again.ok, false);
    assert.equal(again.alreadyVerified, true, "le flag doit être lu, pas ignoré");
    assert.equal(
      again.cooldownSec ?? null,
      null,
      "un email déjà vérifié ne doit pas être présenté comme une attente",
    );

    // Le cooldown de 60 s reste actif pour une adresse non vérifiée.
    const fresh = `cooldown-${Date.now()}-${Math.random()}@example.test`;
    const first = await verifyEmail.requestEmailLink(fresh);
    assert.equal(first.ok, true);
    const second = await verifyEmail.requestEmailLink(fresh);
    assert.equal(second.ok, false);
    assert.equal(second.alreadyVerified, undefined);
    assert.ok(second.cooldownSec > 0, "le cooldown doit rester actif");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3) sanitize-next — filtre anti open-redirect (src/lib/auth-ui.ts)
// ═══════════════════════════════════════════════════════════════════

describe("sanitizeNext: open-redirect filter (source réelle)", () => {
  // Utilisé par `src/app/[locale]/login/page.tsx:16` et
  // `src/app/[locale]/verify-otp/page.tsx:21` — le miroir dupliquait la règle
  // dans les deux pages sans la tester.
  test("accepte les chemins internes starting with /", () => {
    const { sanitizeNext } = authUi;
    assert.equal(sanitizeNext("/account"), "/account");
    assert.equal(sanitizeNext("/dashboard"), "/dashboard");
    assert.equal(sanitizeNext("/admin/stats"), "/admin/stats");
    assert.equal(sanitizeNext("/some/deep/path"), "/some/deep/path");
  });

  test("rejette les URLs protocol-relative (//evil.com)", () => {
    const { sanitizeNext } = authUi;
    assert.equal(sanitizeNext("//evil.com"), "/dashboard");
    assert.equal(sanitizeNext("//evil.com/steal"), "/dashboard");
  });

  test("rejette les URLs absolues", () => {
    const { sanitizeNext } = authUi;
    assert.equal(sanitizeNext("https://evil.com"), "/dashboard");
    assert.equal(sanitizeNext("http://evil.com"), "/dashboard");
    assert.equal(sanitizeNext("ftp://evil.com"), "/dashboard");
  });

  test("replie sur /dashboard pour vide/null/undefined", () => {
    const { sanitizeNext } = authUi;
    assert.equal(sanitizeNext(null), "/dashboard");
    assert.equal(sanitizeNext(""), "/dashboard");
    assert.equal(sanitizeNext(undefined), "/dashboard");
  });

  test("accepte les chemins avec query params", () => {
    const { sanitizeNext } = authUi;
    assert.equal(
      sanitizeNext("/verify-otp?email=x&code=123"),
      "/verify-otp?email=x&code=123",
    );
  });

  test("la destination par défaut est bien /dashboard (constante partagée)", () => {
    assert.equal(authUi.DEFAULT_NEXT, "/dashboard");
  });
});
