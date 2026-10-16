/**
 * Exports admin (#221) — logique pure, sans DB.
 * Run: tsx --test tests/admin-export.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  EXPORT_DEFAULT_COLUMNS,
  buildExportWhere,
  parseExportFilters,
  resolveExportColumns,
} from "../src/lib/admin-export";

describe("resolveExportColumns : défaut minimisé + sensibles sous operator", () => {
  test("sans fields → défaut, sans internes", () => {
    const cols: string[] = resolveExportColumns(undefined, "viewer");
    assert.deepEqual(cols, [...EXPORT_DEFAULT_COLUMNS]);
    assert.ok(
      !cols.some((c: string) => c === "adminNote"),
      "pas d'adminNote par défaut",
    );
    assert.ok(
      !cols.some((c: string) => c === "adminRole"),
      "pas d'adminRole par défaut",
    );
  });

  test("viewer + fields sensibles → 403 FORBIDDEN_FIELDS", () => {
    for (const role of ["viewer", null, undefined]) {
      try {
        resolveExportColumns("firstName,adminNote", role ?? undefined);
        assert.fail(`aurait dû jeter (role=${role})`);
      } catch (e) {
        assert.equal((e as { code?: string }).code, "FORBIDDEN_FIELDS");
        assert.equal((e as { status?: number }).status, 403);
      }
    }
  });

  test("operator + fields sensibles → accordées", () => {
    const cols = resolveExportColumns("firstName,adminNote", "operator");
    assert.deepEqual(cols, ["firstName", "adminNote"]);
  });

  test("fields inconnues seules → 422 INVALID_FIELDS", () => {
    try {
      resolveExportColumns("nope", "operator");
      assert.fail("aurait dû jeter");
    } catch (e) {
      assert.equal((e as { code?: string }).code, "INVALID_FIELDS");
    }
  });
});

describe("parseExportFilters : whitelist stricte", () => {
  test("filtre invalide → 422 INVALID_FILTER", () => {
    try {
      parseExportFilters(new URLSearchParams({ domain: "inconnu" }));
      assert.fail("aurait dû jeter");
    } catch (e) {
      assert.equal((e as { code?: string }).code, "INVALID_FILTER");
    }
  });

  test("fields passe le filtre (résolution séparée)", () => {
    const f = parseExportFilters(new URLSearchParams({ fields: "firstName,email" }));
    assert.equal(f.fields, "firstName,email");
  });
});

describe("buildExportWhere : recherche élargie", () => {
  test("q couvre firstName, lastName, email, phone", async () => {
    const where = await buildExportWhere({ q: "awa" });
    const ors = (where.OR ?? []) as { firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown }[];
    const keys = ors.flatMap((o) => Object.keys(o)).sort();
    assert.deepEqual(keys, ["email", "firstName", "lastName", "phone"]);
  });

  test("supprimés toujours exclus", async () => {
    const where = await buildExportWhere({});
    assert.equal(where.deletedAt, null);
  });
});
