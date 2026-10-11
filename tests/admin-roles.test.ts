/**
 * Tests unitaires — rôles et chemins admin (logique pure, sans DB).
 *
 * Couvre `src/lib/admin-roles.ts` après migration passcode → Better Auth :
 *   - normalizeAdminRole : fail-closed (seuls operator/viewer passent)
 *   - isPublicAdminPath : liste partagée proxy Edge / layout Node
 *   - canRevokeAdmin / canChangeAdminRole : garde-fous dernier operator
 *
 * Run: npx tsx --test tests/admin-roles.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAdminRole,
  isPublicAdminPath,
  PUBLIC_ADMIN_PATHS,
  canRevokeAdmin,
  canChangeAdminRole,
} from "../src/lib/admin-roles";

describe("normalizeAdminRole (fail-closed)", () => {
  test("accepte operator et viewer (casse/espaces normalisés)", () => {
    assert.equal(normalizeAdminRole("operator"), "operator");
    assert.equal(normalizeAdminRole("viewer"), "viewer");
    assert.equal(normalizeAdminRole("  Operator  "), "operator");
    assert.equal(normalizeAdminRole("VIEWER"), "viewer");
  });

  test("rejette tout le reste — jamais de défaut vers operator", () => {
    assert.equal(normalizeAdminRole(null), null);
    assert.equal(normalizeAdminRole(undefined), null);
    assert.equal(normalizeAdminRole(""), null);
    assert.equal(normalizeAdminRole("   "), null);
    assert.equal(normalizeAdminRole("admin"), null);
    assert.equal(normalizeAdminRole("superadmin"), null);
    assert.equal(normalizeAdminRole("user"), null);
    assert.equal(normalizeAdminRole("member"), null);
    assert.equal(normalizeAdminRole(42), null);
    assert.equal(normalizeAdminRole({ role: "operator" }), null);
    assert.equal(normalizeAdminRole(["operator"]), null);
  });
});

describe("isPublicAdminPath (source unique proxy ↔ layout)", () => {
  test("les 3 pages publiques sont reconnues exactement", () => {
    assert.equal(isPublicAdminPath("/admin/login"), true);
    assert.equal(isPublicAdminPath("/admin/setup"), true);
    assert.equal(isPublicAdminPath("/admin/setup-2fa"), true);
  });

  test("aucune autre page admin n'est publique", () => {
    assert.equal(isPublicAdminPath("/admin"), false);
    assert.equal(isPublicAdminPath("/admin/"), false);
    assert.equal(isPublicAdminPath("/admin/dashboard"), false);
    assert.equal(isPublicAdminPath("/admin/login/reset"), false);
    assert.equal(isPublicAdminPath("/admin/loginx"), false);
    assert.equal(isPublicAdminPath("/login"), false);
    assert.equal(isPublicAdminPath("/dashboard"), false);
  });

  test("la liste exportée correspond aux 3 chemins", () => {
    assert.equal(PUBLIC_ADMIN_PATHS.length, 3);
  });
});

describe("canRevokeAdmin — garde-fous", () => {
  const base = {
    targetEmail: "awa@hashcode.fr",
    targetRole: "viewer" as const,
    actorEmail: "operator@hashcode.fr",
    operatorCount: 2,
  };

  test("révocation d'un viewer : autorisée", () => {
    assert.deepEqual(canRevokeAdmin(base), { ok: true });
  });

  test("révocation d'un operator (pas le dernier) : autorisée", () => {
    assert.deepEqual(canRevokeAdmin({ ...base, targetRole: "operator" }), { ok: true });
  });

  test("auto-révocation : refusée même viewer", () => {
    const r = canRevokeAdmin({ ...base, actorEmail: "AWA@hashcode.fr " });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.reason, "SELF_REVOKE");
  });

  test("dernier operator : refusé", () => {
    const r = canRevokeAdmin({
      ...base,
      targetRole: "operator",
      operatorCount: 1,
    });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.reason, "LAST_OPERATOR");
  });

  test("dernier operator qui se révoque lui-même : SELF_REVOKE d'abord", () => {
    const r = canRevokeAdmin({
      targetEmail: "op@hashcode.fr",
      targetRole: "operator",
      actorEmail: "op@hashcode.fr",
      operatorCount: 1,
    });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.reason, "SELF_REVOKE");
  });
});

describe("canChangeAdminRole — garde-fous", () => {
  const base = {
    targetEmail: "awa@hashcode.fr",
    from: "viewer" as const,
    to: "operator" as const,
    actorEmail: "operator@hashcode.fr",
    operatorCount: 2,
  };

  test("promotion viewer → operator : autorisée", () => {
    assert.deepEqual(canChangeAdminRole(base), { ok: true });
  });

  test("rétrogradation operator → viewer : autorisée s'il en reste un autre", () => {
    assert.deepEqual(
      canChangeAdminRole({ ...base, from: "operator", to: "viewer" }),
      { ok: true },
    );
  });

  test("rétrogradation du DERNIER operator : refusée", () => {
    const r = canChangeAdminRole({
      ...base,
      from: "operator",
      to: "viewer",
      operatorCount: 1,
    });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.reason, "LAST_OPERATOR");
  });

  test("changement viewer → viewer (aucun effet) : autorisé", () => {
    assert.deepEqual(
      canChangeAdminRole({ ...base, to: "viewer" }),
      { ok: true },
    );
  });
});
