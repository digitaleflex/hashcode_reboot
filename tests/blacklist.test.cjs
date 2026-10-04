/**
 * Unit tests — garde anti-blacklist à la connexion (3 couches, fail-closed).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/blacklist.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - isBlacklistEntryActive ← src/lib/blacklist.ts (isEmailBlacklisted,
 *    décision d'expiration : expiré = ignoré, sinon bloqué)
 *  - shouldSendOtp         ← src/lib/auth/index.ts (sendVerificationOTP,
 *    couche 1 : silence identique inconnu / blacklisté)
 *  - sessionCreateBefore   ← src/lib/auth/index.ts (databaseHooks session
 *    create.before, couche 2 : false = bloque, undefined = autorise)
 *  - resolveSession        ← src/lib/account-auth.ts (getSession, couche 3 :
 *    null = refus, objet = forme historique préservée)
 * If the sources change, update the mirrors below accordingly.
 *
 * NON testé ici (dit explicitement) :
 *  - isEmailBlacklisted réel : touche Prisma/DB, le repo ne mocke pas la DB
 *    en unitaire (aucun helper de mock dans tests/) — seule la décision
 *    d'expiration, pure et déterministe, est testée via injection de `now`.
 *  - le hook DB réel et getSession réel : nécessitent Prisma + Better Auth ;
 *    couverts par les miroirs de décision ci-dessous, pas par un faux test.
 *
 * Coverage:
 *  - expiration : null/absent → non bloqué ; permanent → bloqué ;
 *    futur → bloqué ; passé → NON bloqué ; égal à now → bloqué (< strict)
 *  - couche 1 : blacklisté ≡ inconnu (même silence observable, anti-énumération)
 *  - couche 2 : false si blacklisté ou email introuvable, undefined sinon
 *  - couche 3 : null si blacklisté/supprimé/absent, forme préservée sinon
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Instants fixes (déterministe : aucun Date.now() implicite) ──

const NOW = new Date("2026-06-01T12:00:00.000Z");
const PAST = new Date("2026-05-01T12:00:00.000Z");
const FUTURE = new Date("2026-07-01T12:00:00.000Z");

// ── Mirrors ──

// Miroir de src/lib/blacklist.ts (isEmailBlacklisted, lignes expiration) :
// `if (row.expiresAt && row.expiresAt < now) return null; return row;`
// → true = bloqué, false = non bloqué. `now` injecté (pas de Date.now()).
function isBlacklistEntryActive(row, now) {
  if (!row) return false;
  if (row.expiresAt && row.expiresAt < now) return false;
  return true;
}

// Miroir de src/lib/auth/index.ts (sendVerificationOTP, couche 1) :
// `if (!member) return;` puis `if (blacklisté) return;` — même silence.
// → "silent" (rien d'observable) ou "send" (OTP envoyé).
function shouldSendOtp({ memberExists, blacklistActive }) {
  if (!memberExists) return "silent";
  if (blacklistActive) return "silent";
  return "send";
}

// Miroir de src/lib/auth/index.ts (databaseHooks session create.before,
// couche 2) : `false` bloque la création, `undefined` l'autorise. Email
// introuvable → false (pas de session orpheline). Erreur DB → l'exception
// remonte (fail-closed), non modélisable en pur donc non testé ici.
function sessionCreateBefore({ userEmail, blacklistActive }) {
  if (!userEmail) return false;
  if (blacklistActive) return false;
  return undefined;
}

// Miroir de src/lib/account-auth.ts (getSession, couche 3) : `null` = refus,
// objet = forme historique (clés inchangées pour les appelants).
function resolveSession({ member, blacklistActive }) {
  if (!member || member.deletedAt) return null;
  if (blacklistActive) return null;
  return {
    memberId: member.id,
    member,
    otpHash: null,
    revokedAt: null,
  };
}

// ── Tests ──

describe("blacklist: décision d'expiration (pure, now injecté)", () => {
  test("absent (null) → NON bloqué", () => {
    assert.equal(isBlacklistEntryActive(null, NOW), false);
  });

  test("permanent (expiresAt null) → bloqué", () => {
    assert.equal(
      isBlacklistEntryActive({ reason: "spammer", expiresAt: null }, NOW),
      true,
    );
  });

  test("non-expiré (expiresAt futur) → bloqué", () => {
    assert.equal(
      isBlacklistEntryActive({ reason: "abuser", expiresAt: FUTURE }, NOW),
      true,
    );
  });

  test("expiré (expiresAt passé) → NON bloqué", () => {
    assert.equal(
      isBlacklistEntryActive({ reason: "abuser", expiresAt: PAST }, NOW),
      false,
    );
  });

  test("frontière (expiresAt === now) → bloqué (comparaison < stricte)", () => {
    assert.equal(
      isBlacklistEntryActive(
        { reason: "admin", expiresAt: new Date(NOW) },
        NOW,
      ),
      true,
    );
  });
});

describe("couche 1: sendVerificationOTP (silence anti-énumération)", () => {
  test("email inconnu → silence (référence anti-énumération)", () => {
    assert.equal(
      shouldSendOtp({ memberExists: false, blacklistActive: false }),
      "silent",
    );
  });

  test("email blacklisté → silence IDENTIQUE à l'email inconnu", () => {
    const blacklisted = shouldSendOtp({
      memberExists: true,
      blacklistActive: true,
    });
    const unknown = shouldSendOtp({
      memberExists: false,
      blacklistActive: false,
    });
    assert.equal(blacklisted, "silent");
    assert.equal(blacklisted, unknown);
  });

  test("email sain connu → envoi", () => {
    assert.equal(
      shouldSendOtp({ memberExists: true, blacklistActive: false }),
      "send",
    );
  });

  test("email inconnu + entrée expirée → silence (pas d'envoi fantôme)", () => {
    const active = isBlacklistEntryActive(
      { reason: "spammer", expiresAt: PAST },
      NOW,
    );
    assert.equal(active, false);
    assert.equal(
      shouldSendOtp({ memberExists: false, blacklistActive: active }),
      "silent",
    );
  });
});

describe("couche 2: databaseHooks session create.before", () => {
  test("email blacklisté → false (session non créée)", () => {
    assert.equal(
      sessionCreateBefore({
        userEmail: "bad@example.com",
        blacklistActive: true,
      }),
      false,
    );
  });

  test("email introuvable pour le userId → false (pas d'orpheline)", () => {
    assert.equal(
      sessionCreateBefore({ userEmail: null, blacklistActive: false }),
      false,
    );
    assert.equal(
      sessionCreateBefore({ userEmail: undefined, blacklistActive: false }),
      false,
    );
  });

  test("email sain → undefined (autorise, ne bloque pas)", () => {
    assert.equal(
      sessionCreateBefore({
        userEmail: "ok@example.com",
        blacklistActive: false,
      }),
      undefined,
    );
  });

  test("entrée expirée → autorise (non bloqué)", () => {
    const active = isBlacklistEntryActive(
      { reason: "duplicate", expiresAt: PAST },
      NOW,
    );
    assert.equal(
      sessionCreateBefore({ userEmail: "ex@example.com", blacklistActive: active }),
      undefined,
    );
  });
});

describe("couche 3: getSession (tue les sessions pré-blacklistage)", () => {
  const member = { id: "m1", email: "a@example.com", deletedAt: null };

  test("blacklisté → null (session coupée)", () => {
    assert.equal(
      resolveSession({ member, blacklistActive: true }),
      null,
    );
  });

  test("sain → session de forme préservée (member, memberId, clés)", () => {
    const session = resolveSession({ member, blacklistActive: false });
    assert.ok(session);
    assert.equal(session.memberId, "m1");
    assert.equal(session.member, member);
    assert.ok("otpHash" in session && "revokedAt" in session);
  });

  test("supprimé (deletedAt) → null, inchangé", () => {
    assert.equal(
      resolveSession({
        member: { ...member, deletedAt: new Date() },
        blacklistActive: false,
      }),
      null,
    );
  });

  test("membre absent → null, inchangé", () => {
    assert.equal(
      resolveSession({ member: null, blacklistActive: false }),
      null,
    );
  });

  test("entrée expirée → session préservée (NON bloqué)", () => {
    const active = isBlacklistEntryActive(
      { reason: "other", expiresAt: PAST },
      NOW,
    );
    const session = resolveSession({ member, blacklistActive: active });
    assert.ok(session);
    assert.equal(session.memberId, "m1");
  });
});
