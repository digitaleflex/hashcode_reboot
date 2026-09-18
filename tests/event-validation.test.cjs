/**
 * Unit tests — event validation + notify targeting + source merge.
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/event-validation.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - validateEventCreate / validateEventPatch / notifyWhere / parseNotify /
 *    decideRsvp from src/lib/events-validation.ts
 *  - mergeBySource from src/app/api/stats/route.ts
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - create: happy path, title bounds, enums, url, capacity, endsAt>startsAt
 *  - patch: partial updates, cross-check with existing bounds, empty patch
 *  - notifyWhere: APPROVED filter + domain/level targeting
 *  - mergeBySource: NULL→"direct" collision, trim, desc sort
 *  - parseNotify: optional boolean, strict rejection of "no"/0/"true"/null
 *  - decideRsvp: invalid status, missing/completed/past event, capacity
 *    (new going rejected when full; already-going member never blocked)
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirror of src/lib/events-validation.ts ──

const EVENT_TYPES = ["session", "workshop", "meetup", "webinar", "other"];
const EVENT_DOMAINS = ["web", "cybersecurity", "ai"];
const EVENT_LEVELS = ["beginner", "practicing", "autonomous", "advanced"];
const EVENT_STATUSES = ["scheduled", "live", "completed", "cancelled"];
const EVENT_RECURRENCES = ["weekly", "biweekly", "monthly"];

function optStr(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function parseHttpUrl(v) {
  const s = optStr(v);
  if (s === null) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.toString();
  } catch {
    return false;
  }
}

function parseCapacity(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 9999) return false;
  return n;
}

function parseDate(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function validateEventCreate(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const description = optStr(body.description);
  if (description && description.length > 2000) {
    return { ok: false, error: "Description trop longue (max 2000 caractères)." };
  }
  if (body.startsAt === undefined || body.startsAt === null || body.startsAt === "") {
    return { ok: false, error: "Date de début requise." };
  }
  const startsAt = parseDate(body.startsAt);
  if (!startsAt) return { ok: false, error: "Date de début invalide." };
  let endsAt = null;
  if (body.endsAt !== undefined && body.endsAt !== null && body.endsAt !== "") {
    endsAt = parseDate(body.endsAt);
    if (!endsAt) return { ok: false, error: "Date de fin invalide." };
    if (endsAt <= startsAt) {
      return { ok: false, error: "La fin doit être après le début." };
    }
  }
  const type = String(body.type || "session");
  if (!EVENT_TYPES.includes(type)) return { ok: false, error: "Type invalide." };
  const domain = optStr(body.domain);
  if (domain && !EVENT_DOMAINS.includes(domain)) return { ok: false, error: "Domaine invalide." };
  const level = optStr(body.level);
  if (level && !EVENT_LEVELS.includes(level)) return { ok: false, error: "Niveau invalide." };
  const recurrence = optStr(body.recurrence);
  if (recurrence && !EVENT_RECURRENCES.includes(recurrence)) {
    return { ok: false, error: "Récurrence invalide." };
  }
  const url = parseHttpUrl(body.url);
  if (url === false) return { ok: false, error: "Lien externe invalide (http(s) requis)." };
  const maxAttendees = parseCapacity(body.maxAttendees);
  if (maxAttendees === false) {
    return { ok: false, error: "Capacité invalide (entier 1-9999)." };
  }
  return {
    ok: true,
    data: {
      title, description, startsAt, endsAt,
      location: optStr(body.location), url, type, domain, level,
      recurrence, recurrenceId: optStr(body.recurrenceId), maxAttendees,
    },
  };
}

function validateEventPatch(body, current) {
  const data = {};
  if (body.title !== undefined) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (t.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
    if (t.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
    data.title = t;
  }
  if (body.startsAt !== undefined) {
    const s = parseDate(body.startsAt);
    if (!s) return { ok: false, error: "Date de début invalide." };
    data.startsAt = s;
  }
  if (body.endsAt !== undefined) {
    if (body.endsAt === null || body.endsAt === "") {
      data.endsAt = null;
    } else {
      const e = parseDate(body.endsAt);
      if (!e) return { ok: false, error: "Date de fin invalide." };
      data.endsAt = e;
    }
  }
  const effStart = data.startsAt ?? current.startsAt;
  const effEnd = ("endsAt" in data ? data.endsAt : current.endsAt) ?? null;
  if (effEnd && effEnd <= effStart) {
    return { ok: false, error: "La fin doit être après le début." };
  }
  if (body.url !== undefined) {
    const u = parseHttpUrl(body.url);
    if (u === false) return { ok: false, error: "Lien externe invalide (http(s) requis)." };
    data.url = u;
  }
  if (body.type !== undefined) {
    if (!EVENT_TYPES.includes(String(body.type))) return { ok: false, error: "Type invalide." };
    data.type = String(body.type);
  }
  if (body.status !== undefined) {
    if (!EVENT_STATUSES.includes(String(body.status))) return { ok: false, error: "Statut invalide." };
    data.status = String(body.status);
  }
  if (body.maxAttendees !== undefined) {
    const n = parseCapacity(body.maxAttendees);
    if (n === false) return { ok: false, error: "Capacité invalide (entier 1-9999)." };
    data.maxAttendees = n;
  }
  return { ok: true, data };
}

function notifyWhere(event) {
  return {
    profileStatus: "APPROVED",
    deletedAt: null,
    ...(event.domain ? { primaryDomain: event.domain } : {}),
    ...(event.level ? { level: event.level } : {}),
  };
}

// ── Mirror of mergeBySource (src/app/api/stats/route.ts) ──

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
  });

  test("accepts a minimal payload (defaults/nulls)", () => {
    const r = validateEventCreate({ title: "Meetup", startsAt: "2026-10-01T14:00:00Z" });
    assert.equal(r.ok, true);
    assert.equal(r.data.type, "session");
    assert.equal(r.data.domain, null);
    assert.equal(r.data.endsAt, null);
    assert.equal(r.data.maxAttendees, null);
  });

  test("rejects short / long titles", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: "ab" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, title: "x".repeat(201) }).ok, false);
  });

  test("rejects unknown enums", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, type: "party" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, domain: "design" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, level: "expert" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, recurrence: "yearly" }).ok, false);
  });

  test("rejects non-http urls", () => {
    assert.equal(validateEventCreate({ ...VALID_CREATE, url: "ftp://x.test" }).ok, false);
    assert.equal(validateEventCreate({ ...VALID_CREATE, url: "not a url" }).ok, false);
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

  test("rejects endsAt before/equals startsAt", () => {
    assert.equal(
      validateEventCreate({ ...VALID_CREATE, endsAt: "2026-10-01T14:00:00.000Z" }).ok,
      false,
    );
    assert.equal(
      validateEventCreate({ ...VALID_CREATE, endsAt: "2026-09-01T14:00:00.000Z" }).ok,
      false,
    );
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

  test("rejects invalid status / type / url", () => {
    assert.equal(validateEventPatch({ status: "draft" }, current).ok, false);
    assert.equal(validateEventPatch({ type: "party" }, current).ok, false);
    assert.equal(validateEventPatch({ url: "javascript:alert(1)" }, current).ok, false);
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
});

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
});

// ── Mirror of decideRsvp from src/lib/events-validation.ts ──

const RSVP_STATUSES = ["going", "maybe", "cancelled"];

function decideRsvp(input) {
  if (!RSVP_STATUSES.includes(input.requestedStatus)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      error: "Status invalide. Use: going | maybe | cancelled.",
    };
  }
  if (!input.eventExists || input.eventStatus !== "scheduled") {
    return { ok: false, code: "NOT_FOUND", error: "Événement introuvable ou terminé." };
  }
  if (input.startsAt && input.startsAt.getTime() < input.now.getTime()) {
    return {
      ok: false,
      code: "PAST_EVENT",
      error: "Impossible de s'inscrire à un événement passé.",
    };
  }
  const isNewGoing =
    input.requestedStatus === "going" && input.currentStatus !== "going";
  if (
    input.maxAttendees !== null &&
    isNewGoing &&
    input.goingCount >= input.maxAttendees
  ) {
    return { ok: false, code: "FULL", error: "L'événement est complet." };
  }
  return { ok: true };
}

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
  });

  test("rejette un event passé (400)", () => {
    assert.equal(decideRsvp({ ...base, startsAt: past }).code, "PAST_EVENT");
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
});

// ── Mirror of parseNotify from src/lib/events-validation.ts ──

function parseNotify(value) {
  if (value === undefined) return { ok: true };
  if (typeof value === "boolean") return { ok: true, notify: value };
  return { ok: false, error: "notify doit être un booléen (true | false)." };
}

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
});
