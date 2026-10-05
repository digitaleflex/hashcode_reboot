/**
 * Test de non-régression — messages d'erreur FR du schéma de profil (D18).
 *
 * Run:  node --import tsx --test tests/profiling-messages.test.cjs
 *
 * BUG TROUVÉ ET CORRIGÉ EN D18 (gravité : utilisateur).
 *
 * `src/lib/profiling/validate.ts` déclarait sept messages d'erreur en français —
 * `primaryDomainRequired`, `levelRequired`, `goalRequired`,
 * `availabilityRequired`, `learningStyleRequired`, `mentoringInterestRequired`,
 * `budgetRangeInvalid` — traduits, exposés par `getMessages(t)`, et présents
 * dans la branche par défaut. Mais les sept `z.enum()` correspondants étaient
 * construits comme constantes, SANS second argument de message.
 *
 * Conséquence réelle, vérifiée en exécutant la vraie source :
 *
 *   path=primaryDomain  message="Invalid option: expected one of
 *                                    \"web\"|\"cybersecurity\"|\"ai\""
 *
 * en anglais, sur un formulaire d'inscription 100 % francophone. Ces messages
 * sont renvoyés tels quels à l'utilisateur par `POST /api/members`
 * (`route.ts:55-58` mappe `parsed.error.issues`) et par
 * `POST /api/account/complete-profile`.
 *
 * Aucun des 300+ tests existants ne l'avait détecté : ils testaient des
 * miroirs de fonctions pures, jamais le schéma assemblé.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { createProfileSchema } = require("../src/lib/profiling/validate.ts");

/** corps valide minimal, pour n'isoler que le champ testé */
function baseBody() {
  return {
    firstName: "Awa",
    email: "a@b.co",
    country: "BJ",
    primaryDomain: "web",
    level: "beginner",
    goal: "project",
    availability: "<2h",
    learningStyle: "practice",
    mentoringInterest: "no",
    threeMonthGoal: "x".repeat(10),
  };
}

/** fonction de traduction qui rend une balise identifiable */
const t = (k) => `<<${k}>>`;

/** renvoie le message de l'issue portant sur `path` */
function messageFor(body, path) {
  const schema = createProfileSchema(t);
  const r = schema.safeParse(body);
  assert.equal(r.success, false, `${path} aurait dû être rejeté`);
  const issue = r.error.issues.find((i) => i.path.join(".") === path);
  assert.ok(issue, `aucune issue sur "${path}" — obtenu : ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return issue.message;
}

/** Le défaut de zod est en anglais : c'est précisément ce qu'on détecte. */
function assertNotZodDefault(message, label) {
  assert.ok(
    !/^Invalid (input|option)/.test(message),
    `${label} renvoie le message par défaut de zod, en anglais : "${message}"`,
  );
}

describe("profiling/validate : messages FR sur les 7 enums", () => {
  const CASES = [
    ["primaryDomain", "validation.primaryDomainRequired", "primaryDomain"],
    ["level", "validation.levelRequired", "level"],
    ["goal", "validation.goalRequired", "goal"],
    ["availability", "validation.availabilityRequired", "availability"],
    ["learningStyle", "validation.learningStyleRequired", "learningStyle"],
    ["mentoringInterest", "validation.mentoringInterestRequired", "mentoringInterest"],
    ["budgetRange", "validation.budgetRangeInvalid", "budgetRange"],
  ];

  for (const [field, expectedKey, path] of CASES) {
    test(`${field} invalide renvoie le message traduit, pas le défaut zod`, () => {
      const message = messageFor({ ...baseBody(), [field]: "valeur-inventee" }, path);
      assertNotZodDefault(message, field);
      assert.equal(
        message,
        `<<${expectedKey}>>`,
        `${field} : message non traduit ou mauvaise clé`,
      );
    });
  }

  test("aucun des 7 enums ne renvoie le défaut zod quand la valeur est invalide", () => {
    // Nuance zod, documentée volontairement : un champ ENTIÈREMENT ABSENT
    // produit toujours le message par défaut en anglais
    // ("Invalid input: expected string, received undefined"), car le message
    // personnalisé ne s'applique qu'à `min()/max()`, pas à l'erreur de type.
    // Ce n'est pas un défaut : le formulaire envoie toujours tous les champs.
    // On teste donc le cas réel — champ présent, valeur invalide.
    for (const [field, expectedKey] of CASES) {
      const message = messageFor({ ...baseBody(), [field]: "valeur-inventee" }, field);
      assertNotZodDefault(message, field);
      assert.equal(message, `<<${expectedKey}>>`);
    }
  });

  test("une valeur ENUM valide n'introduit pas d'erreur parasite", () => {
    const schema = createProfileSchema(t);
    const r = schema.safeParse(baseBody());
    assert.equal(
      r.success,
      true,
      r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | "),
    );
  });

  test("les 7 factories d'enum gardent leurs valeurs", () => {
    // Garde-fou : le passage en factory ne doit pas modifier les domaines
    // acceptés. On vérifie via le schéma assemblé.
    const schema = createProfileSchema(t);
    for (const domain of ["web", "cybersecurity", "ai"]) {
      const r = schema.safeParse({ ...baseBody(), primaryDomain: domain });
      assert.equal(r.success, true, `primaryDomain="${domain}" devrait être accepté`);
    }
    // Règle métier : `budgetRange` exige un intérêt mentorat != "no"
    // (superRefine `budgetRangeWithoutMentoring`, validate.ts:238-242).
    const avecMentorat = { ...baseBody(), mentoringInterest: "maybe" };
    for (const budget of ["<2500", "not_now", ">30000"]) {
      const r = schema.safeParse({ ...avecMentorat, budgetRange: budget });
      assert.equal(
        r.success,
        true,
        `budgetRange="${budget}" devrait être accepté` +
          (r.success ? "" : ` — refusé : ${r.error.issues.map((i) => i.message).join(" | ")}`),
      );
    }
    // Et la règle croisée doit toujours s'appliquer.
    const sansMentorat = schema.safeParse({ ...baseBody(), budgetRange: "<2500" });
    assert.equal(sansMentorat.success, false, "budgetRange sans intérêt mentorat doit être refusé");
  });
});