/**
 * Segments (#104) — whitelist et compilation, sans DB.
 * Run: tsx --test tests/segments.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  compileSegmentWhere,
  parseSegmentDefinition,
} from "../src/lib/segments";

const valid = {
  version: 1,
  all: [
    { field: "domain", op: "eq", value: "web" },
    { field: "country", op: "in", value: ["BJ", "FR"] },
    { field: "createdAfter", op: "gte", value: "2026-01-01T00:00:00.000Z" },
  ],
} as const;

describe("whitelist : acceptée / refusée", () => {
  test("définition valide parsée", () => {
    const r = parseSegmentDefinition(JSON.parse(JSON.stringify(valid)));
    assert.equal(r.success, true);
  });

  test("champs non autorisés refusés (email, téléphone, internes)", () => {
    for (const field of ["email", "phone", "firstName", "adminNote", "adminRole", "memberId"]) {
      const r = parseSegmentDefinition({
        version: 1,
        all: [{ field, op: "eq", value: "x" }],
      });
      assert.equal(r.success, false, `champ refusé : ${field}`);
    }
  });

  test("opérateurs hors whitelist refusés", () => {
    assert.equal(
      parseSegmentDefinition({
        version: 1,
        all: [{ field: "domain", op: "contains", value: "web" }],
      }).success,
      false,
    );
    assert.equal(
      parseSegmentDefinition({
        version: 1,
        all: [{ field: "createdAfter", op: "eq", value: "2026-01-01" }],
      }).success,
      false,
    );
  });

  test("valeurs invalides refusées (enum, in vide/pléthorique, version, all vide)", () => {
    const bad: unknown[] = [
      { version: 1, all: [{ field: "domain", op: "eq", value: "cobol" }] },
      { version: 1, all: [{ field: "country", op: "in", value: [] }] },
      { version: 1, all: [{ field: "country", op: "in", value: new Array(51).fill("BJ") }] },
      { version: 2, all: [{ field: "domain", op: "eq", value: "web" }] },
      { version: 1, all: [] },
      { version: 1, all: new Array(21).fill({ field: "domain", op: "eq", value: "web" }) },
    ];
    for (const d of bad) {
      assert.equal(parseSegmentDefinition(d).success, false, JSON.stringify(d).slice(0, 60));
    }
  });
});

describe("compilation : where Prisma déterministe", () => {
  test("AND + jamais supprimés + mapping colonnes", () => {
    const r = parseSegmentDefinition(JSON.parse(JSON.stringify(valid)));
    assert.equal(r.success, true);
    if (!r.success) return;
    const where = compileSegmentWhere(r.data) as { AND: unknown[] };
    assert.ok(Array.isArray(where.AND));
    const s = JSON.stringify(where);
    assert.ok(s.includes('"deletedAt":null'), "supprimés toujours exclus");
    assert.ok(s.includes('"primaryDomain":"web"'), "domain → primaryDomain");
    assert.ok(s.includes('"country":{"in":["BJ","FR"]}'), "in compilé");
    assert.ok(s.includes('"createdAt":{"gte"'), "createdAfter → createdAt.gte");
  });
});
