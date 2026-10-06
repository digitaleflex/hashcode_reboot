/**
 * Test de non-régression D27 — le menu latéral admin ne doit plus mentir.
 *
 * Run:  node --import tsx --test tests/admin-sections.test.cjs
 *
 * Contexte
 * --------
 * `SECTION_MAP` (route admin -> section du menu) couvrait 11 routes alors que
 * l'espace admin en compte 15 et que le menu déclare 14 sections. Sur
 * `/admin/ateliers`, `/admin/mentoring`, `/admin/email-templates` et
 * `/admin/blacklist`, `activeSectionId` retombait sur le défaut
 * `"section-stats"` : le menu affichait « Vue d'ensemble » pendant que l'admin
 * était sur une autre page.
 *
 * Ce fichier ne teste pas une liste recopiée : il LIT l'arborescence réelle
 * (`src/app/[locale]/admin/**\/page.tsx`) et exige que chaque route résolue
 * corresponde à une section du menu. **Ajouter une page admin suffit donc à
 * faire échouer ce test** — c'est le but : la régression ne peut pas revenir
 * en silence, elle exige une ligne dans `admin-sections.ts`.
 *
 * Couvert :
 *  - résolution de chaque route admin RÉELLE (lue sur le disque)
 *  - pages de détail : `/admin/ateliers/<id>`, `/admin/ateliers/submissions`
 *  - aucune entrée morte : toute route de `SECTION_MAP`/`SECTION_ROUTES`
 *    existe sur le disque, et réciproquement
 *  - aucune route admin ne retombe sur le défaut « Vue d'ensemble »
 *  - les 14 identifiants du menu sont bien ceux de `ADMIN_SECTION_IDS`, et
 *    chaque lien du menu pointe vers une page existante
 *  - `resolveAdminSectionId` : préfixe le plus long, slash final, absence de
 *    correspondance partielle entre segments, entrée absente
 *
 * Limite assumée : le menu est un composant React, il n'est pas importé (ni
 * JSX, ni `next/navigation`). Sa cohérence avec `admin-sections.ts` est donc
 * vérifiée sur son code source — et garantie à la compilation, puisque `id`
 * y est typé `AdminSectionId`.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ADMIN_SECTION_IDS,
  SECTION_MAP,
  SECTION_ROUTES,
  resolveAdminSectionId,
} = require("../src/components/reboot/admin/admin-sections.ts");

const ADMIN_DIR = path.join(__dirname, "..", "src", "app", "[locale]", "admin");
const SIDEBAR_FILE = path.join(
  __dirname,
  "..",
  "src",
  "components",
  "reboot",
  "admin",
  "AdminSidebar.tsx",
);

/**
 * Routes admin RÉELLES, lues sur le disque.
 *
 * Un dossier `_`-préfixé est privé (convention Next.js) et ne produit aucune
 * route ; un groupe `(...)` non plus. `page.tsx` à la racine de l'espace admin
 * donne la route `/admin` (qui redirige vers `/admin/dashboard`).
 */
function listRealAdminRoutes(dir = ADMIN_DIR, prefix = "/admin") {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_") || entry.name.startsWith("(")) continue;
      routes.push(...listRealAdminRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.name === "page.tsx") {
      routes.push(prefix);
    }
  }
  return routes.sort();
}

/** Rend une route concrète à partir d'un segment dynamique : `[id]` -> `exemple-123`. */
function concretize(route) {
  return route
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, "exemple-123")
    .replace(/\[\.\.\.[^\]]+\]/g, "exemple-123")
    .replace(/\[[^\]]+\]/g, "exemple-123");
}

const REAL_ROUTES = listRealAdminRoutes();

/** Entrées `path`/`id` déclarées par le menu, lues dans son code source. */
const SIDEBAR_ITEMS = [
  ...fs
    .readFileSync(SIDEBAR_FILE, "utf8")
    .matchAll(/\{\s*path:\s*"([^"]+)",\s*id:\s*"([^"]+)"/g),
].map((m) => ({ path: m[1], id: m[2] }));

describe("D27 — inventaire de l'espace admin", () => {
  test("l'arborescence réelle contient bien les routes attendues", () => {
    // Garde-fou : si l'inventaire ci-dessous devenait vide, tous les tests
    // suivants passeraient au vert sans rien vérifier.
    assert.ok(REAL_ROUTES.length >= 15, `attendu >= 15 routes, obtenu ${REAL_ROUTES.length}`);
    for (const expected of [
      "/admin",
      "/admin/dashboard",
      "/admin/stats",
      "/admin/members",
      "/admin/ateliers",
      "/admin/ateliers/submissions",
      "/admin/ateliers/[id]",
      "/admin/mentoring",
      "/admin/invitations",
      "/admin/marketing",
      "/admin/email-deliverability",
      "/admin/email-templates",
      "/admin/events",
      "/admin/activity",
      "/admin/exports",
      "/admin/blacklist",
      "/admin/audit-log",
      "/admin/settings",
    ]) {
      assert.ok(REAL_ROUTES.includes(expected), `route absente du disque : ${expected}`);
    }
    // Le dossier privé `events/_components` ne doit pas devenir une route.
    assert.ok(!REAL_ROUTES.some((r) => r.includes("/_components")));
  });
});

describe("D27 — chaque route admin réelle résout une section du menu", () => {
  for (const route of REAL_ROUTES) {
    for (const candidate of [route, concretize(route)]) {
      test(`${candidate} -> section connue`, () => {
        const sectionId = resolveAdminSectionId(candidate);
        assert.ok(
          sectionId,
          `route admin sans section : ${candidate} (le menu afficherait « Vue d'ensemble »)`,
        );
        assert.ok(
          ADMIN_SECTION_IDS.includes(sectionId),
          `section inconnue pour ${candidate} : ${sectionId}`,
        );
      });
    }
  }

  test("aucune route admin ne retombe sur le défaut « Vue d'ensemble »", () => {
    // `/admin` et `/admin/dashboard` et `/admin/stats` TOMBENT volontairement
    // sur `section-stats` : c'est leur section. Toutes les autres, non.
    const LEGITIMATE_DEFAULT = new Set([
      "/admin",
      "/admin/dashboard",
      "/admin/stats",
    ]);
    const lying = REAL_ROUTES.filter(
      (route) =>
        !LEGITIMATE_DEFAULT.has(route) &&
        resolveAdminSectionId(concretize(route)) === "section-stats",
    );
    assert.deepEqual(lying, [], `menu qui affiche « Vue d'ensemble » à tort : ${lying.join(", ")}`);
  });

  test("les 4 pages de D27 sont résolues (et ne l'étaient pas avant)", () => {
    // Régression ciblée : ces 4 routes tombaient sur le défaut.
    assert.equal(resolveAdminSectionId("/admin/ateliers"), "section-ateliers");
    assert.equal(resolveAdminSectionId("/admin/mentoring"), "section-mentoring");
    assert.equal(resolveAdminSectionId("/admin/email-templates"), "section-email-templates");
    assert.equal(resolveAdminSectionId("/admin/blacklist"), "section-blacklist");
  });

  test("les pages de détail retombent sur la section parente", () => {
    assert.equal(resolveAdminSectionId("/admin/ateliers/submissions"), "section-ateliers");
    assert.equal(resolveAdminSectionId("/admin/ateliers/42"), "section-ateliers");
    assert.equal(resolveAdminSectionId("/admin/ateliers/42/"), "section-ateliers");
  });
});

describe("D27 — aucune entrée morte (l'erreur inverse)", () => {
  test("toute route de SECTION_MAP existe sur le disque", () => {
    for (const route of Object.keys(SECTION_MAP)) {
      assert.ok(
        REAL_ROUTES.includes(route),
        `SECTION_MAP pointe vers une route inexistante : ${route}`,
      );
    }
  });

  test("toute route de SECTION_ROUTES existe sur le disque", () => {
    for (const [sectionId, route] of Object.entries(SECTION_ROUTES)) {
      assert.ok(
        REAL_ROUTES.includes(route),
        `${sectionId} navigue vers une route inexistante : ${route}`,
      );
    }
  });

  test("SECTION_ROUTES couvre les 14 sections du menu", () => {
    assert.deepEqual(
      Object.keys(SECTION_ROUTES).sort(),
      [...ADMIN_SECTION_IDS].sort(),
      "toute section du menu doit avoir une route d'atterrissage",
    );
  });
});

describe("D27 — le menu et le référentiel disent la même chose", () => {
  test("AdminSidebar déclare exactement les 14 sections", () => {
    assert.equal(
      SIDEBAR_ITEMS.length,
      ADMIN_SECTION_IDS.length,
      `menu : ${SIDEBAR_ITEMS.length} entrées, référentiel : ${ADMIN_SECTION_IDS.length}`,
    );
    assert.deepEqual(
      SIDEBAR_ITEMS.map((i) => i.id).sort(),
      [...ADMIN_SECTION_IDS].sort(),
    );
  });

  test("chaque lien du menu mène à une page qui existe", () => {
    for (const item of SIDEBAR_ITEMS) {
      assert.ok(
        REAL_ROUTES.includes(item.path),
        `le menu propose ${item.path} (${item.id}) mais la page n'existe pas`,
      );
      assert.equal(
        resolveAdminSectionId(item.path),
        item.id,
        `${item.path} ne se résout pas sur son propre identifiant de section`,
      );
    }
  });

  test("la route du menu et la route d'atterrissage concordent", () => {
    for (const item of SIDEBAR_ITEMS) {
      assert.equal(
        SECTION_ROUTES[item.id],
        item.path,
        `le menu pointe vers ${item.path} mais SECTION_ROUTES[${item.id}] vaut ${SECTION_ROUTES[item.id]}`,
      );
    }
  });
});

describe("resolveAdminSectionId", () => {
  test("résolution exacte", () => {
    assert.equal(resolveAdminSectionId("/admin/members"), "section-members");
    assert.equal(resolveAdminSectionId("/admin/settings"), "section-settings");
  });

  test("le préfixe le plus long gagne", () => {
    assert.equal(resolveAdminSectionId("/admin/email-deliverability"), "section-email-deliverability");
    assert.equal(resolveAdminSectionId("/admin/email-templates"), "section-email-templates");
    // Une route inconnue SOUS `/admin` reste dans l'espace admin : elle
    // appartient à l'arbre admin, donc à sa racine, pas à une autre section.
    assert.equal(resolveAdminSectionId("/admin/inexistant"), "section-stats");
  });

  test("les segments sont comparés en entier", () => {
    // `/admin` ne doit pas attraper `/administrator` ni `/adminx`.
    assert.equal(resolveAdminSectionId("/administrator"), undefined);
    assert.equal(resolveAdminSectionId("/adminx"), undefined);
    // Une route hors espace admin n'appartient à aucune section.
    assert.equal(resolveAdminSectionId("/dashboard"), undefined);
    assert.equal(resolveAdminSectionId("/admin-ish/members"), undefined);
  });

  test("slash final toléré", () => {
    assert.equal(resolveAdminSectionId("/admin/members/"), "section-members");
  });

  test("entrée absente ou vide", () => {
    assert.equal(resolveAdminSectionId(undefined), undefined);
    assert.equal(resolveAdminSectionId(null), undefined);
    assert.equal(resolveAdminSectionId(""), undefined);
    assert.equal(resolveAdminSectionId("/"), undefined);
    assert.equal(resolveAdminSectionId("/dashboard"), undefined);
  });
});