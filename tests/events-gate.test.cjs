/**
 * Unit tests — gate Event #79 : fuseaux horaires + filtres publics.
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/events-gate.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - REFERENCE_TIME_ZONE / REFERENCE_LABEL / zoneForCountry /
 *    isValidTimeZone / safeTimeZone / formatEventDate / formatClock /
 *    formatEventMoment / localTimeNote from src/lib/events-timezone.ts
 *    (table COUNTRY_TIME_ZONE copiée à l'identique ; Intl fait le reste)
 *  - normalizeEventFilters from src/lib/public-events.ts
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - zoneForCountry : Bénin→référence, casse/espaces, TG=Togo (Lomé),
 *    TD=Tchad (Ndjamena) — non-régression du bug pays TG/TD —, inconnu→repli
 *  - safeTimeZone / isValidTimeZone : invalide→référence, jamais d'exception
 *  - formatEventMoment : 19:00Z → 20:00 à Porto-Novo (le bug email d'origine),
 *    cohérence date + " à " + heure
 *  - localTimeNote : null quand même horloge que la référence (BJ, CM),
 *    note mentionnant UTC+1 quand décalage réel (US)
 *  - normalizeEventFilters : défauts, bornes 1..50, enums invalides écartées
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/events-timezone.ts ──

const REFERENCE_TIME_ZONE = "Africa/Porto-Novo";
const REFERENCE_LABEL = "UTC+1";

const COUNTRY_TIME_ZONE = {
  BF: "Africa/Ouagadougou", CI: "Africa/Abidjan", GH: "Africa/Accra",
  GM: "Africa/Banjul", GN: "Africa/Conakry", GW: "Africa/Bissau",
  LR: "Africa/Monrovia", ML: "Africa/Bamako", MR: "Africa/Nouakchott",
  SH: "Atlantic/St_Helena", SL: "Africa/Freetown", SN: "Africa/Dakar",
  ST: "Africa/Sao_Tome", TG: "Africa/Lome",
  AO: "Africa/Luanda", BJ: "Africa/Porto-Novo", CD: "Africa/Kinshasa",
  CF: "Africa/Bangui", CG: "Africa/Brazzaville", CM: "Africa/Douala",
  DZ: "Africa/Algiers", GA: "Africa/Libreville", GQ: "Africa/Malabo",
  MA: "Africa/Casablanca", NE: "Africa/Niamey", NG: "Africa/Lagos",
  TD: "Africa/Ndjamena", TN: "Africa/Tunis",
  FR: "Europe/Paris", DE: "Europe/Berlin", US: "America/New_York",
  CA: "America/Toronto", GB: undefined, // absent volontairement : repli
};

function zoneForCountry(country) {
  const code = country?.trim().toUpperCase();
  if (!code) return REFERENCE_TIME_ZONE;
  return COUNTRY_TIME_ZONE[code] || REFERENCE_TIME_ZONE;
}

function isValidTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function safeTimeZone(zone) {
  if (!zone) return REFERENCE_TIME_ZONE;
  return isValidTimeZone(zone) ? zone : REFERENCE_TIME_ZONE;
}

function formatEventDate(date, zone) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", timeZone: safeTimeZone(zone),
  }).format(date);
}

function formatClock(date, zone) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: safeTimeZone(zone),
  }).format(date);
}

function formatEventMoment(date, zone) {
  const z = safeTimeZone(zone);
  return `${formatEventDate(date, z)} à ${formatClock(date, z)}`;
}

function localTimeNote(date, zone) {
  const z = safeTimeZone(zone);
  if (formatClock(date, z) === formatClock(date, REFERENCE_TIME_ZONE)) return null;
  return (
    `Heure affichée dans ton fuseau local. ` +
    `Le groupe annonce les horaires en ${REFERENCE_LABEL}.`
  );
}

// ── Mirror of normalizeEventFilters (src/lib/public-events.ts) ──

const EVENT_TYPES = ["session", "workshop", "meetup", "webinar", "other"];
const DOMAINS = ["web", "cybersecurity", "ai"];
const PUBLIC_EVENTS_MAX = 50;

function normalizeEventFilters(args) {
  const rawLimit = Number(args.limit ?? 20);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), PUBLIC_EVENTS_MAX)
    : 20;
  return {
    type: args.type && EVENT_TYPES.includes(args.type) ? args.type : undefined,
    domain: args.domain && DOMAINS.includes(args.domain) ? args.domain : undefined,
    limit,
  };
}

// ── Tests ──

describe("zoneForCountry", () => {
  test("Bénin → zone de référence", () => {
    assert.equal(zoneForCountry("BJ"), "Africa/Porto-Novo");
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

  test("vide/inconnu → repli référence sans exception", () => {
    assert.equal(zoneForCountry(null), REFERENCE_TIME_ZONE);
    assert.equal(zoneForCountry(undefined), REFERENCE_TIME_ZONE);
    assert.equal(zoneForCountry(""), REFERENCE_TIME_ZONE);
    assert.equal(zoneForCountry("XX"), REFERENCE_TIME_ZONE);
    assert.equal(zoneForCountry("GB"), REFERENCE_TIME_ZONE);
  });
});

describe("safeTimeZone / isValidTimeZone", () => {
  test("zone valide conservée, invalide → référence", () => {
    assert.ok(isValidTimeZone("Africa/Porto-Novo"));
    assert.ok(!isValidTimeZone("Mars/Olympus"));
    assert.equal(safeTimeZone("Europe/Paris"), "Europe/Paris");
    assert.equal(safeTimeZone("Mars/Olympus"), REFERENCE_TIME_ZONE);
    assert.equal(safeTimeZone(null), REFERENCE_TIME_ZONE);
  });

  test("toutes les zones mappées du mirror sont valides pour Intl", () => {
    for (const [code, zone] of Object.entries(COUNTRY_TIME_ZONE)) {
      if (!zone) continue;
      assert.ok(isValidTimeZone(zone), `${code} → ${zone} invalide`);
    }
  });
});

describe("formatEventMoment (bug email d'origine)", () => {
  // Samedi 19 septembre 2026, 19:00 UTC = 20:00 à Porto-Novo (UTC+1).
  const d = new Date("2026-09-19T19:00:00.000Z");

  test("19:00Z rend 20:00 dans la zone du destinataire, pas celle du serveur", () => {
    const out = formatEventMoment(d, "Africa/Porto-Novo");
    // Logique métier : conversion de fuseau horaire (UTC → UTC+1)
    assert.ok(out.includes("20:00"), out);
    // Vérification indépendante de la locale : le jour du mois est 19
    // (19:00Z + 1h = 20:00 le même jour à Porto-Novo)
    assert.ok(out.includes("19"), out);
    // La date ne doit pas être le jour précédent (18) ni le suivant (20)
    assert.ok(!out.includes("18"), out);
    assert.ok(!out.includes(" 20 "), out);
  });

  test("cohérence : moment = date + ' à ' + heure", () => {
    const z = "Africa/Douala";
    assert.equal(formatEventMoment(d, z), `${formatEventDate(d, z)} à ${formatClock(d, z)}`);
  });

  test("zone invalide → repli référence, jamais d'exception", () => {
    assert.equal(formatEventMoment(d, "Mars/Olympus"), formatEventMoment(d, REFERENCE_TIME_ZONE));
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
    assert.ok(typeof note === "string" && note.includes("UTC+1"), note);
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

// ── Mirror of matchesPeriod (src/lib/event-period.ts) ──

function matchesPeriod(startsAt, period, now = new Date()) {
  if (period === "all") return true;
  const start = new Date(startsAt);

  if (period === "week") {
    const offsetToMonday = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() - offsetToMonday,
      0, 0, 0, 0,
    );
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return start >= startOfWeek && start <= endOfWeek;
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return start >= startOfMonth && start <= endOfMonth;
}

describe("matchesPeriod", () => {
  // Lundi 5 octobre 2026, 10:00 (heure locale). 4 oct 2026 = dimanche,
  // 5 = lundi, 11 = dimanche, 12 = lundi.
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
