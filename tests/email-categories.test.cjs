/**
 * Tests de régression — D03 : taxonomie des catégories sémantiques d'email.
 *
 * Run:  node --import tsx --test tests/email-categories.test.cjs
 *
 * Ce test importe le VRAI module `@/lib/email-categories` et la VRAIE source de
 * `mail.ts` (pas de miroir) — il vérifie que producteurs et consommateurs
 * parlent la même langue.
 *
 * Bug couvert (audit 2026-10-05) :
 * `categorizeEmail()` classait l'email par `includes()` sur son SUJET.
 *   - « On t'attend sur HASHCODE — rejoins le groupe »   (sendEngagementEmail)
 *   - « On t'attend toujours — rejoins HASHCODE REBOOT » (sendInviteRelanceEmail)
 * matchaient tous deux "t'attend" → catégorie `engagement` ;
 *   - aucun sujet ne contenait "reprend"/"termin" → la branche `relance`
 *     n'était jamais atteinte.
 * Or `/api/email-stats` et `/api/admin/dashboard` filtrent
 * `where: { category: "relance" }` pour le tunnel de conversion de la relance :
 * `relanceSent`/`relanceOpened`/`relanceClicked` valaient donc 0 EN PERMANENCE,
 * et étaient affichés comme de vraies mesures dans deux tableaux de bord.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(REPO, p), "utf8");

test("D03 — la catégorie n'est plus devinée à partir du sujet", () => {
  const mail = read("src/lib/mail.ts");
  assert.equal(
    /function categorizeEmail/.test(mail),
    false,
    "categorizeEmail() ne doit plus exister : la catégorie vient de l'appelant",
  );
  assert.equal(
    /trackEmailSent\(to, subject/.test(mail),
    false,
    "trackEmailSent ne doit plus recevoir le sujet",
  );
});

test("D03 — chaque wrapper déclare une semanticCategory valide", () => {
  const mail = read("src/lib/mail.ts");
  const declared = [...mail.matchAll(/semanticCategory:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(declared.length >= 14, `attendu >= 14 déclarations, trouvé ${declared.length}`);

  const { EMAIL_SEMANTIC_CATEGORIES } = require("../src/lib/email-categories.ts");
  const known = new Set(EMAIL_SEMANTIC_CATEGORIES);
  for (const cat of declared) {
    assert.ok(known.has(cat), `catégorie inconnue : "${cat}"`);
  }
});

test("D03 — la catégorie de relance de profil est bien celle du tunnel", () => {
  const { PROFILE_RELANC_CATEGORY } = require("../src/lib/email-categories.ts");
  assert.equal(
    PROFILE_RELANC_CATEGORY,
    "profil_abandon",
    "le tunnel de relance filtre sur profil_abandon",
  );
  // sendRelanceEmail (relance de ProfilingDraft, J+7) doit produire cette valeur.
  // On découpe jusqu'à la fonction suivante : `\n}` arrive trop tôt à cause des
  // accolades imbriquées.
  const mail = read("src/lib/mail.ts");
  const start = mail.indexOf("export async function sendRelanceEmail");
  assert.ok(start > 0, "sendRelanceEmail doit exister");
  const next = mail.indexOf("\nexport async function ", start + 10);
  const body = mail.slice(start, next > 0 ? next : mail.length);
  assert.match(
    body,
    /semanticCategory: "profil_abandon"/,
    "sendRelanceEmail doit produire profil_abandon",
  );
});

test("D03 — aucun consommateur ne filtre plus sur la valeur morte \"relance\"", () => {
  for (const f of [
    "src/app/api/email-stats/route.ts",
    "src/app/api/admin/dashboard/route.ts",
  ]) {
    const src = read(f);
    assert.equal(
      /category:\s*"relance"/.test(src),
      false,
      `${f} ne doit plus filtrer sur category: "relance" (aucun wrapper ne la produisait)`,
    );
  }
});

test("D03 — l'ancienne categorie 'relance' n'existe plus dans la taxonomie", () => {
  const { EMAIL_SEMANTIC_CATEGORIES } = require("../src/lib/email-categories.ts");
  assert.equal(
    EMAIL_SEMANTIC_CATEGORIES.includes("relance"),
    false,
    '"relance" était inatteignable : aucun sujet ne matchait la branche',
  );
});

test("D03 — les deux tunnels de relance sont distincts", () => {
  const { PROFILE_RELANC_CATEGORY, INVITE_RELANC_CATEGORY } =
    require("../src/lib/email-categories.ts");
  assert.notEqual(
    PROFILE_RELANC_CATEGORY,
    INVITE_RELANC_CATEGORY,
    "relance de profil et relance d'invitation sont deux tunnels différents",
  );
});

test("D03 — chaque catégorie a un libellé (pas d'affichage via le fallback)", () => {
  const { EMAIL_SEMANTIC_CATEGORIES, EMAIL_CATEGORY_LABELS } =
    require("../src/lib/email-categories.ts");
  for (const cat of EMAIL_SEMANTIC_CATEGORIES) {
    assert.ok(
      EMAIL_CATEGORY_LABELS[cat],
      `libellé manquant pour "${cat}" : l'admin l'afficherait via un fallback`,
    );
  }
});

test("D03 — les deux composants admin partagent le même jeu de libellés", () => {
  // D30 : Maps dupliqués. Ces deux fichiers avaient chacun leur CATEGORY_LABEL.
  for (const f of [
    "src/components/reboot/admin/EmailEngagement.tsx",
    "src/components/reboot/admin/marketing/MarketingGraphs.tsx",
  ]) {
    const src = read(f);
    assert.match(src, /EMAIL_CATEGORY_LABELS/, `${f} doit importer le map centralisé`);
    assert.equal(
      /const CATEGORY_LABEL: Record<string, string> = \{/.test(src),
      false,
      `${f} ne doit plus redéclarer son propre map`,
    );
  }
});