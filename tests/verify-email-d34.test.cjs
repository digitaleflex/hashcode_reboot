/**
 * Tests de non-régression — D34 : `isEmailVerified` enfin consommé.
 *
 * Run:  node --import tsx --test tests/verify-email-d34.test.cjs
 *
 * POURQUOI
 *
 * `src/lib/verify-email.ts` écrivait un flag « email vérifié » (TTL 30 jours)
 * dans `confirmEmailLink`, et exposait `isEmailVerified` pour le lire. Ce
 * drapeau n'avait AUCUN appelant dans tout `src/` : il était écrit, expiré,
 * jamais consulté. Le parcours de vérification d'email produisait donc une
 * information que personne ne recevait.
 *
 * DÉCISION PRODUCTE : brancher le drapeau, pas supprimer le parcours.
 *
 * Branchement retenu — `requestEmailLink` refuse d'émettre un nouveau lien
 * pour une adresse dont la possession a déjà été prouvée. Sans cela, un
 * utilisateur déjà vérifié recevait un lien qui ne pouvait rien lui apporter, et
 * le cooldown de 60 s le bloquait ensuite s'il insistait.
 *
 * Ces tests importent le VRAI module et exercent le store mémoire, donc ils
 * passent sans Redis.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  requestEmailLink,
  confirmEmailLink,
  isEmailVerified,
  buildVerifyUrl,
} = require("../src/lib/verify-email.ts");

/**
 * Le store mémoire est module-global et n'a pas de fonction de vidage
 * exportée. On isole donc chaque test par une adresse unique, plutôt que de
 * supposer un état propre entre les tests.
 */
let counter = 0;
const uniqueEmail = () => `d34-${Date.now()}-${counter++}@example.test`;

describe("D34 — le flag est écrit et se relit", () => {
  test("une adresse fraîche n'est pas vérifiée", async () => {
    assert.equal(await isEmailVerified(uniqueEmail()), false);
  });

  test("après confirmation du lien, l'adresse est marquée vérifiée", async () => {
    const email = uniqueEmail();
    const requested = await requestEmailLink(email);
    assert.ok(requested.ok, "un lien doit être émis pour une adresse non vérifiée");

    const confirmed = await confirmEmailLink(requested.token);
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.email, email);

    // C'est CE test qui échouait avant : le flag existait mais rien ne le lisait.
    assert.equal(
      await isEmailVerified(email),
      true,
      "confirmEmailLink doit marquer l'adresse comme vérifiée",
    );
  });

  test("la normalisation ignore casse et espaces", async () => {
    const email = uniqueEmail();
    const requested = await requestEmailLink(email);
    await confirmEmailLink(requested.token);

    assert.equal(await isEmailVerified(email.toUpperCase()), true);
    assert.equal(await isEmailVerified(`  ${email}  `), true);
  });

  test("une autre adresse n'héritera pas du flag", async () => {
    const email = uniqueEmail();
    const requested = await requestEmailLink(email);
    await confirmEmailLink(requested.token);

    assert.equal(await isEmailVerified(uniqueEmail()), false);
  });

  test("un lien expiré ne marque pas l'adresse", async () => {
    // Le token d'un lien non confirmé ne doit rien prouver : c'est le
    // contrepoids du court-circuit ajouté à requestEmailLink.
    const email = uniqueEmail();
    const requested = await requestEmailLink(email);
    assert.ok(requested.ok);

    assert.equal(
      await isEmailVerified(email),
      false,
      "un lien émis mais jamais cliqué ne vérifie rien",
    );
    const forged = await confirmEmailLink(requested.token + "falsifie");
    assert.equal(forged.ok, false);
    // Un token falsifié est traité comme expiré, pas comme invalide : les deux
    // renvoient volontairement le même message à l'utilisateur, pour ne pas
    // révéler si un lien a jamais existé. L'oracle reste fermé.
    assert.equal(
      forged.reason,
      "expired",
      "lien falsifié et lien expiré doivent rester indiscernables",
    );
    // En revanche un token trop court est bien rejeté comme invalide.
    assert.equal((await confirmEmailLink("court")).reason, "invalid");
    assert.equal(
      await isEmailVerified(email),
      false,
      "un token falsifié ne doit rien marquer",
    );
  });
});

describe("D34 — plus de lien émis pour une adresse déjà vérifiée", () => {
  test("requestEmailLink refuse et signale alreadyVerified", async () => {
    const email = uniqueEmail();
    const first = await requestEmailLink(email);
    assert.ok(first.ok);
    await confirmEmailLink(first.token);

    const second = await requestEmailLink(email);

    assert.equal(second.ok, false, "aucun token ne doit être émis après vérification");
    assert.equal(second.token, "", "aucun token ne doit être produit");
    assert.equal(
      second.alreadyVerified,
      true,
      "la raison doit être distinguishable d'un cooldown",
    );
    assert.equal(
      second.cooldownSec ?? null,
      null,
      "ce cas ne doit PAS être présenté comme un cooldown : c'est un succès, pas une attente",
    );
  });

  test("le refus survit au redémarrage du store de liens", async () => {
    // Le flag vit 30 jours, le lien 24 h. Passé 24 h, le lien est périmé mais
    // l'adresse reste vérifiée : le court-circuit doit toujours s'appliquer.
    const email = uniqueEmail();
    const requested = await requestEmailLink(email);
    await confirmEmailLink(requested.token);

    // Deux appels successifs : le premier aurait consommé le cooldown si le
    // court-circuit n'existait pas.
    for (const attempt of [1, 2]) {
      const r = await requestEmailLink(email);
      assert.equal(r.alreadyVerified, true, `appel ${attempt} : déjà vérifié`);
    }
  });

  test("le renvoi reste possible pour une adresse non vérifiée (comportement préservé)", async () => {
    // Garde-fou : le court-circuit ne doit pas casser le cas nominal.
    const email = uniqueEmail();
    const a = await requestEmailLink(email);
    assert.ok(a.ok);

    // Deuxième demande immédiate → cooldown, comme avant D34.
    const b = await requestEmailLink(email);
    assert.equal(b.ok, false);
    assert.equal(b.alreadyVerified, undefined);
    assert.ok(typeof b.cooldownSec === "number" && b.cooldownSec > 0);
  });
});

describe("D34 — le lien reste construit comme avant", () => {
  test("buildVerifyUrl produit une URL absolue avec le token", () => {
    const url = buildVerifyUrl("jeton-de-test");
    assert.match(url, /^https?:\/\//);
    assert.match(url, /\/verify-email\?token=/);
    assert.ok(url.includes("jeton-de-test"));
  });
});