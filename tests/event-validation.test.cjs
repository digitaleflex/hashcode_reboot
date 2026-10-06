/**
 * Unit tests — event validation + notify targeting + RSVP.
 * No server required, runs in < 1 second.
 *
 * Run:  node --import tsx --test tests/event-validation.test.cjs
 *
 * Ce test importe le VRAI module `src/lib/events-validation.ts` — pas de
 * miroir. `tsx` est chargé par le runner (`npm run test:unit`), donc un
 * `.test.cjs` peut.require()r du TypeScript : `node --test` seul ne le peut pas,
 * d'où l'argument « .cjs can't import TS » (qui n'était donc pas une contrainte).
 *
 * `EVENT_STATUSES` / `EVENT_RECURRENCES` ne sont PAS exportés (usage interne) :
 * les statuts attendus sont donc listés explicitement ci-dessous, ce qui a
 * l'avantage de figer le contrat public.
 *
 * Seule exception : `mergeBySource` (fin de fichier). Elle vit dans une route
 * Next.js (`src/app/api/stats/route.ts`) qui ne l'exporte pas — l'importer
 * depuis une route n'est pas possible sans démarrer le runtime Next. Le miroir
 * est donc conservé, mais un test de dérive vérifie que les DEUX copies
 * vivantes dans `src/` (stats + admin/dashboard) sont restées identiques.
 *
 * Coverage:
 *  - create: happy path, title bounds, enums, url, capacity, endsAt>startsAt
 *  - patch: partial updates, cross-check with existing bounds, empty patch,
 *    champs optionnels (description/location/domain/level/recurrence)
 *  - notifyWhere: APPROVED filter + domain/level targeting
 *  - mergeBySource: NULL→"direct" collision, trim, desc sort + dérive src/
 *  - parseNotify: optional boolean, strict rejection of "no"/0/"true"/null
 *  - decideRsvp: invalid status, missing/completed/past event, capacity
 *    (new going rejected when full; already-going member never blocked)
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const { validateEventCreate, validateEventPatch, notifyWhere, decideRsvp, parseNotify } =
  require("../src/lib/events-validation.ts");

// ══════════════════════════════════════════════════════════════

const VALID_CREATE = {
  title: "Session pratique Web",
  startsAt: "2026-10-01T14:00:00.000Z",
  endsAt: "2026-10-01T16:00:00.000Z",
  type: "session",
  domain: "web",
  level: "beginner",
  maxAttendees: 50,
  url: "https://meet.example.com/x",
};

describe("validateEventCreate", () => {
  test("accepts a valid payload", () => {
    const r = validateEventCreate(VALID_CREATE);
    assert.equal(r.ok, true);
    assert.equal(r.data.title, "Session pratique Web");
    assert.equal(r.data.maxAttendees, 50);
    assert.equal(r.data.url, "https://meet.example.com/x");
    assert.deepEqual(r.data.startsAt, new Date("2026-10-01T14:00:00.000Z"));
    assert.deepEqual(r.data.endsAt, new Date("2026-10-01T16:00:00.000Z"));
  });

  test("accepts a minimal payload (defaults/nulls)", () => {
    const r = validateEventCreate({ title: "Meetup", startsAt: "2026-10-01T14:00:00Z" });
    assert.equal(r.ok, true);
    assert.equal(r.data.type, "session");
    assert.equal(r.data.domain, null);
    assert.equal(r.data.endsAt, null);
    assert.equal(r.data.maxAttendees, null);
    assert.equal(r.data.recurrence, null);
    assert.equal(r.data.recurrenceId, null);
    assert.equal(r.data.location, null);
  });

  test("normalise les chaînes (trim) et vide → null", () => {
    const r = validateEventCreate({ ...VALID_CREATE, location: "  Cotonou  ", description: "  " });
    assert.equal(r.ok, true);
    assert.equal(r.data.location, "Cotonou");
    assert.equal(r.data.description, null);
  });

  test("rejects short / long titles", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: "ab" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: "x".repeat(201) }).ok, false);
    // 3 et 200 sont acceptés (bornes incluses).
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: "abc" }).ok, true);
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: "x".repeat(200) }).ok, true);
  });

  test("rejects a missing title / a non-string title", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: undefined }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: 42 }).ok, false);
  });

  test("rejects a description over 2000 characters", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, description: "x".repeat(2001) }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, description: "x".repeat(2000) }).ok, true);
  });

  test("rejects a missing / invalid startsAt", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, startsAt: undefined }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, startsAt: "" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, startsAt: "pas une date" }).ok, false);
  });

  test("rejects unknown enums", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, type: "party" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, domain: "design" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, level: "expert" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, recurrence: "yearly" }).ok, false);
  });

  test("accepts every declared enum value", () => {
    for (const type of ["session", "workshop", "meetup", "webinar", "other"]) {
      assert.equal(validateEventCreate({ ...VALID_CREATE, type }).ok, true, type);
    }
    for (const domain of ["web", "cybersecurity", "ai"]) {
      assert.equal(validateEventCreate({ ...VALID_CREATE, domain }).ok, true, domain);
    }
    for (const level of ["beginner", "practicing", "autonomous", "advanced"]) {
      assert.equal(validateEventCreate({ ...VALID_CREATE, level }).ok, true, level);
    }
    for (const recurrence of ["weekly", "biweekly", "monthly"]) {
      assert.equal(validateEventCreate({ ...VALID_CREATE, recurrence }).ok, true, recurrence);
    }
  });

  test("rejects non-http urls", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, url: "ftp://x.test" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, url: "not a url" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, url: "javascript:alert(1)" }).ok, false);
  });

  test("rejects bad capacities", () => {
    for (const bad of [0, -5, 10000, 5.5, "abc", NaN]) {
      assert.equal(
        validateEventCreate({ ...VALID_CREATE, maxAttendees: bad }).ok,
        false,
        `should reject ${String(bad)}`,
      );
    }
  });

  test("accepts the capacity bounds 1 and 9999", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, maxAttendees: 1 }).data.maxAttendees, 1);
    assert.equal(validateEventCreate({ ...VALID_CREATE, maxAttendees: 9999 }).data.maxAttendees, 9999);
  });

  test("rejects endsAt before/equals startsAt", () => {
    assert.equal(
      validateEventCreate({ ...VALID_CREATE, endsAt: "2026-10-01T14:00:00.000Z" }).ok,
      false,
    );
    assert.equal(
      validateEventCreate({ ...VALID_CREATE, endsAt: "2026-09-01T14:00:00.000Z" }).ok,
      false,
    );
    assert.equal(validateEventCreate({ ...VALID_CREATE, endsAt: "n'importe quoi" }).ok, false);
  });
});

describe("validateEventPatch", () => {
  const current = {
    startsAt: new Date("2026-10-01T14:00:00.000Z"),
    endsAt: new Date("2026-10-01T16:00:00.000Z"),
  };

  test("accepts empty patch (notify-only callers)", () => {
    const r = validateEventPatch({}, current);
    assert.equal(r.ok, true);
    assert.deepEqual(r.data, {});
  });

  test("accepts a status-only patch", () => {
    const r = validateEventPatch({ status: "live" }, current);
    assert.equal(r.ok, true);
    assert.equal(r.data.status, "live");
  });

  test("accepts exactly the four EVENT_STATUSES", () => {
    for (const status of ["scheduled", "live", "completed", "cancelled"]) {
      const r = validateEventPatch({ status }, current);
      assert.equal(r.ok, true, status);
      assert.equal(r.data.status, status);
    }
  });

  test("rejects invalid status / type / url", () => {
    assert.equal(validateEventPatch({ status: "draft" }, current).ok, false);
    assert.equal(validateEventPatch({ type: "party" }, current).ok, false);
    assert.equal(validateEventPatch({ url: "javascript:alert(1)" }, current).ok, false);
  });

  test("validates the optional fields the PATCH route accepts", () => {
    assert.equal(validateEventPatch({ description: "x".repeat(2001) }, current).ok, false);
    assert.equal(validateEventPatch({ domain: "design" }, current).ok, false);
    assert.equal(validateEventPatch({ level: "expert" }, current).ok, false);
    assert.equal(validateEventPatch({ recurrence: "yearly" }, current).ok, false);
    assert.equal(validateEventPatch({ maxAttendees: 0 }, current).ok, false);
    assert.equal(validateEventPatch({ startsAt: "n'importe quoi" }, current).ok, false);
    assert.equal(validateEventPatch({ endsAt: "n'importe quoi" }, current).ok, false);
  });

  test("normalises the optional fields (trim, vide → null)", () => {
    const r = validateEventPatch(
      { location: "  Cotonou ", domain: " ai ", level: "", recurrenceId: "  ", title: "  Nouveau titre  " },
      current,
    );
    assert.equal(r.ok, true);
    assert.equal(r.data.title, "Nouveau titre");
    assert.equal(r.data.location, "Cotonou");
    assert.equal(r.data.domain, "ai");
    assert.equal(r.data.level, null);
    assert.equal(r.data.recurrenceId, null);
  });

  test("rejects short / long titles", () => {
    assert.equal(validateEventPatch({ title: "ab" }, current).ok, false);
    assert.equal(validateEventPatch({ title: "x".repeat(201) }, current).ok, false);
  });

  test("cross-checks new endsAt against existing startsAt", () => {
    assert.equal(
      validateEventPatch({ endsAt: "2026-10-01T13:00:00.000Z" }, current).ok,
      false,
    );
  });

  test("cross-checks new startsAt against existing endsAt", () => {
    assert.equal(
      validateEventPatch({ startsAt: "2026-10-01T17:00:00.000Z" }, current).ok,
      false,
    );
  });

  test("clearing endsAt (null) is valid", () => {
    const r = validateEventPatch({ endsAt: null }, current);
    assert.equal(r.ok, true);
    assert.equal(r.data.endsAt, null);
  });

  test("effacer endsAt retire la contrainte croisée sur startsAt", () => {
    // endsAt absent de `data` → la borne effacée (null) est utilisée : plus rien
    // à contrer, même en déplaçant startsAt au-delà de l'ancienne fin.
    const r = validateEventPatch({ endsAt: null, startsAt: "2026-10-01T18:00:00.000Z" }, current);
    assert.equal(r.ok, true);
    assert.deepEqual(r.data, {
      startsAt: new Date("2026-10-01T18:00:00.000Z"),
      endsAt: null,
    });
  });

  test("décaler startsAt AVANT endsAt raccourcit l'event et reste accepté", () => {
    // La règle est `endsAt > startsAt` : avancer la fin de l'event (14h → 15h)
    // est un raccourcissement légitime, pas une incohérence. Seul un startsAt
    // postérieur à endsAt est refusé (cf. test précédent).
    const r = validateEventPatch({ startsAt: "2026-10-01T15:00:00.000Z" }, current);
    assert.equal(r.ok, true);
    assert.deepEqual(r.data, { startsAt: new Date("2026-10-01T15:00:00.000Z") });
    // startsAt == endsAt : frontière refusée.
    const eq = validateEventPatch({ startsAt: "2026-10-01T16:00:00.000Z" }, current);
    assert.equal(eq.ok, false);
    assert.equal(eq.error, "La fin doit être après le début.");
  });
});

describe("notifyWhere", () => {
  test("targets APPROVED only when no targeting", () => {
    assert.deepEqual(notifyWhere({ domain: null, level: null }), {
      profileStatus: "APPROVED",
      deletedAt: null,
    });
  });

  test("adds domain/level filters when set", () => {
    assert.deepEqual(notifyWhere({ domain: "ai", level: "advanced" }), {
      profileStatus: "APPROVED",
      deletedAt: null,
      primaryDomain: "ai",
      level: "advanced",
    });
  });

  test("domain alone filters primaryDomain only", () => {
    assert.deepEqual(notifyWhere({ domain: "web", level: null }), {
      profileStatus: "APPROVED",
      deletedAt: null,
      primaryDomain: "web",
    });
  });
});

describe("decideRsvp (décision RSVP)", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");
  const future = new Date("2026-12-01T18:00:00.000Z");
  const past = new Date("2026-01-01T18:00:00.000Z");
  const base = {
    eventExists: true,
    eventStatus: "scheduled",
    startsAt: future,
    maxAttendees: null,
    goingCount: 0,
    currentStatus: null,
    requestedStatus: "going",
    now,
  };

  test("accepte un going sur un event scheduled futur", () => {
    assert.equal(decideRsvp(base).ok, true);
  });

  test("rejette un statut invalide (contrat 422 conservé)", () => {
    const d = decideRsvp({ ...base, requestedStatus: "yes" });
    assert.deepEqual(d, {
      ok: false,
      code: "INVALID_STATUS",
      error: "Status invalide. Use: going | maybe | cancelled.",
    });
  });

  test("rejette un event manquant (404)", () => {
    assert.equal(decideRsvp({ ...base, eventExists: false }).code, "NOT_FOUND");
  });

  test("rejette un event terminé ou annulé (404)", () => {
    assert.equal(decideRsvp({ ...base, eventStatus: "completed" }).code, "NOT_FOUND");
    assert.equal(decideRsvp({ ...base, eventStatus: "cancelled" }).code, "NOT_FOUND");
    assert.equal(decideRsvp({ ...base, eventStatus: "live" }).code, "NOT_FOUND");
  });

  test("rejette un event passé (400)", () => {
    assert.equal(decideRsvp({ ...base, startsAt: past }).code, "PAST_EVENT");
  });

  test("un event sans date de début n'est jamais « passé »", () => {
    assert.equal(decideRsvp({ ...base, startsAt: null }).ok, true);
  });

  test("rejette une NOUVELLE inscription going sur un event complet (409)", () => {
    const d = decideRsvp({ ...base, maxAttendees: 30, goingCount: 30 });
    assert.equal(d.code, "FULL");
  });

  test("accepte la dernière place (goingCount < maxAttendees)", () => {
    assert.equal(decideRsvp({ ...base, maxAttendees: 30, goingCount: 29 }).ok, true);
  });

  test("un membre déjà going peut reconfirmer quand complet (aucune place consommée)", () => {
    const d = decideRsvp({
      ...base,
      maxAttendees: 30,
      goingCount: 30,
      currentStatus: "going",
      requestedStatus: "going",
    });
    assert.equal(d.ok, true);
  });

  test("un membre déjà going peut passer en maybe quand complet", () => {
    const d = decideRsvp({
      ...base,
      maxAttendees: 30,
      goingCount: 30,
      currentStatus: "going",
      requestedStatus: "maybe",
    });
    assert.equal(d.ok, true);
  });

  test("la capacité ne bloque jamais maybe ni cancelled", () => {
    assert.equal(
      decideRsvp({ ...base, maxAttendees: 30, goingCount: 30, requestedStatus: "maybe" }).ok,
      true,
    );
    assert.equal(
      decideRsvp({ ...base, maxAttendees: 30, goingCount: 30, requestedStatus: "cancelled" }).ok,
      true,
    );
  });

  test("l'ordre des contrôles est statut → introuvable → passé → complet", () => {
    // Statut invalide ET event inexistant : c'est le statut qui gagne (422).
    const d = decideRsvp({
      ...base,
      eventExists: false,
      startsAt: past,
      maxAttendees: 1,
      goingCount: 1,
      requestedStatus: "yes",
    });
    assert.equal(d.code, "INVALID_STATUS");
  });
});

describe("parseNotify (option notify booléen strict)", () => {
  test("undefined → ok, comportement par défaut (notification envoyée)", () => {
    const r = parseNotify(undefined);
    assert.deepEqual(r, { ok: true });
    // Le route POST applique ensuite `notify !== false` → true par défaut.
  });

  test("true et false sont acceptés", () => {
    assert.deepEqual(parseNotify(true), { ok: true, notify: true });
    assert.deepEqual(parseNotify(false), { ok: true, notify: false });
  });

  test("une chaîne 'no' est rejetée (aurait déclenché un envoi de masse)", () => {
    assert.deepEqual(parseNotify("no"), {
      ok: false,
      error: "notify doit être un booléen (true | false).",
    });
  });

  test("0, 'true' (string) et null sont rejetés", () => {
    const expected = { ok: false, error: "notify doit être un booléen (true | false)." };
    assert.deepEqual(parseNotify(0), expected);
    assert.deepEqual(parseNotify("true"), expected);
    assert.deepEqual(parseNotify(null), expected);
  });

  test("« false » (string) est rejeté — piège classique d'un formulaire HTML", () => {
    assert.deepEqual(parseNotify("false"), {
      ok: false,
      error: "notify doit être un booléen (true | false).",
    });
  });
});

// ── Miroir INÉVITABLE : mergeBySource (non exportée par une route Next) ──
//
// `mergeBySource` existe en double dans `src/app/api/stats/route.ts` et
// `src/app/api/admin/dashboard/route.ts`, en `function` NON exportée. Il est donc
// impossible de l'importer (une route Next s'importe avec son runtime). Le
// comportement est exercé sur le miroir ci-dessous ; le test suivant vérifie que
// les deux copies de `src/` n'ont pas divergé, et le miroir devra être remis à
// jour à la main le jour où la source change.

function mergeBySource(entries) {
  const merged = new Map();
  for (const { source, count } of entries) {
    const key = (source ?? "").trim() || "direct";
    merged.set(key, (merged.get(key) ?? 0) + count);
  }
  return [...merged.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

describe("mergeBySource", () => {
  test("merges NULL and 'direct' into one row", () => {
    const out = mergeBySource([
      { source: "direct", count: 3 },
      { source: null, count: 2 },
      { source: "whatsapp", count: 5 },
    ]);
    assert.deepEqual(out, [
      { source: "direct", count: 5 },
      { source: "whatsapp", count: 5 },
    ]);
  });

  test("trims and sorts desc", () => {
    const out = mergeBySource([
      { source: "  whatsapp ", count: 1 },
      { source: "whatsapp", count: 2 },
      { source: "", count: 4 },
    ]);
    assert.deepEqual(out, [
      { source: "direct", count: 4 },
      { source: "whatsapp", count: 3 },
    ]);
  });

  test("dérive : toutes les copies de mergeBySource dans src/ sont identiques", () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
    // On compare le NOYAU de la fonction, pas sa signature : les annotations de
    // type TypeScript ne sont pas compilables telles quelles et n'ont aucun
    // bearing sur le comportement. Repères stables : la Map et l'appel à sort.
    const START = "const merged = new Map";
    const END = ".sort((a, b) => b.count - a.count);";
    const core = (src) => {
      const i = src.indexOf(START);
      const j = src.indexOf(END, i);
      assert.notEqual(i, -1, `« ${START} » introuvable : mergeBySource a changé, miroir à mettre à jour`);
      assert.notEqual(j, -1, `« ${END} » introuvable : mergeBySource a changé, miroir à mettre à jour`);
      return src
        .slice(i, j + END.length)
        .replace(/\s+/g, "")
        // `new Map<string, number>()` vs `new Map()` : on retire les arguments
        // de type, qui sont effacés à la compilation et n'ont aucun effet.
        .replace(/<[^<>]*>\(/g, "(");
    };
    // D29 : il n'y a plus qu'UN SEUL `mergeBySource`, dans
    // `src/lib/admin/aggregates.ts`. La copie de `/api/stats` a été déportée.
    //
    // Ce test garde son rôle de garde-fou : il vérifie qu'aucun fichier ne
    // REDÉCLARE la formule. Une réimplémentation échouerait ici au lieu de
    // diverger en silence.
    const CANONICAL = "src/lib/admin/aggregates.ts";
    // `rg` renvoie des chemins au séparateur de la plateforme : sous Windows
    // `src\lib\admin\aggregates.ts`, ce qui ne serait jamais égal à CANONICAL
    // et ferait crier ce test alors que la déport est faite.
    const norm = (p) => p.trim().replace(/\\/g, "/");
    const redeclarations = execFileSync(
      "rg",
      ["-l", "function mergeBySource", "src"],
      { encoding: "utf8" },
    )
      .split("\n")
      .map(norm)
      .filter(Boolean)
      .filter((f) => f !== CANONICAL);

    assert.deepEqual(
      redeclarations,
      [],
      `mergeBySource est redeclare dans ${redeclarations.join(", ")} : ` +
        `importer la version canonique de @/lib/admin/aggregates`,
    );
    assert.ok(
      core(read(CANONICAL)).length > 0,
      "le corps canonique de mergeBySource est vide",
    );

    assert.equal(
      core(mergeBySource.toString()),
      core(read(CANONICAL)),
      "le miroir de mergeBySource n'est plus aligné sur src/ (les tests ci-dessus ne testent plus la production)",
    );
  });
});
