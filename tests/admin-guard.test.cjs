/**
 * Unit tests — D24 : le garde admin distingue 401 (« qui es-tu ? ») de
 * 403 (« as-tu le droit ? »).
 *
 * Run:  node --import tsx --test tests/admin-guard.test.cjs
 *
 * Ce que ce fichier verrouille, et pourquoi c'est une non-régression :
 *
 * AVANT (`requireAdminRole` renvoyait un booléen), une route operator répondait
 * la MÊME chose dans deux situations opposées :
 *   - aucun cookie admin               → 403 « Accès refusé »
 *   - cookie admin valide, rôle viewer → 403 « Accès refusé »
 * Le client ne pouvait donc pas distinguer « session expirée » de « droits
 * insuffisants » : il redirigeait vers la page de connexion alors que la
 * session était valide, et réessayait indéfiniment sur 401.
 *
 * APRÈS (`requireAdmin` renvoie un verdict discriminant) :
 *   - aucun cookie admin                 → 401 `AUTH_REQUIRED`
 *   - admin authentifié, rôle insuffisant → 403 `FORBIDDEN`
 *
 * On teste les DEUX niveaux :
 *   1. `requireAdmin` / `adminGuardResponse` / `requireAdminOrThrow` (src/lib)
 *   2. une VRAIE route (`GET /api/admin/audit-log`) de bout en bout : c'est le
 *      point d'entrée qui renvoyait 403 aux anonymes.
 *
 * Frontière stubée (et elle seule) : `auth.api.getSession`, comme dans
 * `tests/blacklist.test.cjs`. Les listes `ADMIN_OPERATORS` / `ADMIN_VIEWERS`
 * sont de vraies variables d'environnement lues au moment de l'appel : aucune
 * décision de rôle n'est réimplémentée ici, c'est bien
 * `src/lib/admin-auth.ts` qui décide.
 */

"use strict";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "admin-guard-test-secret-at-least-32-chars-long";
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

const OPERATOR_EMAIL = "guard-operator@test.invalid";
const VIEWER_EMAIL = "guard-viewer@test.invalid";

/** Faux NextRequest : le garde ne lit que `headers`, la route lit `url`. */
function fakeReq(url = "http://localhost:3000/api/admin/audit-log") {
  return { url, headers: new Headers(), method: "GET" };
}

let adminAuth;
let auditLogRoute;
let auth;
/** `auth.api.getSession` d'origine, restauré en `after()`. */
let realGetSession;
/** Email de la session simulée ; `null` = pas de session du tout. */
let fakeEmail;

/** `auth.api.getSession` d'origine, restauré en `after()`. */
let savedEnv = {};

before(async () => {
  ({ auth } = await import("../src/lib/auth/index.ts"));
  realGetSession = auth.api.getSession;

  // Variables d'environnement AVANT tout import de `admin-auth` : les listes
  // sont lues à chaque appel, mais on veut un environnement net.
  savedEnv = {
    ADMIN_OPERATORS: process.env.ADMIN_OPERATORS,
    ADMIN_VIEWERS: process.env.ADMIN_VIEWERS,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  };
  process.env.ADMIN_OPERATORS = OPERATOR_EMAIL;
  process.env.ADMIN_VIEWERS = VIEWER_EMAIL;
  // `ADMIN_EMAILS` (legacy) accorde operator à quiconque : on le neutralise
  // pour que seules les deux listes ci-dessus pilotent le rôle.
  process.env.ADMIN_EMAILS = "";

  adminAuth = await import("../src/lib/admin-auth.ts");
  auditLogRoute = await import("../src/app/api/admin/audit-log/route.ts");

  // Doublure de la SEULE frontière : la résolution de session Better Auth.
  auth.api.getSession = async () =>
    fakeEmail ? { user: { email: fakeEmail } } : null;
});

after(() => {
  auth.api.getSession = realGetSession;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  fakeEmail = null;
});

// ── 1. Le garde, au niveau src/lib ────────────────────────────────────

describe("D24 — requireAdmin : 401 « non authentifié » vs 403 « rôle insuffisant »", () => {
  test("aucune session admin → unauthenticated", async () => {
    const guard = await adminAuth.requireAdmin(fakeReq(), "operator");
    assert.deepEqual(guard, { ok: false, reason: "unauthenticated" });
  });

  test("session admin viewer sur une route operator → insufficient_role", async () => {
    fakeEmail = VIEWER_EMAIL;
    const guard = await adminAuth.requireAdmin(fakeReq(), "operator");
    assert.deepEqual(guard, { ok: false, reason: "insufficient_role" });
  });

  test("viewer passe sur une route viewer", async () => {
    fakeEmail = VIEWER_EMAIL;
    const guard = await adminAuth.requireAdmin(fakeReq(), "viewer");
    assert.equal(guard.ok, true);
    assert.equal(guard.role, "viewer");
    assert.equal(guard.email, VIEWER_EMAIL);
  });

  test("operator passe partout", async () => {
    fakeEmail = OPERATOR_EMAIL;
    for (const role of ["viewer", "operator"]) {
      const guard = await adminAuth.requireAdmin(fakeReq(), role);
      assert.equal(guard.ok, true, `operator refusé sur une route ${role}`);
      assert.equal(guard.role, "operator");
      assert.equal(guard.email, OPERATOR_EMAIL);
    }
  });

  test("un membre authentifié hors allow-list est « unauthenticated », pas viewer", async () => {
    fakeEmail = "member-sans-droits@test.invalid";
    const guard = await adminAuth.requireAdmin(fakeReq(), "viewer");
    assert.deepEqual(guard, { ok: false, reason: "unauthenticated" });
  });
});

describe("D24 — adminGuardResponse : statut et code par verdict", () => {
  test("unauthenticated → 401 AUTH_REQUIRED", async () => {
    const guard = await adminAuth.requireAdmin(fakeReq(), "operator");
    const res = adminAuth.adminGuardResponse(guard);
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "AUTH_REQUIRED");
  });

  test("insufficient_role → 403 FORBIDDEN", async () => {
    fakeEmail = VIEWER_EMAIL;
    const guard = await adminAuth.requireAdmin(fakeReq(), "operator");
    const res = adminAuth.adminGuardResponse(guard);
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "FORBIDDEN");
  });

  test("requireAdminOrThrow : AuthError sur 401, ForbiddenError sur 403", async () => {
    await assert.rejects(
      () => adminAuth.requireAdminOrThrow(fakeReq(), "operator"),
      (err) => err.status === 401 && err.code === "AUTH_REQUIRED",
    );

    fakeEmail = VIEWER_EMAIL;
    await assert.rejects(
      () => adminAuth.requireAdminOrThrow(fakeReq(), "operator"),
      (err) => err.status === 403 && err.code === "FORBIDDEN",
    );
  });

  test("requireAdminOrThrow renvoie la session résolue (email + rôle)", async () => {
    fakeEmail = OPERATOR_EMAIL;
    const admin = await adminAuth.requireAdminOrThrow(fakeReq(), "operator");
    assert.deepEqual(admin, { email: OPERATOR_EMAIL, role: "operator" });
  });
});

// ── 2. Une vraie route, de bout en bout ───────────────────────────────
//
// `GET /api/admin/audit-log` exige le rôle operator. C'est le point d'entrée
// qui répondait 403 à un appel anonyme : le bug D24, au niveau HTTP.

describe("D24 — GET /api/admin/audit-log (point d'entrée réel)", () => {
  test("sans session admin → 401 (et surtout pas 403)", async () => {
    const res = await auditLogRoute.GET(fakeReq());
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "AUTH_REQUIRED");
  });

  test("admin viewer sur une route operator → 403", async () => {
    fakeEmail = VIEWER_EMAIL;
    const res = await auditLogRoute.GET(fakeReq());
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "FORBIDDEN");
  });

  test("les deux verdicts sont bien distincts : 401 ≠ 403", async () => {
    const anonymous = await auditLogRoute.GET(fakeReq());
    fakeEmail = VIEWER_EMAIL;
    const viewer = await auditLogRoute.GET(fakeReq());
    assert.notEqual(anonymous.status, viewer.status);
    assert.equal(anonymous.status, 401);
    assert.equal(viewer.status, 403);
  });
});