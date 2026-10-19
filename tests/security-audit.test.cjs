/**
 * Correctifs d'audit sécurité — assertions sur texte source (fs, sans exécution).
 *
 * Run: node --test tests/security-audit.test.cjs
 *
 *  - /api/consents : identité tirée de la session, jamais du corps ; lecture
 *    réservée au propriétaire ou à un admin
 *  - /api/admin/admins : opère sur Member.adminRole (source de vérité de
 *    l'accès), plus sur la table dépréciée AdminUser ; CSRF sur les écritures
 *  - relance : jamais d'envoi vers une adresse blacklistée
 *  - /api/profiling/draft : bucket dédié à la création de brouillons
 *  - webhook Brevo : plus de repli sur CRON_SECRET
 */
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

describe("POST/GET /api/consents", () => {
  const src = read("src/app/api/consents/route.ts");

  test("POST n'écrit jamais l'email ni le memberId du corps", () => {
    assert.doesNotMatch(src, /memberId:\s*d\.memberId/);
    assert.doesNotMatch(src, /normalizeConsentEmail\(d\.email\)/);
    assert.match(src, /memberId:\s*session\?\.member\.id/);
  });

  test("GET exige le propriétaire ou un admin", () => {
    assert.match(src, /isOwner/);
    assert.match(src, /isAdminAuthed\(req\)/);
  });
});

describe("/api/admin/admins", () => {
  const src = read("src/app/api/admin/admins/route.ts");

  test("n'opère plus sur AdminUser / AdminSession", () => {
    assert.doesNotMatch(src, /db\.adminUser\./);
    assert.doesNotMatch(src, /db\.adminSession\./);
  });

  test("écrit Member.adminRole et protège PATCH/DELETE par CSRF", () => {
    assert.match(src, /data:\s*\{\s*adminRole:\s*null\s*\}/);
    assert.equal((src.match(/checkCSRF\(req\)/g) || []).length, 2);
  });
});

describe("relance + brouillons", () => {
  test("cron relance filtre la blacklist", () => {
    assert.match(read("src/app/api/cron/relance/route.ts"), /isEmailBlacklisted\(draft\.email\)/);
  });

  test("création de brouillon : bucket dédié", () => {
    assert.match(read("src/app/api/profiling/draft/route.ts"), /draft-new:/);
  });
});

describe("webhook Brevo", () => {
  test("plus de repli sur CRON_SECRET", () => {
    const src = read("src/app/api/webhooks/brevo/route.ts");
    assert.doesNotMatch(src, /process\.env\.CRON_SECRET/);
  });
});

describe("durcissement accès admin", () => {
  test("le rôle admin exige un membre non supprimé et non blacklisté", () => {
    const src = read("src/lib/admin-auth.ts");
    assert.match(src, /deletedAt/);
    assert.match(src, /isEmailBlacklisted\(email\)/);
  });

  test("les écritures admin listées ont un garde CSRF", () => {
    const expected = {
      "src/app/api/admin/segments/route.ts": 1,
      "src/app/api/admin/segments/[id]/route.ts": 2,
      "src/app/api/admin/mentoring/route.ts": 1,
      "src/app/api/admin/missions/route.ts": 1,
      "src/app/api/admin/missions/[id]/route.ts": 1,
      "src/app/api/admin/mission-submissions/[id]/review/route.ts": 1,
      "src/app/api/admin/duplicates/merge/route.ts": 1,
    };
    for (const [file, count] of Object.entries(expected)) {
      const n = (read(file).match(/checkCSRF\(req\)/g) || []).length;
      assert.equal(n, count, `${file} : ${n} garde(s) CSRF au lieu de ${count}`);
    }
  });

  test("/api/auth : limites par action, 429 propre (plus d'exception)", () => {
    const src = read("src/app/api/auth/[...betterAuth]/route.ts");
    assert.doesNotMatch(src, /throw new RateLimitError/);
    assert.match(src, /status: 429/);
    assert.match(src, /auth-otp-email:/);
  });
});

describe("regex des routes OTP (miroir de /api/auth)", () => {
  const OTP_PATH = /\/(email-otp\/|sign-in\/email-otp)/;
  const OTP_SEND_PATH = /\/email-otp\/send-verification-otp$/;
  test("envoi, vérification et connexion par code sont limités strictement", () => {
    assert.ok(OTP_PATH.test("/api/auth/email-otp/send-verification-otp"));
    assert.ok(OTP_PATH.test("/api/auth/sign-in/email-otp"));
    assert.ok(OTP_PATH.test("/api/auth/email-otp/verify-email"));
  });
  test("la lecture de session n'est pas concernée", () => {
    assert.ok(!OTP_PATH.test("/api/auth/get-session"));
    assert.ok(!OTP_PATH.test("/api/auth/callback/google"));
  });
  test("seul l'envoi du code déclenche la limite par email", () => {
    assert.ok(OTP_SEND_PATH.test("/api/auth/email-otp/send-verification-otp"));
    assert.ok(!OTP_SEND_PATH.test("/api/auth/email-otp/verify-email"));
  });
});
