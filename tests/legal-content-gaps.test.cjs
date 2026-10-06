/**
 * Test de non-régression — D43 : les trous du corpus juridique sont ÉPINGLÉS.
 *
 * Run:  node --import tsx --test tests/legal-content-gaps.test.cjs
 *
 * POURQUOI CE TEST EXISTE
 *
 * D21 a rendu les 4 pages légales. Le corpus qu'elles affichent a des trous que
 * rien ne signalait, et qui ne se verront qu'à la lecture — donc trop tard :
 *
 *  1. Les 4 sections `contact` sont des objets `{ title, content }` — AUCUN
 *     champ de valeur. Leur `content` se termine par un deux-points :
 *     « Pour toute question relative à la protection de vos données : ».
 *     `privacy` renvoie en plus vers un DPO dont l'email n'existe pas. Le
 *     visiteur ne trouve AUCUN moyen de contacter l'association, sur aucune
 *     des 4 pages.
 *
 *  2. `lastUpdated` vaut « Dernière mise à jour : {date} », sans source de date
 *     dans le dépôt. Le rendu le saute volontairement, et le documente.
 *
 *  3. `legal.mentions.sections.editor.email` vaut « Email » : un libellé sans
 *     valeur, alors que les 6 champs voisins ont chacun leur `*Value`.
 *
 * Ces défauts ne sont pas des bugs de code : ce sont des données manquantes.
 * Un test ne peut pas les corriger — il peut empêcher qu'on les oublie, en
 * épinglant la liste exacte de ce qui manque. Le jour où l'adresse est
 * ajoutée, ce test commence à échouer et dit quoi mettre à jour.
 *
 * Même principe que le test de dérive des miroirs de D18 : transformer une
 * incertitude invisible en une liste explicite, vérifiable dans la CI.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), "utf8"));
const readText = (p) => fs.readFileSync(path.join(REPO, p), "utf8");

const LOCALES = ["fr", "en"];
const DOCS = ["mentions", "privacy", "terms", "cookies"];
const RENDERER = "src/components/reboot/legal/legal-document.tsx";

describe("D43 — contact : chaque page doit donner un moyen de joindre l'association", () => {
  /**
   * Liste ÉPINGLÉE. Le corpus réel est `{ title, content }` : aucun champ de
   * valeur. Si une adresse est ajoutée, ce test échoue et rappelle de retirer
   * l'entrée — c'est le but.
   */
  const SECTIONS_SANS_VALEUR = [
    ["mentions", "contact"],
    ["privacy", "contact"],
    ["terms", "contact"],
    ["cookies", "contact"],
  ];

  for (const locale of LOCALES) {
    test(`${locale} — les 4 sections contact n'ont aucun champ de valeur`, () => {
      const legal = read(`messages/${locale}.json`).legal;
      const problems = [];

      for (const [doc, section] of SECTIONS_SANS_VALEUR) {
        const s = legal?.[doc]?.sections?.[section];
        if (!s || typeof s !== "object") continue;

        // Ni `value`, ni `email`, ni `address` : rien à afficher après le « : ».
        const carriesValue = Object.keys(s).some((k) =>
          /^(value|email|address|phone|contactValue|addressValue)$/i.test(k),
        );
        if (!carriesValue) problems.push(`${doc}.${section}`);

        // Le texte doit finir par un deux-points : c'est ce qui promet une
        // valeur absente. S'il ne finit plus par « : », l'anomalie a changé de
        // forme et ce test doit être relu.
        assert.ok(
          /:\s*$/.test(String(s.content ?? "")),
          `${locale} : ${doc}.${section} ne se termine plus par « : » — ` +
            `le corpus a changé, relire cette assertion`,
        );
      }

      assert.deepEqual(
        problems.sort(),
        SECTIONS_SANS_VALEUR.map(([d, s]) => `${d}.${s}`).sort(),
        "Le corpus a changé. Si une adresse a été ajoutée, retire son entrée de " +
          "SECTIONS_SANS_VALEUR dans ce test.",
      );
    });
  }

  test("le contact DPO est un libellé sans valeur — ÉPINGLÉ", () => {
    // Défaut connu, documenté volontairement : ce test passe AUJOURD'HUI et
    // échouera le jour où le contact sera ajouté, pour rappeler de retirer
    // cette assertion. Un test de non-régression qui échoue sur un défaut
    // qu'on ne peut pas encore corriger rendrait la suite inutilisable.
    //
    // Ce qu'il protège : que le corpus ne CACHE PAS le problème. Si quelqu'un
    // remplace « Délégué à la protection des données (DPO) » par une adresse
    // sans mettre à jour ce test, on le voit immédiatement.
    for (const locale of LOCALES) {
      const controller =
        read(`messages/${locale}.json`).legal?.privacy?.sections?.controller;
      const contact = controller?.contact;
      if (contact === undefined) continue;

      // « Délégué à la protection des données (DPO) » est un LIBELLÉ : il dit
      // de qui il s'agit, sans dire comment le joindre.
      assert.match(
        String(contact),
        /\((?:DPO|email|adresse)\)\s*$/i,
        `${locale} : privacy.sections.controller.contact = « ${contact} » n'est ` +
          `plus un libellé sans valeur — le contact DPO a été ajouté. ` +
          `Supprime cette assertion et ajoute le test positif correspondant.`,
      );
    }
  });
});

describe("D43 — lastUpdated : aucune date inventée à l'écran", () => {
  for (const locale of LOCALES) {
    test(`${locale} — lastUpdated existe mais n'est pas rendu`, () => {
      const legal = read(`messages/${locale}.json`).legal;
      const rendered = readText(RENDERER);

      const present = DOCS.filter((d) => legal?.[d]?.lastUpdated);
      assert.ok(present.length > 0, "aucun lastUpdated : le test ne teste plus rien");

      // Le rendu peut mentionner la clé (il le documente), mais il ne doit ni la
      // lire pour l'afficher, ni substituer une date calculée à l'exécution.
      assert.equal(
        /t\(\s*["'`][^"'`]*lastUpdated/.test(rendered),
        false,
        `${locale} : le rendu lit lastUpdated alors qu'aucune date de rédaction ` +
          `n'existe. Il afficherait un {date} littéral.`,
      );
      assert.equal(
        /lastUpdated\s*\?\s*\(?\s*new Date\(\)/.test(rendered) ||
          /lastUpdated[\s\S]{0,80}new Date\(\)/.test(rendered),
        false,
        `${locale} : le rendu injecte new Date() dans lastUpdated — la page ` +
          `afficherait une date qui change à chaque build.`,
      );
    });
  }
});

describe("D43 — mentions : chaque champ a une valeur", () => {
  test("email est épinglé comme libellé sans valeur", () => {
    for (const locale of LOCALES) {
      const editor =
        read(`messages/${locale}.json`).legal?.mentions?.sections?.editor;
      if (!editor || typeof editor !== "object") continue;

      assert.equal(
        editor.email,
        "Email",
        `${locale} : mentions.sections.editor.email vaut « ${editor.email} ». ` +
          `Libellé sans valeur, alors que address, phone, siret, rcs, tva et ` +
          `director ont chacun leur *Value. Retirer cette assertion une fois ` +
          `l'adresse e-mail de l'éditeur ajoutée au corpus.`,
      );
    }
  });

  test("chaque champ *Value de editor est non vide", () => {
    for (const locale of LOCALES) {
      const editor =
        read(`messages/${locale}.json`).legal?.mentions?.sections?.editor;
      if (!editor || typeof editor !== "object") continue;

      for (const [key, value] of Object.entries(editor)) {
        if (key === "email") continue; // cas précédent, volontairement épinglé
        assert.ok(
          String(value ?? "").trim().length > 0,
          `${locale} : mentions.sections.editor.${key} est vide`,
        );
      }
    }
  });
});

describe("D43 — accessibilité : les pages légales sont atteignables", () => {
  const ROUTES = {
    cgu: "/cgu",
    confidentialite: "/confidentialite",
    mentions: "/mentions-legales",
    cookies: "/cookies",
  };

  for (const locale of LOCALES) {
    test(`${locale} — le footer déclare un lien vers chaque page légale`, () => {
      const columns = read(`messages/${locale}.json`).landing?.footer?.columns ?? [];
      const actions = columns.flatMap((c) => (c.links ?? []).map((l) => l.a));

      for (const action of Object.keys(ROUTES)) {
        assert.ok(
          actions.includes(action),
          `${locale} : le footer ne déclare aucun lien « ${action} » — la page ` +
            `${ROUTES[action]} est inaccessible depuis le site`,
        );
      }
    });
  }

  test("chaque action légale du footer pointe vers une page qui existe", () => {
    for (const locale of LOCALES) {
      const columns = read(`messages/${locale}.json`).landing?.footer?.columns ?? [];
      for (const col of columns) {
        for (const link of col.links ?? []) {
          const route = ROUTES[link.a];
          if (!route) continue;
          const page = path.join(
            REPO,
            "src/app/[locale]",
            route.slice(1),
            "page.tsx",
          );
          assert.ok(
            fs.existsSync(page),
            `${locale} : le footer pointe vers ${route} mais ` +
              `src/app/[locale]${route}/page.tsx n'existe pas`,
          );
        }
      }
    }
  });

  test("LEGAL_HREF mappe chaque action vers la bonne route", () => {
    const footer = readText("src/components/reboot/landing/site-footer.tsx");
    for (const [action, route] of Object.entries(ROUTES)) {
      assert.ok(
        new RegExp(`\\b${action}:\\s*"${route}"`).test(footer),
        `LEGAL_HREF ne mappe pas « ${action} » vers « ${route} » — le lien ` +
          `mènerait ailleurs`,
      );
    }
  });

  test("les deux locales déclarent les mêmes actions dans la colonne légale", () => {
    const actionsFor = (locale) => {
      const columns = read(`messages/${locale}.json`).landing?.footer?.columns ?? [];
      const legal = columns.find((c) => (c.links ?? []).some((l) => l.a === "cgu"));
      return (legal?.links ?? []).map((l) => l.a).sort();
    };
    assert.deepEqual(
      actionsFor("en"),
      actionsFor("fr"),
      "les colonnes légales FR et EN divergent — un lien serait orphelin dans une locale",
    );
  });
});