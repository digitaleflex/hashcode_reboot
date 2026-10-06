/**
 * Test de non-regression — les quatre pages legales branchees sur `legal.*` (D21).
 *
 * Run:  node --import tsx --test tests/legal-content.test.cjs
 *
 * POURQUOI CE TEST EXISTE
 *
 * Jusqu'a D21, `/cgu`, `/confidentialite`, `/mentions-legales` et `/cookies`
 * rendaient toutes `PendingLegalDocument` — un composant qui annoncait « ce
 * document n'est pas publie » alors que `legal.terms`, `legal.privacy`,
 * `legal.mentions` et `legal.cookies` etaient deja presents et complets dans
 * `messages/fr.json` ET `messages/en.json`. Le texte existe, traduit, revise,
 * et n'etait jamais affiche.
 *
 * Branche, il est desormais publie : une cle absente, une cle vide en `en`, ou
 * un placeholder ICU oublie se verrait a l'ecran. Ce test verrouille les trois.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { LEGAL_DOCUMENTS, legalValueKey, resolveLegalNode } = require("../src/lib/legal-content.ts");

const ROOT = path.join(__dirname, "..");
const LOCALES = ["fr", "en"];
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8")),
  ]),
);

/** Les quatre routes, leur namespace, et le dossier de page qui doit le lire. */
const PAGES = [
  { route: "/cgu", namespace: "legal.terms", doc: "terms", folder: "cgu" },
  { route: "/confidentialite", namespace: "legal.privacy", doc: "privacy", folder: "confidentialite" },
  { route: "/mentions-legales", namespace: "legal.mentions", doc: "mentions", folder: "mentions-legales" },
  { route: "/cookies", namespace: "legal.cookies", doc: "cookies", folder: "cookies" },
];

/** Cles scalaires rendues par le composant, hors `sections`. */
const HEADER_KEYS = ["title", "subtitle", "backHome", "navAria"];

/** Cles de metadonnees rendues par `generateMetadata`. */
const META_KEYS = ["metaTitle", "metaDescription"];

/** Libellés de la navigation croisee rendue en bas de chaque page. */
const NAV_KEYS = Object.keys(LEGAL_DOCUMENTS);

/** Lit un chemin pointé dans les messages d'une locale. */
function read(locale, dotted) {
  return dotted
    .split(".")
    .reduce((acc, key) => (acc === null || acc === undefined ? acc : acc[key]), messages[locale]);
}

/** Aplatit un noeud en [chemin, texte] pour toutes les chaines qu'il contient. */
function strings(node, dotted) {
  if (typeof node === "string") return [[dotted, node]];
  if (Array.isArray(node)) return node.flatMap((item, index) => strings(item, `${dotted}[${index}]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => strings(value, `${dotted}.${key}`));
  }
  return [];
}

/** Copie profonde minimale, pour tester le corpus sans le modifier. */
function clone(value) {
  return Array.isArray(value)
    ? value.map(clone)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]))
      : value;
}

/** Placeholders ICU presents dans un texte. */
function placeholders(text) {
  return [...text.matchAll(/(?<!\{)\{([a-zA-Z0-9_]+)\}(?!\})/g)].map((m) => m[1]);
}

describe("D21 — correspondance route -> legal.*", () => {
  test("chaque route declaree sert bien le document du meme nom", () => {
    assert.deepEqual(Object.keys(LEGAL_DOCUMENTS), PAGES.map((page) => page.doc));
    for (const page of PAGES) {
      assert.equal(LEGAL_DOCUMENTS[page.doc], page.route, `${page.doc} : route inattendue`);
    }
  });

  test("chaque page lit le namespace de sa route", () => {
    for (const page of PAGES) {
      const source = fs.readFileSync(path.join(ROOT, "src", "app", "[locale]", page.folder, "page.tsx"), "utf8");
      const namespace = source.match(/namespace:\s*"([^"]+)"/);
      const doc = source.match(/<LegalDocumentBody\s+doc="([^"]+)"/);

      assert.ok(namespace, `${page.folder}/page.tsx : aucun namespace lisible`);
      assert.ok(doc, `${page.folder}/page.tsx : aucun <LegalDocumentBody doc="..." />`);
      assert.equal(namespace[1], page.namespace, `${page.folder} : mauvais namespace`);
      assert.equal(doc[1], page.doc, `${page.folder} : mauvais document`);
      assert.equal(namespace[1], `legal.${doc[1]}`, `${page.folder} : namespace et document divergents`);
    }
  });

  test("plus aucune page ne rend le composant « document non publie »", () => {
    assert.equal(
      fs.existsSync(path.join(ROOT, "src", "components", "reboot", "legal", "pending-document.tsx")),
      false,
      "pending-document.tsx aurait dû être supprimé",
    );
  });
});

describe("D21 — le contenu branche existe et n'est pas vide, dans les deux locales", () => {
  for (const page of PAGES) {
    test(`${page.route} : ${page.namespace} est complet en fr ET en`, () => {
      for (const locale of LOCALES) {
        const document = read(locale, page.namespace);
        const label = `${locale} ${page.namespace}`;

        assert.ok(document, `${label} : namespace absent`);
        for (const key of [...HEADER_KEYS, ...META_KEYS]) {
          assert.equal(typeof document[key], "string", `${label}.${key} : absent`);
          assert.ok(document[key].trim() !== "", `${label}.${key} : vide — la page n'afficherait rien`);
        }
        for (const key of NAV_KEYS) {
          assert.equal(typeof document.nav?.[key], "string", `${label}.nav.${key} : absent`);
          assert.ok(document.nav[key].trim() !== "", `${label}.nav.${key} : vide`);
        }
        assert.ok(
          Object.keys(document.sections ?? {}).length > 0,
          `${label}.sections : aucune section — la page serait vide`,
        );
      }
    });

    test(`${page.route} : aucun texte affiche n'est vide, dans les deux locales`, () => {
      for (const locale of LOCALES) {
        const document = read(locale, page.namespace);
        const displayed = [
          ...[...HEADER_KEYS, ...META_KEYS].map((key) => [`${page.namespace}.${key}`, document[key]]),
          ...NAV_KEYS.map((key) => [`${page.namespace}.nav.${key}`, document.nav[key]]),
          ...strings(document.sections, `${page.namespace}.sections`),
        ];

        assert.ok(displayed.length > 0, `${locale} ${page.namespace} : rien à afficher`);
        for (const [dotted, text] of displayed) {
          assert.equal(typeof text, "string", `${dotted} : attendu un texte`);
          assert.ok(text.trim() !== "", `${dotted} : vide — le rendu afficherait un bloc vide`);
        }
      }
    });

    test(`${page.route} : l'arborescence EN est identique a celle de FR`, () => {
      const fr = strings(read("fr", `${page.namespace}.sections`), "sections").map(([key]) => key);
      const en = strings(read("en", `${page.namespace}.sections`), "sections").map(([key]) => key);

      assert.deepEqual(
        en,
        fr,
        `${page.namespace} : l'arborescence EN diverge de FR — une section serait absente en anglais`,
      );
    });

    test(`${page.route} : chaque section a un titre non vide`, () => {
      for (const locale of LOCALES) {
        for (const [id, section] of Object.entries(read(locale, `${page.namespace}.sections`))) {
          assert.equal(typeof section.title, "string", `${locale} ${page.namespace}.sections.${id}.title : absent`);
          assert.ok(
            section.title.trim() !== "",
            `${locale} ${page.namespace}.sections.${id}.title : vide`,
          );
        }
      }
    });
  }
});

describe("D21 — placeholders ICU du corpus", () => {
  test("les seuls placeholders sont ceux que le rendu sait resoudre", () => {
    // Un Set : les deux locales doivent porter exactement les memes cles.
    const found = [
      ...new Set(
        LOCALES.flatMap((locale) =>
          strings(messages[locale].legal, "legal")
            .flatMap(([dotted, text]) => placeholders(text).map((name) => `${dotted}:{${name}}`)),
        ),
      ),
    ].sort();

    // `lastUpdated` n'est pas rendu : le dépôt ne porte aucune date de
    // rédaction, et afficher un `{date}` littéral serait pire que de ne rien
    // afficher. Toute autre valeur doit être fournie par le composant.
    assert.deepEqual(
      found.sort(),
      [
        "legal.cookies.lastUpdated:{date}",
        "legal.mentions.lastUpdated:{date}",
        "legal.privacy.lastUpdated:{date}",
        "legal.privacy.sections.rights.exercise:{email}",
        "legal.terms.lastUpdated:{date}",
      ],
      "un placeholder ICU inconnu est apparu dans legal.* : le rendu l'afficherait littéralement",
    );
  });

  test("le composant fournit bien la valeur du placeholder {email}", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "src", "components", "reboot", "legal", "legal-document.tsx"),
      "utf8",
    );

    assert.match(source, /sections\.rights\.exercise/, "le rendu ne cite plus le texte a interpoler");
    assert.match(source, /email: CONTACT_EMAIL/, "le rendu ne fournit plus l'adresse de contact");
  });

  test("le placeholder {email} disparait une fois resolu", () => {
    const raw = read("fr", "legal.privacy.sections.rights.exercise");
    const resolved = resolveLegalNode(raw, "sections.rights.exercise", (key) =>
      key === "sections.rights.exercise" ? raw.replace("{email}", "contact@hashcode.reboot") : raw,
    );

    assert.equal(typeof resolved, "string");
    assert.ok(!resolved.includes("{email}"), "{email} ne doit pas atteindre le rendu");
    assert.ok(resolved.includes("contact@hashcode.reboot"));
  });
});

describe("D21 — une cle vide n'est jamais affichee", () => {
  /**
   * Un scalaire est rendu via le lecteur (interpolation ICU) : c'est le TEXTE
   * RENDU qui compte. Un lecteur qui renvoie du vide simule une traduction
   * videuse — elle ne doit produire aucun noeud.
   */
  const blank = () => "";
  const filled = () => "texte";

  test("un scalaire dont le rendu est vide est elimine", () => {
    assert.equal(resolveLegalNode("texte", "sections.x.content1", blank), null);
    assert.equal(resolveLegalNode("texte", "sections.x.content1", () => "   "), null);
  });

  test("une liste entierement vide est eliminee", () => {
    assert.equal(resolveLegalNode(["", "  "], "sections.x.items", filled), null);
  });

  test("une liste a trous garde ses elements non vides", () => {
    assert.deepEqual(resolveLegalNode(["un", "", "deux"], "sections.x.items", filled), ["un", "deux"]);
  });

  test("un bloc dont tous les champs sont vides est elimine", () => {
    assert.equal(resolveLegalNode({ a: "texte", b: "texte" }, "sections.x", blank), null);
  });

  test("les valeurs non vides sont conservees : scalaires via le lecteur, tableaux bruts", () => {
    const resolved = resolveLegalNode(
      { content1: "un paragraphe", items: ["un", "deux"] },
      "sections.x",
      filled,
    );

    assert.deepEqual(Object.keys(resolved), ["content1", "items"]);
    assert.equal(resolved.content1, "texte");
    assert.deepEqual(resolved.items, ["un", "deux"]);
  });

  test("vider une cle du corpus la fait disappear du rendu", () => {
    // Test de bout en bout sur le vrai corpus : on vide une section entiere et
    // on verifie qu'elle ne produit plus aucun noeud affichable.
    const sections = clone(read("fr", "legal.terms.sections"));
    for (const key of Object.keys(sections.liability)) {
      sections.liability[key] = "";
    }

    assert.equal(resolveLegalNode(sections.liability, "sections.liability", blank), null);
  });
});

describe("D21 — fiches label/valeur des mentions legales", () => {
  /**
   * Anomalie connue du corpus, constatee en D21 et NON corrigee : le texte
   * juridique ne se corrige pas dans une tache de branchement.
   * `legal.mentions.sections.editor.email` vaut « Email » — un libelle sans
   * valeur, la ou `address`, `phone`, `siret`, `rcs`, `tva` et `director` ont
   * chacun leur `*Value`. Le rendu l'affiche donc tel quel, seul sur sa ligne.
   * Si le corpus evolue, cette liste doit etre revue explicitement.
   */
  const KNOWN_ORPHANS = [
    "en legal.mentions.sections.editor.email",
    "fr legal.mentions.sections.editor.email",
  ];

  /** Parcourt les champs d'une fiche et renvoie les paires + les orphelins. */
  function pairs(section) {
    const keys = Object.keys(section).filter((key) => key !== "title");
    const consumed = new Set();
    const matched = [];
    const orphans = [];

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (consumed.has(key)) continue;
      if (typeof section[key] !== "string") continue;

      const valueKey = legalValueKey(key);
      if (valueKey === null) continue;

      if (keys[index + 1] === valueKey) {
        consumed.add(valueKey);
        matched.push([key, valueKey]);
      } else {
        orphans.push(key);
      }
    }

    return { matched, orphans };
  }

  test("les libelles sans valeur sont exactement ceux deja releves", () => {
    const orphans = [];

    for (const locale of LOCALES) {
      for (const id of ["editor", "hosting"]) {
        for (const key of pairs(read(locale, `legal.mentions.sections.${id}`)).orphans) {
          orphans.push(`${locale} legal.mentions.sections.${id}.${key}`);
        }
      }
    }

    assert.deepEqual(
      orphans.sort(),
      KNOWN_ORPHANS,
      "libelle(s) sans valeur inattendu(s) dans les mentions legales : le rendu doit etre arbitre",
    );
  });

  test("chaque paire libelle/valeur est complete et non vide", () => {
    for (const locale of LOCALES) {
      for (const id of ["editor", "hosting"]) {
        const section = read(locale, `legal.mentions.sections.${id}`);
        const { matched } = pairs(section);

        assert.ok(matched.length > 0, `${locale} legal.mentions.sections.${id} : aucune paire`);
        for (const [, valueKey] of matched) {
          assert.equal(typeof section[valueKey], "string", `${valueKey} : absent`);
          assert.ok(
            section[valueKey].trim() !== "",
            `${locale} legal.mentions.sections.${id}.${valueKey} : valeur vide`,
          );
        }
      }
    }
  });
});
