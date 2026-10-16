/**
 * Pagination événements + curseurs (#236) — pur, sans DB.
 * Run: tsx --test tests/public-events.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  decodeEventCursor,
  encodeEventCursor,
  normalizeEventFilters,
} from "../src/lib/public-events";

describe("curseur opaque : round-trip strict", () => {
  test("encode → decode identique", () => {
    const d = new Date("2026-11-01T10:00:00.000Z");
    const c = encodeEventCursor(d, "evt123");
    const back = decodeEventCursor(c);
    assert.ok(back, "décodé");
    assert.equal(back!.startsAt.getTime(), d.getTime());
    assert.equal(back!.id, "evt123");
    assert.ok(!c.includes("evt123"), "opaque (pas d'id en clair)");
  });

  test("malformés → null (jamais d'exception)", () => {
    for (const bad of ["", "!!!", "bm9u", "x".repeat(300), null, undefined, 42]) {
      assert.equal(decodeEventCursor(bad), null, JSON.stringify(bad));
    }
  });
});

describe("normalizeEventFilters : bornes + curseur", () => {
  test("limit bornée [1,50], défaut 20", () => {
    assert.equal(normalizeEventFilters({ limit: 0 }).limit, 1);
    assert.equal(normalizeEventFilters({ limit: 999 }).limit, 50);
    assert.equal(normalizeEventFilters({}).limit, 20);
  });

  test("curseur invalide → AppError 422 INVALID_CURSOR", () => {
    try {
      normalizeEventFilters({ cursor: "nope" });
      assert.fail("aurait dû jeter");
    } catch (e) {
      assert.equal((e as { code?: string }).code, "INVALID_CURSOR");
      assert.equal((e as { status?: number }).status, 422);
    }
  });

  test("sans curseur : pas de clé cursor", () => {
    assert.ok(!("cursor" in normalizeEventFilters({})));
  });
});
