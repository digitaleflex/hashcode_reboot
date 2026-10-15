/**
 * Dates FR admin (#220) — jamais ambiguës, jamais "Invalid Date".
 * Run: tsx --test tests/admin-dates.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { formatFullFr, formatShortFr } from "../src/components/reboot/admin/lib/dates";

describe("formatShortFr : liste non ambiguë", () => {
  test("jour + mois FR + année + heure + fuseau", () => {
    const out = formatShortFr("2026-10-15T12:30:00.000Z");
    assert.ok(out.includes("2026"), `année présente : ${out}`);
    assert.ok(/oct/i.test(out), `mois FR : ${out}`);
    assert.ok(/UTC|GMT/i.test(out), `fuseau explicite : ${out}`);
  });

  test("entrée invalide → tiret (jamais Invalid Date)", () => {
    for (const bad of ["", "pas-une-date", "2026-13-99"]) {
      assert.equal(formatShortFr(bad), "—");
      assert.equal(formatFullFr(bad), "—");
    }
  });
});

describe("formatFullFr : détail avec secondes", () => {
  test("secondes + fuseau présents", () => {
    const out = formatFullFr("2026-01-05T08:04:09.000Z");
    assert.ok(/2026/.test(out), `année : ${out}`);
    assert.ok(/\d{2}:\d{2}:\d{2}/.test(out), `hh:mm:ss : ${out}`);
    assert.ok(/UTC|GMT/i.test(out), `fuseau : ${out}`);
  });

  test("cohérence liste/détail (même instant)", () => {
    const iso = "2025-12-31T23:59:59.000Z";
    assert.ok(formatShortFr(iso).includes("2025"));
    assert.ok(formatFullFr(iso).includes("2025"));
  });
});
