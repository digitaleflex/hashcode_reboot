/**
 * Tests de régression — D04 : le webhook Resend n'écrivait pas `memberId`.
 *
 * Run:  node --import tsx --test tests/webhook-memberid.test.cjs
 *
 * Bug couvert (audit 2026-10-05) :
 * Les 4 blocs `db.emailEvent.create` de `src/app/api/webhooks/resend/route.ts`
 * écrivaient `email`, `type`, `category`, `metadata` — mais **jamais
 * `memberId`**. Or :
 *   - `/api/admin/email-log` enrichit via `where: { memberId: { in: memberIds } }`
 *   - `/api/admin/member-emails` fait de même
 * → **tout le trafic Resend était invisible** dans les vues engagement. Le
 * webhook Brevo écrivait bien `memberId`, d'où une asymétrie invisible : les
 * open/click rates ne mesuraient que le trafic Brevo.
 *
 * Le bloc le plus grave était `handleEngagement` (`email.opened` /
 * `email.clicked`), seule source des open/click rates.
 *
 * Correctif : les deux webhooks passent par `@/lib/webhooks/email-event`, dont
 * `recordEmailEvent` résout `memberId` LUI-MÊME — l'appelant ne peut plus
 * l'oublier.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const RESEND = "src/app/api/webhooks/resend/route.ts";
const BREVO = "src/app/api/webhooks/brevo/route.ts";
const SHARED = "src/lib/webhooks/email-event.ts";

test("D04 — aucun webhook n'écrit plus EmailEvent en direct", () => {
  for (const f of [RESEND, BREVO]) {
    assert.equal(
      /db\.emailEvent\.create/.test(read(f)),
      false,
      `${f} ne doit plus créer d'EmailEvent directement : memberId serait omis`,
    );
  }
});

test("D04 — aucun webhook ne fait plus de blacklist en direct", () => {
  for (const f of [RESEND, BREVO]) {
    assert.equal(
      /db\.memberBlacklist\.upsert/.test(read(f)),
      false,
      `${f} doit passer par blacklistEmail (normalisation minuscule incluse)`,
    );
  }
});

test("D04 — les deux webhooks utilisent le module partagé", () => {
  for (const f of [RESEND, BREVO]) {
    const src = read(f);
    assert.match(src, /from "@\/lib\/webhooks\/email-event"/, `${f} doit importer le module partagé`);
    assert.match(src, /recordEmailEvent/, `${f} doit utiliser recordEmailEvent`);
    assert.match(src, /blacklistEmail/, `${f} doit utiliser blacklistEmail`);
  }
});

test("D04 — recordEmailEvent résout memberId lui-même", () => {
  const src = read(SHARED);
  // Le point essential : la résolution est DANS le helper, pas chez l'appelant.
  assert.match(
    src,
    /memberId:\s*member\?\.id \?\? null/,
    "recordEmailEvent doit résoudre memberId — c'est ce qui rend l'oubli impossible",
  );
  assert.match(src, /findMember/, "recordEmailEvent doit appeler findMember");
});

test("D04 — handleEngagement est couvert (opened/clicked)", () => {
  // handleEngagement enregistrait email.opened / email.clicked : sans memberId,
  // les open/click rates n'intégraient que le trafic Brevo.
  const src = read(RESEND);
  const start = src.indexOf("async function handleEngagement");
  assert.ok(start > 0, "handleEngagement doit exister");
  const next = src.indexOf("\n/** ", start);
  const body = src.slice(start, next > 0 ? next : src.length);
  assert.match(
    body,
    /recordEmailEvent/,
    "handleEngagement doit passer par recordEmailEvent",
  );
  assert.equal(
    /db\.emailEvent\.create/.test(body),
    false,
    "handleEngagement ne doit plus créer d'EmailEvent sans memberId",
  );
});

test("D04 — les vues admin qui consomment memberId sont bien couvertes", () => {
  // Si ces deux vues cessaient de filtrer par memberId, le bug serait masqué.
  for (const f of [
    "src/app/api/admin/email-log/route.ts",
    "src/app/api/admin/member-emails/route.ts",
  ]) {
    assert.match(
      read(f),
      /memberId/,
      `${f} doit continuer à filtrer par memberId (sinon le test de régression ne prouve plus rien)`,
    );
  }
});