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

describe("/api/admin/invite — accès admin sur Member.adminRole", () => {
  const src = read("src/app/api/admin/invite/route.ts");

  test("n'opère plus sur AdminUser ni sur l'email d'invitation", () => {
    assert.doesNotMatch(src, /db\.adminUser\./);
    assert.doesNotMatch(src, /sendAdminInvitationEmail/);
    assert.doesNotMatch(src, /db\.adminInvitation\.create|db\.adminInvitation\.upsert/);
  });

  test("accorde le rôle via Member.adminRole, refuse si pas de membre", () => {
    assert.match(src, /db\.member\.findUnique/);
    assert.match(src, /data:\s*\{\s*adminRole:\s*role\s*\}/);
    assert.match(src, /NO_MEMBER/);
  });

  test("reset-2fa (orphelin) a été retiré", () => {
    assert.equal(
      fs.existsSync(path.join(__dirname, "..", "src/app/api/admin/admins/[id]/reset-2fa/route.ts")),
      false,
    );
  });
});
