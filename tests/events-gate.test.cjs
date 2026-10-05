/**
 * Unit tests — gate Event #79 : fuseaux horaires + filtres publics.
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/events-gate.test.cjs
 *
 * Ce test importe les VRAIS modules — pas de miroir :
 *  - src/lib/events-timezone.ts (zoneForCountry, safeTimeZone, format*,
 *    localTimeNote)
 *  - src/lib/event-period.ts (matchesPeriod)
 *  - src/lib/public-events.ts (normalizeEventFilters)
 *
 * L'argument « .cjs can't import TS » était faux : c'est le runner qui charge
 * `tsx` (`npm run test:unit` → `node --import tsx --test`), pas l'extension du
 * fichier de test.
 *
 * Deux précautions :
 *
 *  1. `normalizeEventFilters` vit dans `public-events.ts`, qui importe
 *     `@/lib/db` → le test doit disposer d'un client Prisma généré
 *     (`npm ci` le fait via postinstall, `ci.yml` fait `npx prisma generate`
 *     explicitement). Aucune connexion n'est ouverte : seul l'import a lieu.
 *
 *  2. `Intl` rend les chaînes selon les données CLDR de la version d'ICU :
 *     le séparateur des heures peut être une espace normale (U+0020) ou une
 *     espace fine insécable (U+202F). On normalise donc ces espaces avant
 *     comparaison — sans quoi le test passerait en local et échouerait en CI.
 *     Ce n'est PAS une tolérance sur l'heure affichée : « 20:00 » reste exigé
 *     au caractère près.
 *
 * `COUNTRY_TIME_ZONE` n'est pas exporté (usage interne) : la table réelle est
 * donc relue depuis le texte de la source, comme le fait déjà
 * `tests/email-categories.test.cjs`.
 *
 * Coverage:
 *  - zoneForCountry : Bénin→référence, casse/espaces, TG=Togo (Lomé),
 *    TD=Tchad (Ndjamena) — non-régression du bug pays TG/TD —, inconnu→repli
 *    + avertissement, un seul avertissement par pays
 *  - table réelle : 111 pays, toutes les zones valides pour Intl, chaque pays
 *    renvoie bien sa zone
 *  - safeTimeZone / isValidTimeZone : invalide→référence, jamais d'exception
 *  - formatEventMoment : 19:00Z → 20:00 à Porto-Novo (le bug email d'origine),
 *    cohérence date + " à " + heure
 *  - localTimeNote : null quand même horloge que la référence (BJ, CM),
 *    note mentionnant UTC+1 quand décalage réel (US)
 *  - normalizeEventFilters : défauts, bornes 1..50, enums invalides écartées
 *  - matchesPeriod : semaine lundi→dimanche, bornes incluses, mois courant
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  REFERENCE_TIME_ZONE,
  REFERENCE_LABEL,
  zoneForCountry,
  isValidTimeZone,
  safeTimeZone,
  formatEventDate,
  formatClock,
  formatEventMoment,
  localTimeNote,
} = require("../src/lib/events-timezone.ts");
const { matchesPeriod } = require("../src/lib/event-period.ts");
const { normalizeEventFilters } = require("../src/lib/public-events.ts");

/** Espaces exotiques d'Intl (U+00A0, U+202F, U+2009) → espace normale. */
const nbsp = (s) => s.replace(/[\u00A0\u202F\u2009]/g, " ");

/** Table COUNTRY_TIME_ZONE relue dans la source (non exportée). */
const TZ_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "src/lib/events-timezone.ts"),
  "utf8",
);
const TZ_TABLE_BLOCK = TZ_SOURCE.slice(
  TZ_SOURCE.indexOf("const COUNTRY_TIME_ZONE"),
  TZ_SOURCE.indexOf("const warnedCountries"),
);
const COUNTRY_TIME_ZONE = [...TZ_TABLE_BLOCK.matchAll(/([A-Z]{2}):\s*"([^"]+)"/g)].map((m) => ({
  country: m[1],
  zone: m[2],
}));

/** Capture les console.warn le temps de l'appel (la fonction en émet). */
function captureWarnings(fn) {
  const warnings = [];
  const real = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    fn();
  } finally {
    console.warn = real;
  }
  return warnings;
}

// ── Tests ──

describe("zoneForCountry", () => {
  test("Bénin → zone de référence", () => {
    assert.equal(zoneForCountry("BJ"), "Africa/Porto-Novo");
    assert.equal(REFERENCE_TIME_ZONE, "Africa/Porto-Novo");
    assert.equal(REFERENCE_LABEL, "UTC+1");
  });

  test("insensible à la casse et aux espaces", () => {
    assert.equal(zoneForCountry(" bj "), "Africa/Porto-Novo");
    assert.equal(zoneForCountry("fr"), "Europe/Paris");
  });

  test("TG = Togo (Lomé), TD = Tchad (Ndjamena) — non-régression bug TG/TD", () => {
    assert.equal(zoneForCountry("TG"), "Africa/Lome");
    assert.equal(zoneForCountry("TD"), "Africa/Ndjamena");
    assert.notEqual(zoneForCountry("TG"), zoneForCountry("TD"));
  });

  test("vide → repli référence, sans exception ni avertissement", () => {
    // Un membre sans pays renseigné ne doit pas produire de log : le repli est
    // silencieux, seuls les pays INCONNUS sont signalés.
    const warnings = captureWarnings(() => {
      assert.equal(zoneForCountry(null), REFERENCE_TIME_ZONE);
      assert.equal(zoneForCountry(undefined), REFERENCE_TIME_ZONE);
      assert.equal(zoneForCountry(""), REFERENCE_TIME_ZONE);
      assert.equal(zoneForCountry("   "), REFERENCE_TIME_ZONE);
    });
    assert.equal(warnings.length, 0, warnings.join(" | "));
  });

  test("inconnu → repli référence + avertissement nommant le pays", () => {
    // GB est volontairement absent de la table (voir le test de table plus bas).
    const warnings = captureWarnings(() => {
      assert.equal(zoneForCountry("XX"), REFERENCE_TIME_ZONE);
      assert.equal(zoneForCountry("GB"), REFERENCE_TIME_ZONE);
    });
    assert.equal(warnings.length, 2, warnings.join(" | "));
    assert.ok(warnings[0].includes("XX"), warnings[0]);
    assert.ok(warnings[0].includes(REFERENCE_TIME_ZONE), warnings[0]);
    assert.ok(warnings[1].includes("GB"), warnings[1]);
  });

  test("un seul avertissement par pays (pas de log flood)", () => {
    const warnings = captureWarnings(() => {
      assert.equal(zoneForCountry("ZZ"), REFERENCE_TIME_ZONE);
      assert.equal(zoneForCountry("ZZ"), REFERENCE_TIME_ZONE);
      assert.equal(zoneForCountry("ZZ"), REFERENCE_TIME_ZONE);
    });
    assert.equal(warnings.length, 1, `attendu 1 avertissement, reçu ${warnings.length}`);
  });
});

describe("table COUNTRY_TIME_ZONE (source relue, non exportée)", () => {
  test("elle couvre bien la communauté (garde-fou anti-troncature)", () => {
    assert.ok(
      COUNTRY_TIME_ZONE.length >= 100,
      `table trop courte : ${COUNTRY_TIME_ZONE.length} pays (111 attendus)`,
    );
    const codes = COUNTRY_TIME_ZONE.map((e) => e.country);
    assert.equal(new Set(codes).size, codes.length, "code pays dupliqué dans la table");
  });

  test("toutes les zones de la VRAIE table sont valides pour Intl", () => {
    // Le miroir ne couvrait que 33 pays sur 111 : une zone fausse passée in
    //aperçue décalait silencieusement les notifications (cf. JSDoc du module).
    for (const { country, zone } of COUNTRY_TIME_ZONE) {
      assert.ok(isValidTimeZone(zone), `${country} → ${zone} invalide pour Intl`);
    }
  });

  test("chaque pays mappé renvoie bien la zone de la table", () => {
    for (const { country, zone } of COUNTRY_TIME_ZONE) {
      assert.equal(zoneForCountry(country), zone, country);
    }
  });

  test("GB est absent de la table (repli assumé sur la référence)", () => {
    assert.equal(
      COUNTRY_TIME_ZONE.some((e) => e.country === "GB"),
      false,
    );
  });
});

describe("safeTimeZone / isValidTimeZone", () => {
  test("zone valide conservée, invalide → référence", () => {
    assert.ok(isValidTimeZone("Africa/Porto-Novo"));
    assert.ok(!isValidTimeZone("Mars/Olympus"));
    assert.equal(safeTimeZone("Europe/Paris"), "Europe/Paris");
    assert.equal(safeTimeZone("Mars/Olympus"), REFERENCE_TIME_ZONE);
    assert.equal(safeTimeZone(null), REFERENCE_TIME_ZONE);
    assert.equal(safeTimeZone(""), REFERENCE_TIME_ZONE);
  });

  test("les formateurs sont mémoïsés par zone mais rendent la même chose", () => {
    const d = new Date("2026-09-19T19:00:00.000Z");
    // Deux appels successifs (caché Map) + une zone qui passe par le repli.
    assert.equal(formatEventDate(d, "Africa/Douala"), formatEventDate(d, "Africa/Douala"));
    assert.equal(formatEventDate(d, "Mars/Olympus"), formatEventDate(d, REFERENCE_TIME_ZONE));
    assert.equal(formatClock(d, "Mars/Olympus"), formatClock(d, REFERENCE_TIME_ZONE));
  });
});

describe("formatEventMoment (bug email d'origine)", () => {
  // Samedi 19 septembre 2026, 19:00 UTC = 20:00 à Porto-Novo (UTC+1).
  const d = new Date("2026-09-19T19:00:00.000Z");

  test("19:00Z rend 20:00 dans la zone du destinataire, pas celle du serveur", () => {
    // Logique métier : conversion de fuseau horaire (UTC → UTC+1), jour inchangé.
    assert.equal(
      nbsp(formatEventMoment(d, REFERENCE_TIME_ZONE)),
      "samedi 19 septembre à 20:00",
    );
    // Le jour ne doit pas être le précédent (18) ni le suivant (20).
    assert.ok(!nbsp(formatEventMoment(d, REFERENCE_TIME_ZONE)).includes("18"));
    assert.ok(!nbsp(formatEventMoment(d, REFERENCE_TIME_ZONE)).includes(" 20 "));
  });

  test("un fuseau d'été donne bien une heure d'été (Europe/Paris, CEST = UTC+2)", () => {
    assert.equal(nbsp(formatClock(d, "Europe/Paris")), "21:00");
  });

  test("cohérence : moment = date + ' à ' + heure", () => {
    const z = "Africa/Douala";
    assert.equal(
      formatEventMoment(d, z),
      `${formatEventDate(d, z)} à ${formatClock(d, z)}`,
    );
  });

  test("zone invalide → repli référence, jamais d'exception", () => {
    assert.equal(
      formatEventMoment(d, "Mars/Olympus"),
      formatEventMoment(d, REFERENCE_TIME_ZONE),
    );
  });
});

describe("localTimeNote", () => {
  const d = new Date("2026-09-19T19:00:00.000Z");

  test("null quand même horloge que la référence (BJ, CM/Douala)", () => {
    assert.equal(localTimeNote(d, "Africa/Porto-Novo"), null);
    assert.equal(localTimeNote(d, "Africa/Douala"), null);
  });

  test("note mentionnant UTC+1 quand décalage réel (New York)", () => {
    const note = localTimeNote(d, "America/New_York");
    assert.equal(
      note,
      "Heure affichée dans ton fuseau local. Le groupe annonce les horaires en UTC+1.",
    );
    // La note n'apparaît que parce que les horloges diffèrent vraiment.
    assert.notEqual(formatClock(d, "America/New_York"), formatClock(d, REFERENCE_TIME_ZONE));
    assert.equal(nbsp(formatClock(d, "America/New_York")), "15:00");
  });

  test("zone invalide → repli sur la référence → pas de note", () => {
    assert.equal(localTimeNote(d, "Mars/Olympus"), null);
  });
});

describe("normalizeEventFilters", () => {
  test("défauts : limite 20, pas de filtres", () => {
    assert.deepEqual(normalizeEventFilters({}), { type: undefined, domain: undefined, limit: 20 });
  });

  test("bornes : 0→1, 999→50, NaN→20, décimal tronqué", () => {
    assert.equal(normalizeEventFilters({ limit: 0 }).limit, 1);
    assert.equal(normalizeEventFilters({ limit: 999 }).limit, 50);
    assert.equal(normalizeEventFilters({ limit: NaN }).limit, 20);
    assert.equal(normalizeEventFilters({ limit: 7.9 }).limit, 7);
    assert.equal(normalizeEventFilters({ limit: null }).limit, 20);
  });

  test("enums : valeurs valides gardées, invalides écartées", () => {
    const ok = normalizeEventFilters({ type: "webinar", domain: "ai" });
    assert.equal(ok.type, "webinar");
    assert.equal(ok.domain, "ai");
    const ko = normalizeEventFilters({ type: "party", domain: "crypto" });
    assert.equal(ko.type, undefined);
    assert.equal(ko.domain, undefined);
  });
});

describe("matchesPeriod", () => {
  // Lundi 5 octobre 2026, 10:00 (heure locale). 4 oct 2026 = dimanche,
  // 5 = lundi, 11 = dimanche, 12 = lundi.
  // Toutes les dates sont construites en heure locale des deux côtés (bornes
  // et événement) : le verdict ne dépend donc pas du fuseau du processus.
  const now = new Date(2026, 9, 5, 10, 0, 0, 0);
  const at = (d, h, m = 0, s = 0, ms = 0) => new Date(2026, 9, d, h, m, s, ms);

  test("« all » accepte tout, même une date passée", () => {
    assert.equal(matchesPeriod(at(1, 9).toISOString(), "all", now), true);
    assert.equal(matchesPeriod("2020-01-01T09:00:00.000Z", "all", now), true);
  });

  test("« week » = semaine calendaire lundi → dimanche (non-régression)", () => {
    // Toute la semaine en cours.
    assert.equal(matchesPeriod(at(5, 9).toISOString(), "week", now), true); // lundi
    assert.equal(matchesPeriod(at(7, 19).toISOString(), "week", now), true); // mercredi
    assert.equal(matchesPeriod(at(10, 23).toISOString(), "week", now), true); // samedi
    assert.equal(matchesPeriod(at(11, 23).toISOString(), "week", now), true); // dimanche
  });

  test("le dimanche NE fait PAS partie de la semaine qui commence le lundi", () => {
    // Bug corrigé : la fenêtre était derivée du jour de l'événement et
    // démarrait le dimanche. Dimanche 4 octobre appartient à la semaine
    // précédente : il doit être exclu.
    assert.equal(matchesPeriod(at(4, 19).toISOString(), "week", now), false);
    assert.equal(matchesPeriod(at(12, 9).toISOString(), "week", now), false); // lundi suivant
  });

  test("bornes incluses : lundi 00:00:00.000 et dimanche 23:59:59.999", () => {
    assert.equal(matchesPeriod(at(5, 0, 0, 0, 0).toISOString(), "week", now), true); // début inclus
    assert.equal(matchesPeriod(at(11, 23, 59, 59, 999).toISOString(), "week", now), true); // fin incluse
    assert.equal(matchesPeriod(at(4, 23, 59, 59, 999).toISOString(), "week", now), false); // veille
    assert.equal(matchesPeriod(at(12, 0, 0, 0, 0).toISOString(), "week", now), false); // lundi suivant
  });

  test("la fenêtre ne dépend pas du jour de la semaine de l'événement", () => {
    // Même événement, deux « aujourd'hui » de la même semaine -> même verdict.
    const event = at(9, 19).toISOString(); // vendredi
    assert.equal(matchesPeriod(event, "week", new Date(2026, 9, 5, 8)), true); // lundi
    assert.equal(matchesPeriod(event, "week", new Date(2026, 9, 9, 20)), true); // vendredi
    assert.equal(matchesPeriod(event, "week", new Date(2026, 9, 11, 22)), true); // dimanche
    assert.equal(matchesPeriod(event, "week", new Date(2026, 9, 12, 8)), false); // lundi +1
  });

  test("« month » = mois calendaire en cours, bornes incluses", () => {
    assert.equal(matchesPeriod(at(1, 0, 0, 0, 0).toISOString(), "month", now), true);
    assert.equal(matchesPeriod(at(31, 23, 59, 59, 999).toISOString(), "month", now), true);
    // Septembre : `at()` construit toujours des dates d'octobre (index 9),
    // donc ces deux dates sont construites explicitement.
    const sep = new Date(2026, 8, 15);
    assert.equal(matchesPeriod(new Date(2026, 8, 30, 23).toISOString(), "month", sep), true);
    assert.equal(matchesPeriod(new Date(2026, 9, 1, 1).toISOString(), "month", sep), false);
  });
});
