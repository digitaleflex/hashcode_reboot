/**
 * Unit tests — garde anti-blacklist (src/lib/blacklist.ts + 3 couches auth).
 * No server required (Prisma n'ouvre aucune connexion : seuls les appels
 * `findUnique`/`upsert`/`delete` sont remplacés par des doublures en mémoire).
 *
 * Run:  node --import tsx --test tests/blacklist.test.cjs
 *
 * D18 — ce fichier n'IMPORTE PLUS AUCUN MIROIR. Il exécute la vraie source :
 *   - src/lib/blacklist.ts     → normalizeEmail, isEmailBlacklisted,
 *                                addToBlacklist, removeFromBlacklist
 *   - src/lib/auth/index.ts    → databaseHooks.session.create.before (couche 2)
 *                                + plugin emailOTP `sendVerificationOTP` (couche 1)
 *   - src/lib/account-auth.ts  → getSession (couche 3)
 *
 * Frontière stubée (et elle seule) : les méthodes du client Prisma
 * (`user`/`member`/`memberBlacklist`/`emailEvent`) et `auth.api.getSession`. Le
 * repo n'a pas de helper de mock — l'ancien en-tête le constatait et se
 * rabattait sur des miroirs ; ici une doublure minimale est posée en
 * `beforeEach` et entièrement restaurée en `after()`. Aucune décision de
 * sécurité n'est réimplémentée : normalisation, expiration et les trois portes
 * sont exécutées par le code de production. Une régression dans
 * `src/lib/auth/index.ts:68-75` ou `:82-101`, ou dans
 * `src/lib/account-auth.ts:47-60`, échoue ici.
 *
 * Preuve de l'absence d'email (couche 1) : `sendMagicLinkEmail` → `sendEmail`
 * → `fetch` (Resend). `globalThis.fetch` est remplacé par un spy et
 * `RESEND_API_KEY`/`EMAIL_FROM` sont mis à des valeurs factices SANS LESQUELLES
 * `sendEmail` court-circuiterait avant le réseau et le spy ne prouverait rien.
 * 0 appel = aucun email n'est parti.
 *
 * NON testé ici (et pour cause, pas de faux test) :
 *  - la persistance Prisma réelle : les requêtes sont doublées, seul l'ARGUMENT
 *    envoyé à Prisma est vérifié (email normalisé, note tronquée…). Le round-trip
 *    Postgres (upsert/delete/lecture + index) n'est pas couvert par ce fichier et
 *    ne l'est nulle part ailleurs : c'est un manque à combler côté intégration.
 *  - le SQL de `getBlacklist` (listing admin) : aucun risque de garde.
 *
 * Coverage:
 *  - normalizeEmail : trim + minuscule, refus hors 254 caractères
 *  - isEmailBlacklisted : absent → null ; permanent/futur/now → entrée ;
 *    passé → null ; email normalisé avant la requête
 *  - addToBlacklist : email/raison invalides → throw AVANT écriture ; raison vide
 *    → "other" ; note tronquée à 500 caractères
 *  - removeFromBlacklist : email invalide → no-op ; erreur DB → no-op
 *  - couche 1 : sain → 1 envoi ; blacklisté → 0 ; inconnu → 0 ; expiré → 1
 *  - couche 2 : blacklisté → false ; user sans email → false ; sain → undefined ;
 *    expiré → undefined ; erreur DB → exception (fail-closed)
 *  - couche 3 : blacklisté → null ; expiré → session ; supprimé → null ;
 *    pas de session → null ; erreur DB → null ; hors runtime Next → null
 */

"use strict";

const { test, describe, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

// betterAuth() lit ces variables à l'instanciation (comme le fait
// tests/auth-signup-guard.test.cjs). Aucune connexion DB n'est ouverte.
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "blacklist-test-secret-at-least-32-characters-long";
process.env.BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL || "http://localhost:3000";

// ── Environnement mail : l'envoi doit être OBSERVABLE ──
// `category: "code"` route vers Resend en primary ; si EMAIL_PROVIDER vaut
// "brevo" ou si le fallback 429 est actif, le compteur d'appels fetch change et
// le test « 1 envoi » deviendrait faux pour une raison étrangère au sujet.
//
// ⚠️ tsx charge `.env` à la PREMIÈRE résolution de module, donc pendant le
// `before()` ci-dessous — bien après le top-level de ce fichier. La mise en
// scène est donc refaite dans `beforeEach()`, au dernier moment. Sans ça,
// `.env` (qui contient EMAIL_PROVIDER=brevo et de vraies clés) gagnerait.
/** Valeurs d'origine, capturées après le chargement de `.env`. */
let savedMailEnv = {};

function stageMailEnv() {
  savedMailEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    BREVO_FALLBACK_ON_429: process.env.BREVO_FALLBACK_ON_429,
  };
  delete process.env.EMAIL_PROVIDER;
  delete process.env.BREVO_FALLBACK_ON_429;
  // Clés factices : sans elles `sendEmail` court-circuiterait avant le réseau et
  // le spy ne prouverait rien. Elles ne partent pas : `fetch` est un spy.
  process.env.RESEND_API_KEY = "re_blacklist_test_fake";
  process.env.EMAIL_FROM = "no-reply@test.invalid";
}

// ── Source de production ──

let db;
let blacklist;
let accountAuth;
let auth;
let sessionCreateBefore;
let sendVerificationOTP;

/** Méthodes Prisma d'origine, restaurées en `after()`. */
const realPrisma = {};
/** Journal des appels DB du test courant. */
let calls;
/** Appels `fetch` (spy réseau) du test courant. */
let fetchCalls;
/** `globalThis.fetch` d'origine, restauré en `after()`. */
const realFetch = globalThis.fetch;

const MEMBER = {
  id: "m1",
  email: "ok@example.com",
  firstName: "Awa",
  deletedAt: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
};

/**
 * Pose les doublures Prisma : seules les requêtes réellement utilisées par la
 * source sont doublées, tout le reste est laissé tel quel.
 */
function useFakeDb({
  user = null,
  member = null,
  blacklistRow = null,
  blacklistError = null,
  deleteError = null,
} = {}) {
  db.user.findUnique = async (args) => {
    calls.user.push(args);
    return user;
  };
  db.member.findUnique = async (args) => {
    calls.member.push(args);
    return member;
  };
  db.memberBlacklist.findUnique = async (args) => {
    calls.blacklist.push(args);
    if (blacklistError) throw blacklistError;
    return blacklistRow;
  };
  db.memberBlacklist.upsert = async (args) => {
    calls.upsert.push(args);
    return { id: "bl1", email: args.where.email };
  };
  db.memberBlacklist.delete = async (args) => {
    calls.delete.push(args);
    if (deleteError) throw deleteError;
    return { count: 1 };
  };
  db.emailEvent.create = async () => ({});
}

before(async () => {
  db = (await import("../src/lib/db.ts")).db;
  blacklist = await import("../src/lib/blacklist.ts");
  accountAuth = await import("../src/lib/account-auth.ts");

  const { auth: betterAuthInstance } = await import("../src/lib/auth/index.ts");
  auth = betterAuthInstance;
  const ctx = await auth.$context;

  // Couche 2 : le hook est un callback, pas une fonction nommée — on le prend
  // dans la config Better Auth réellement instanciée.
  sessionCreateBefore = ctx.options.databaseHooks.session.create.before;
  assert.equal(
    typeof sessionCreateBefore,
    "function",
    "databaseHooks.session.create.before a disparu de src/lib/auth/index.ts : le coupe-circuit anti-blacklist n'est plus installé",
  );

  // Couche 1 : `sendVerificationOTP` est une option du plugin emailOTP, exposée
  // par le plugin lui-même (`ctx.options.emailOTP` n'existe pas).
  const otpPlugin = ctx.options.plugins.find((p) => p.id === "email-otp");
  assert.ok(otpPlugin, "le plugin email-otp n'est plus enregistré dans src/lib/auth/index.ts");
  sendVerificationOTP = otpPlugin.options.sendVerificationOTP;
  assert.equal(
    typeof sendVerificationOTP,
    "function",
    "emailOTP({ sendVerificationOTP }) a disparu : aucun filtre blacklist à l'envoi du code",
  );

  realPrisma.userFindUnique = db.user.findUnique;
  realPrisma.memberFindUnique = db.member.findUnique;
  realPrisma.blacklistFindUnique = db.memberBlacklist.findUnique;
  realPrisma.blacklistUpsert = db.memberBlacklist.upsert;
  realPrisma.blacklistDelete = db.memberBlacklist.delete;
  realPrisma.emailEventCreate = db.emailEvent.create;
  realPrisma.authApiGetSession = auth.api.getSession;
});

beforeEach(() => {
  stageMailEnv();
  calls = { user: [], member: [], blacklist: [], upsert: [], delete: [] };
  fetchCalls = [];
  useFakeDb();

  // Spy réseau : enregistre le destinataire de chaque envoi et répond 200.
  // `sendEmail` ne lève jamais → `sendVerificationOTP` reste silencieux.
  // ⚠️ Ce spy est aussi une sécurité : aucune requête ne sort réellement, même
  // si `.env` contient de vraies clés Resend/Brevo.
  globalThis.fetch = async (url, init) => {
    let to = null;
    try {
      const parsed = JSON.parse(init?.body ?? "{}");
      const first = Array.isArray(parsed.to) ? parsed.to[0] : null;
      // Resend envoie `to: ["a@b.co"]`, Brevo `to: [{ email }]`.
      to = typeof first === "string" ? first : (first?.email ?? null);
    } catch {
      to = null;
    }
    fetchCalls.push({ url: String(url), to });
    return new Response(JSON.stringify({ id: "fake-email-id" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
});

after(() => {
  db.user.findUnique = realPrisma.userFindUnique;
  db.member.findUnique = realPrisma.memberFindUnique;
  db.memberBlacklist.findUnique = realPrisma.blacklistFindUnique;
  db.memberBlacklist.upsert = realPrisma.blacklistUpsert;
  db.memberBlacklist.delete = realPrisma.blacklistDelete;
  db.emailEvent.create = realPrisma.emailEventCreate;
  auth.api.getSession = realPrisma.authApiGetSession;
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(savedMailEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

/** Fige `Date` sur `T`, exécute `fn`, puis restaure l'horloge réelle. */
async function withFrozenClock(T, fn) {
  mock.timers.enable({ apis: ["Date"], now: T });
  try {
    return await fn();
  } finally {
    mock.timers.reset();
  }
}

/** Requête falsifiée, au format attendu par Better Auth. */
const REQ = { headers: new Headers({ cookie: "better-auth.session_token=fake" }) };

/** Session Better Auth falsifiée pour `email`. */
function fakeAuthSession(email) {
  return {
    session: {
      id: "s1",
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      ipAddress: "203.0.113.7",
      userAgent: "blacklist-test",
    },
    user: { email },
  };
}

/** Branche `auth.api.getSession` (dernière frontière stubbée, couche 3). */
function stubBetterAuthSession(impl) {
  auth.api.getSession = impl;
}

// ═══════════════════════════════════════════════════════════════════
// 1) src/lib/blacklist.ts — normalizeEmail
// ═══════════════════════════════════════════════════════════════════

describe("blacklist: normalizeEmail (source réelle)", () => {
  test("trim + minuscule", () => {
    assert.equal(blacklist.normalizeEmail("  Foo@Bar.COM  "), "foo@bar.com");
    assert.equal(blacklist.normalizeEmail("MiXeD@ExAmPlE.Co"), "mixed@example.co");
  });

  test("refuse un email mal formé (throw)", () => {
    for (const bad of ["", "   ", "pas-un-email", "a@b", "@b.co", "a b@c.co"]) {
      assert.throws(() => blacklist.normalizeEmail(bad), /Email invalide/, `accepte à tort : ${JSON.stringify(bad)}`);
    }
  });

  test("refuse un email trop long (> 254 caractères)", () => {
    const long = `${"a".repeat(250)}@b.co`;
    assert.throws(() => blacklist.normalizeEmail(long), /trop long/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2) src/lib/blacklist.ts — isEmailBlacklisted (décision d'expiration)
// ═══════════════════════════════════════════════════════════════════

describe("blacklist: isEmailBlacklisted (source réelle)", () => {
  test("email invalide → null, sans requête DB", async () => {
    assert.equal(await blacklist.isEmailBlacklisted("pas-un-email"), null);
    assert.equal(calls.blacklist.length, 0, "un email invalide ne doit pas atteindre la DB");
  });

  test("absent de la blacklist → null", async () => {
    useFakeDb({ blacklistRow: null });
    assert.equal(await blacklist.isEmailBlacklisted("inconnu@example.com"), null);
    assert.equal(calls.blacklist.length, 1);
  });

  test("entrée permanente (expiresAt null) → l'entrée, donc bloqué", async () => {
    const row = { reason: "spammer", expiresAt: null };
    useFakeDb({ blacklistRow: row });
    assert.deepEqual(await blacklist.isEmailBlacklisted("permanent@example.com"), row);
  });

  test("entrée future → l'entrée, donc bloqué", async () => {
    const T = Date.parse("2026-06-01T12:00:00.000Z");
    const row = { reason: "abuser", expiresAt: new Date(T + 60_000) };
    useFakeDb({ blacklistRow: row });
    await withFrozenClock(T, async () => {
      assert.deepEqual(await blacklist.isEmailBlacklisted("futur@example.com"), row);
    });
  });

  test("entrée expirée (passée) → null, donc NON bloqué", async () => {
    const T = Date.parse("2026-06-01T12:00:00.000Z");
    useFakeDb({
      blacklistRow: { reason: "abuser", expiresAt: new Date(T - 1) },
    });
    await withFrozenClock(T, async () => {
      assert.equal(await blacklist.isEmailBlacklisted("expire@example.com"), null);
    });
  });

  test("frontière expiresAt === now → BLOQUÉ (comparaison < stricte)", async () => {
    const T = Date.parse("2026-06-01T12:00:00.000Z");
    const row = { reason: "admin", expiresAt: new Date(T) };
    useFakeDb({ blacklistRow: row });
    await withFrozenClock(T, async () => {
      assert.deepEqual(await blacklist.isEmailBlacklisted("frontiere@example.com"), row);
    });
  });

  test("normalise l'email avant la requête (index @unique)", async () => {
    useFakeDb({ blacklistRow: null });
    await blacklist.isEmailBlacklisted("  MiXeD@ExAmPlE.Co  ");
    assert.equal(calls.blacklist[0].where.email, "mixed@example.co");
  });

  test("les raisons autorisées sont celles de la source", () => {
    assert.deepEqual([...blacklist.BLACKLIST_REASONS], [
      "spammer",
      "harassment",
      "duplicate",
      "abuser",
      "admin",
      "other",
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3) src/lib/blacklist.ts — addToBlacklist / removeFromBlacklist
// ═══════════════════════════════════════════════════════════════════

describe("blacklist: addToBlacklist (source réelle)", () => {
  test("email invalide → throw AVANT toute écriture", async () => {
    await assert.rejects(
      () => blacklist.addToBlacklist({ email: "nope", reason: "spammer" }),
      /Email invalide/,
    );
    assert.equal(calls.upsert.length, 0, "rien ne doit être écrit si la validation échoue");
  });

  test("raison inconnue → throw AVANT toute écriture", async () => {
    await assert.rejects(
      () => blacklist.addToBlacklist({ email: "a@b.co", reason: "pas-une-raison" }),
      /Raison invalide/,
    );
    assert.equal(calls.upsert.length, 0);
  });

  test("raison vide → 'other' (valeur par défaut, upsert idempotent)", async () => {
    useFakeDb();
    const row = await blacklist.addToBlacklist({ email: " Defaut@Example.COM ", reason: "" });
    assert.deepEqual(row, { id: "bl1", email: "defaut@example.com" });
    assert.equal(calls.upsert[0].create.reason, "other");
    assert.equal(calls.upsert[0].create.autoAdded, false);
  });

  test("note tronquée à 500 caractères", async () => {
    useFakeDb();
    await blacklist.addToBlacklist({
      email: "note@example.com",
      reason: "admin",
      note: "x".repeat(600),
    });
    assert.equal(calls.upsert[0].create.note.length, 500);
  });

  test("autoAdded est mémorisé quand il est fourni", async () => {
    useFakeDb();
    await blacklist.addToBlacklist({
      email: "auto@example.com",
      reason: "spammer",
      autoAdded: true,
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    assert.equal(calls.upsert[0].create.autoAdded, true);
    assert.deepEqual(calls.upsert[0].create.expiresAt, new Date("2027-01-01T00:00:00.000Z"));
  });
});

describe("blacklist: removeFromBlacklist (source réelle)", () => {
  test("email invalide → no-op, sans requête DB", async () => {
    assert.deepEqual(await blacklist.removeFromBlacklist("nope"), { removed: false });
    assert.equal(calls.delete.length, 0);
  });

  test("suppression effective → removed: true", async () => {
    useFakeDb();
    assert.deepEqual(await blacklist.removeFromBlacklist(" Sorti@Example.COM "), {
      removed: true,
    });
    assert.equal(calls.delete[0].where.email, "sorti@example.com");
  });

  test("erreur DB (ligne absente) → removed: false, pas d'exception", async () => {
    useFakeDb({ deleteError: new Error("Record to delete does not exist.") });
    assert.deepEqual(await blacklist.removeFromBlacklist("absent@example.com"), {
      removed: false,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4) Couche 1 — plugin emailOTP `sendVerificationOTP` (silence)
// ═══════════════════════════════════════════════════════════════════

describe("couche 1: sendVerificationOTP (silence anti-énumération)", () => {
  test("membre sain, non blacklisté → 1 email envoyé au bon destinataire", async () => {
    useFakeDb({ member: MEMBER, blacklistRow: null });
    await sendVerificationOTP({ email: MEMBER.email, otp: "123456", type: "sign-in" });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].to, MEMBER.email);
  });

  test("membre blacklisté → AUCUN email (silence)", async () => {
    useFakeDb({
      member: MEMBER,
      blacklistRow: { reason: "spammer", expiresAt: null },
    });
    await sendVerificationOTP({ email: MEMBER.email, otp: "123456", type: "sign-in" });
    assert.deepEqual(fetchCalls, [], "un email blacklisté ne doit jamais recevoir d'OTP");
  });

  test("email inconnu → AUCUN email, traitement identique au blacklisté", async () => {
    useFakeDb({ member: null, blacklistRow: null });
    await sendVerificationOTP({ email: "ghost@example.com", otp: "123456", type: "sign-in" });
    assert.deepEqual(fetchCalls, []);
  });

  test("les trois cas renvoient la même valeur (aucun signal distinctif)", async () => {
    // Anti-énumération : la sortie de la fonction ne doit distinguer ni le
    // membre inconnu du blacklisté.
    useFakeDb({ member: null, blacklistRow: null });
    const unknown = await sendVerificationOTP({
      email: "ghost2@example.com",
      otp: "123456",
      type: "sign-in",
    });

    useFakeDb({
      member: MEMBER,
      blacklistRow: { reason: "spammer", expiresAt: null },
    });
    const blacklisted = await sendVerificationOTP({
      email: MEMBER.email,
      otp: "123456",
      type: "sign-in",
    });

    assert.equal(blacklisted, unknown);
    assert.equal(blacklisted, undefined);
  });

  test("entrée expirée → l'OTP repart (non bloqué à tort)", async () => {
    const T = Date.parse("2026-06-01T12:00:00.000Z");
    useFakeDb({
      member: MEMBER,
      blacklistRow: { reason: "duplicate", expiresAt: new Date(T - 1) },
    });
    await withFrozenClock(T, async () => {
      await sendVerificationOTP({ email: MEMBER.email, otp: "123456", type: "sign-in" });
    });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].to, MEMBER.email);
  });

  test("la consultation de la blacklist a bien lieu pour un membre connu", async () => {
    // Garde-fou anti-régression : si la ligne `if (await isEmailBlacklisted(...))`
    // disparaissait, aucun appel blacklist ne serait fait et ce test le voit.
    useFakeDb({ member: MEMBER, blacklistRow: null });
    await sendVerificationOTP({ email: MEMBER.email, otp: "123456", type: "sign-in" });
    assert.equal(calls.blacklist.length, 1);
    assert.equal(calls.blacklist[0].where.email, MEMBER.email);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5) Couche 2 — databaseHooks.session.create.before
// ═══════════════════════════════════════════════════════════════════

describe("couche 2: databaseHooks session create.before", () => {
  test("email blacklisté → false (session non créée)", async () => {
    useFakeDb({
      user: { email: "bad@example.com" },
      blacklistRow: { reason: "harassment", expiresAt: null },
    });
    assert.equal(await sessionCreateBefore({ userId: "u1" }), false);
  });

  test("userId sans email connu → false (pas de session orpheline)", async () => {
    useFakeDb({ user: null });
    assert.equal(await sessionCreateBefore({ userId: "inconnu" }), false);

    useFakeDb({ user: { email: null } });
    assert.equal(await sessionCreateBefore({ userId: "sans-email" }), false);
  });

  test("email sain → undefined (autorise, ne bloque pas)", async () => {
    useFakeDb({ user: { email: "ok@example.com" }, blacklistRow: null });
    assert.equal(await sessionCreateBefore({ userId: "u2" }), undefined);
  });

  test("entrée expirée → undefined (session autorisée)", async () => {
    const T = Date.parse("2026-06-01T12:00:00.000Z");
    useFakeDb({
      user: { email: "ok@example.com" },
      blacklistRow: { reason: "other", expiresAt: new Date(T - 1) },
    });
    await withFrozenClock(T, async () => {
      assert.equal(await sessionCreateBefore({ userId: "u3" }), undefined);
    });
  });

  test("erreur DB → l'exception REMONTE (fail-closed : aucune session)", async () => {
    // Le user doit exister : le hook résout l'email AVANT de lire la blacklist,
    // donc c'est la lecture blacklist qui doit faire remonter l'erreur.
    useFakeDb({
      user: { email: "ok@example.com" },
      blacklistError: new Error("DB indisponible"),
    });
    await assert.rejects(
      () => sessionCreateBefore({ userId: "u4" }),
      /DB indisponible/,
      "le hook ne doit jamais avaler une erreur DB : Better Auth créerait la session",
    );
  });

  test("l'email est normalisé avant la consultation de la blacklist", async () => {
    useFakeDb({
      user: { email: "  MiXeD@ExAmPlE.Co " },
      blacklistRow: null,
    });
    await sessionCreateBefore({ userId: "u5" });
    assert.equal(calls.blacklist[0].where.email, "mixed@example.co");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6) Couche 3 — account-auth.getSession
// ═══════════════════════════════════════════════════════════════════

describe("couche 3: getSession (tue les sessions pré-blacklistage)", () => {
  test("membre sain → session de forme historique préservée", async () => {
    stubBetterAuthSession(async () => fakeAuthSession(MEMBER.email));
    useFakeDb({ member: MEMBER, blacklistRow: null });

    const session = await accountAuth.getSession(REQ);
    assert.ok(session, "une session saine doit être renvoyée");
    assert.equal(session.memberId, "m1");
    assert.equal(session.member, MEMBER);
    assert.equal(session.id, "s1");
    assert.equal(session.otpHash, null);
    assert.equal(session.revokedAt, null);
    assert.equal(session.ip, "203.0.113.7");
    assert.equal(session.userAgent, "blacklist-test");
  });

  test("blacklisté → null (session coupée même avec un cookie valide)", async () => {
    stubBetterAuthSession(async () => fakeAuthSession(MEMBER.email));
    useFakeDb({
      member: MEMBER,
      blacklistRow: { reason: "spammer", expiresAt: null },
    });
    assert.equal(await accountAuth.getSession(REQ), null);
  });

  test("entrée expirée → session préservée (NON bloquée)", async () => {
    const T = Date.parse("2026-06-01T12:00:00.000Z");
    stubBetterAuthSession(async () => fakeAuthSession(MEMBER.email));
    useFakeDb({
      member: MEMBER,
      blacklistRow: { reason: "abuser", expiresAt: new Date(T - 1) },
    });
    const session = await withFrozenClock(T, () => accountAuth.getSession(REQ));
    assert.ok(session);
    assert.equal(session.memberId, "m1");
  });

  test("membre supprimé (deletedAt) → null", async () => {
    stubBetterAuthSession(async () => fakeAuthSession(MEMBER.email));
    useFakeDb({
      member: { ...MEMBER, deletedAt: new Date("2026-07-01T00:00:00.000Z") },
      blacklistRow: null,
    });
    assert.equal(await accountAuth.getSession(REQ), null);
  });

  test("membre absent en base → null", async () => {
    stubBetterAuthSession(async () => fakeAuthSession("fantome@example.com"));
    useFakeDb({ member: null, blacklistRow: null });
    assert.equal(await accountAuth.getSession(REQ), null);
  });

  test("pas de session Better Auth → null", async () => {
    stubBetterAuthSession(async () => null);
    useFakeDb({ member: MEMBER, blacklistRow: null });
    assert.equal(await accountAuth.getSession(REQ), null);
  });

  test("session Better Auth en erreur → null (pas d'exception)", async () => {
    stubBetterAuthSession(async () => {
      throw new Error("cookie expiré");
    });
    useFakeDb({ member: MEMBER, blacklistRow: null });
    assert.equal(await accountAuth.getSession(REQ), null);
  });

  test("erreur DB sur la lecture blacklist → null (fail-closed)", async () => {
    stubBetterAuthSession(async () => fakeAuthSession(MEMBER.email));
    useFakeDb({ member: MEMBER, blacklistError: new Error("DB indisponible") });
    assert.equal(
      await accountAuth.getSession(REQ),
      null,
      "doute = refus : la session doit être coupée si la blacklist est illisible",
    );
  });

  test("hors runtime Next (pas de requête) → null", async () => {
    // `getSession()` sans argument tente `next/headers`, qui échoue hors d'un
    // scope de requête : la source renvoie null au lieu de lever.
    assert.equal(await accountAuth.getSession(), null);
  });

  test("SESSION_TTL_MS = 30 jours", () => {
    assert.equal(accountAuth.SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000);
  });
});
