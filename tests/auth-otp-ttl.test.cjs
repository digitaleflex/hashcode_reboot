/**
 * Tests de non-régression — D06 : durée de vie de l'OTP.
 *
 * Run:  node --import tsx --test tests/auth-otp-ttl.test.cjs
 *
 * BUG CORRIGÉ (audit 2026-10-05) :
 * Better Auth expire l'OTP à **300 s (5 min)** par défaut
 * (`dist/plugins/email-otp/index.mjs:14`), mais l'UI annonçait 15 minutes à
 * quatre endroits : `src/lib/mail.ts` (3 occurrences) et
 * `messages/{fr,en}.json` (`verifyOtp.codeHint`).
 *
 * Conséquence : un utilisateur qui saisit son code entre 5 et 15 minutes se
 * voit refuser un code encore parfaitement valide, sans message explicatif.
 *
 * Ce test verrouille la COHÉRENCE entre la configuration réelle et ce que
 * l'interface promet. Il lit les deux, donc il échoue si l'un des deux change
 * sans l'autre.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(REPO, p), "utf8");

describe("D06 — durée de l'OTP : configuration réelle", () => {
  test("emailOTP déclare expiresIn: 900 (15 min)", async () => {
    process.env.BETTER_AUTH_SECRET =
      process.env.BETTER_AUTH_SECRET || "d06-test-secret-at-least-32-characters";
    process.env.BETTER_AUTH_URL =
      process.env.BETTER_AUTH_URL || "http://localhost:3000";

    const { auth } = await import("../src/lib/auth/index.ts");
    const ctx = await auth.$context;
    const otpOpts = ctx.options.plugins.find((p) => p.id === "email-otp")?.options;

    assert.ok(otpOpts, "le plugin email-otp doit être enregistré");
    assert.equal(
      otpOpts.expiresIn,
      900,
      "l'OTP doit expirer au bout de 900 s (15 min) pour coller à l'UI",
    );
  });

  test("la durée correspond bien à 15 minutes, pas 5", async () => {
    process.env.BETTER_AUTH_SECRET =
      process.env.BETTER_AUTH_SECRET || "d06-test-secret-at-least-32-characters";
    process.env.BETTER_AUTH_URL =
      process.env.BETTER_AUTH_URL || "http://localhost:3000";

    const { auth } = await import("../src/lib/auth/index.ts");
    const ctx = await auth.$context;
    const otpOpts = ctx.options.plugins.find((p) => p.id === "email-otp")?.options;

    // Garde-fou explicite contre une régression vers le défaut de zod/BA.
    assert.notEqual(otpOpts.expiresIn, 300, "le défaut Better Auth (300 s) ne doit pas revenir");
    assert.equal(otpOpts.expiresIn / 60, 15, "la durée doit être exprimée en 15 minutes");
  });
});

describe("D06 — cohérence avec ce que l'interface promet", () => {
  test("l'email annonce 15 minutes (et pas 5)", () => {
    const mail = read("src/lib/mail.ts");
    const announcements = [...mail.matchAll(/(\d+)\s*minutes/g)].map((m) => Number(m[1]));
    assert.ok(announcements.length > 0, "aucune mention de durée en minutes dans l'email");
    for (const minutes of announcements) {
      assert.equal(
        minutes,
        15,
        `l'email annonce "${minutes} minutes" alors que l'OTP expire à 15 — incohérence`,
      );
    }
  });

  test("les deux locales annoncent la même durée que le code", () => {
    for (const locale of ["fr", "en"]) {
      const messages = JSON.parse(read(`messages/${locale}.json`));
      const hint = messages?.auth?.verifyOtp?.codeHint ?? "";
      const match = /(\d+)\s*(minutes|minute)/i.exec(hint);
      if (match) {
        assert.equal(
          Number(match[1]),
          15,
          `messages/${locale}.json annonce "${match[1]}" alors que l'OTP expire à 15 min`,
        );
      }
    }
  });

  test("aucune locale ne promet 5 minutes pour l'OTP", () => {
    for (const locale of ["fr", "en"]) {
      const messages = JSON.parse(read(`messages/${locale}.json`));
      const otp = messages?.auth?.verifyOtp ?? {};
      // Parcours le sous-arbre verifyOtp uniquement : une regex sur le JSON
      // brut déborde sur les namespaces voisins et produit des faux positifs.
      const flat = JSON.stringify(otp);
      assert.equal(
        /(?<![\d])5\s*(minutes|minute)/.test(flat),
        false,
        `messages/${locale}.json (auth.verifyOtp) promet 5 minutes — diverges de expiresIn: 900`,
      );
      // Et on vérifie qu'il PROMET bien 15, sinon ce test ne prouve rien.
      assert.match(
        flat,
        /15\s*(minutes|minute)/,
        `messages/${locale}.json (auth.verifyOtp) ne devrait plus annoncer la durée de l'OTP : ` +
          `la valeur doit vivre dans expiresIn (src/lib/auth/index.ts), pas dans une copie figée`,
      );
    }
  });
});