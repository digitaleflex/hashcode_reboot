/**
 * Unit tests — D01 : fermeture de POST /api/auth/sign-up/email.
 *
 * Run:  node --import tsx --test tests/auth-signup-guard.test.cjs
 *
 * Ce test importe la VRAIE configuration Better Auth (src/lib/auth/index.ts) :
 * il ne re-implement�� rien. Il vérifie l'invariant de sécurité, pas la
 * mécanique d'un mirror.
 *
 * Contexte (audit 2026-10-05) :
 * `src/app/api/auth/[...betterAuth]/route.ts` monte le routeur complet, donc
 * `POST /api/auth/sign-up/email` était atteignable sans authentification.
 * Comme `src/lib/admin-auth.ts:61` ne teste QUE l'email, un tiers pouvait
 * créer un compte avec l'email d'un opérateur puis se connecter — les lignes
 * `User` Better Auth étant créées paresseusement (à la 1re connexion OTP),
 * tout admin jamais connecté était préemptable → session `operator`.
 *
 * Propriété vérifiée : `emailAndPassword.disableSignUp === true`.
 *
 * Point de lecture unique dans la librairie (vérifié) :
 *   node_modules/better-auth/dist/api/routes/sign-up.mjs:145
 *   if (!...emailAndPassword?.enabled || ...emailAndPassword?.disableSignUp) throw
 * → aucun autre effet de bord :
 *   - `/sign-in/email` (connexion admin) n'est PAS conditionné ;
 *   - le plugin emailOTP expose `/sign-in/email-otp` et `/email-otp/*`, et lit
 *     SAUF PROPRE option `disableSignUp` (routes.mjs:103 et :413). Cette option
 *     ne doit donc JAMAIS être mise dans `emailOTP({...})` sansSinon le parcours
 *     membre est cassé — c'est ce que ce test protège aussi.
 */

const { test, before } = require("node:test");
const assert = require("node:assert/strict");

before(async () => {
  // betterAuth() lit ces variables à l'instanciation ; le test n'ouvre aucune
  // connexion DB (prismaAdapter est paresseux).
  process.env.BETTER_AUTH_SECRET =
    process.env.BETTER_AUTH_SECRET || "d01-test-secret-at-least-32-characters-long";
  process.env.BETTER_AUTH_URL =
    process.env.BETTER_AUTH_URL || "http://localhost:3000";
});

test("D01 — emailAndPassword.disableSignUp est true (inv closes /sign-up/email)", async () => {
  const { auth } = await import("../src/lib/auth/index.ts");
  const ctx = await auth.$context;
  const emailAndPassword = ctx.options.emailAndPassword;

  assert.equal(emailAndPassword?.enabled, true, "le login email/password doit rester actif");
  assert.equal(
    emailAndPassword?.disableSignUp,
    true,
    "le sign-up public doit être fermé (D01) — sinon préemption d'identité admin",
  );
});

test("D01 — le parcours OTP membre reste ouvert (endpoints du plugin)", async () => {
  const { auth } = await import("../src/lib/auth/index.ts");
  const ctx = await auth.$context;

  // Le plugin emailOTP a sa PROPRE option disableSignUp. Si elle est activée,
  // les routes du plugin lisent `opts.disableSignUp` (routes.mjs:103, :413) et
  // le parcours de connexion membre est cassé. Elle doit rester absente/false.
  const otpOpts = ctx.options.emailOTP ?? ctx.plugins?.emailOTP?.options;
  assert.notEqual(
    otpOpts?.disableSignUp,
    true,
    "ne pas mettre disableSignUp dans emailOTP({...}) : cela casserait /sign-in/email-otp",
  );
});
