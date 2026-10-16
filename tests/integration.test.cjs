/**
 * Integration tests — admin auth API + protected endpoints.
 * Runs against a real Next.js dev server spawned automatically.
 *
 * Run:  node --test tests/integration.test.cjs
 *
 * SAFETY: These tests spawn a dev server that connects to DATABASE_URL.
 *     If DATABASE_URL points to production, WRITE tests will pollute it.
 *     All writes below are sandboxed and cleaned up in `after` :
 *       - Admin Member (email unique `integration-<run>-adm@…`, hard
 *         deleted afterwards — no soft-delete, no blacklist pollution)
 *       - Better Auth Verification OTP rows (deleted afterwards)
 *       - Better Auth User + Session rows from the OTP sign-in (deleted)
 *       - POST /api/auth/email-otp/send-verification-otp is only ever
 *         called with UNKNOWN emails (anti-enumeration path) so the app
 *         never sends a real email and writes no EmailEvent row.
 *       - POST /api/analytics, POST /api/events, POST /api/members,
 *         workshop enroll/submit/attempt writes → still REMOVED.
 *     Only GET/verify/logout/auth-OTP tests remain. For anything else, use
 *     a dedicated test database (set TESTING_DATABASE_URL in .env.test).
 *
 * Requires: Next.js dev server starts on port 3737.
 * Server lifecycle is managed automatically (before/after hooks).
 *
 * Auth contract (Better Auth email-OTP, T17+) :
 *     1. `POST /api/auth/email-otp/send-verification-otp`
 *        `{ email, type: "sign-in" }` → `{ success: true }`
 *     2. `POST /api/auth/sign-in/email-otp` `{ email, otp }`
 *        → `{ token, user }` + `better-auth.session_token` cookie.
 *     Admin rights come from `Member.adminRole` ("operator"/"viewer").
 *     There is NO `/api/admin/login` route anymore (passcode screen
 *     removed, commit 580091b) and NO email+password (`emailAndPassword`
 *     is disabled in `src/lib/auth`) : the old `{ passcode }` cases were
 *     remapped to the two endpoints above.
 *
 * Auth-call budget (READ THIS before adding a test) :
 *     `src/app/api/auth/[...betterAuth]/route.ts` wraps EVERY auth call
 *     (send + sign-in share one bucket) with `otp-signin:<ip>` :
 *     capacity 5 per 10 minutes. The 6th call within 10 min does NOT
 *     return 429 — the thrown RateLimitError escapes the handler and
 *     Next.js answers 500. Consequence : this whole file may issue at
 *     most 5 `/api/auth/*` calls, in this fixed order —
 *       send/unknown(200) → send/invalid(400) → sign-in/wrong(400) →
 *       sign-in/valid(200, jar cached) → sign-in/replay(400).
 *     Everything else reuses the cached jar (zero auth calls). The old
 *     login intents that do not fit the budget (missing/empty/invalid-JSON
 *     payloads, dedicated rate-limit burst) are NOT covered in-suite : a
 *     burst test would need 6+ calls and poison the bucket for the rest
 *     of the file. They require an isolated run, not more tests here.
 *     Compensating zero-budget coverage was added instead (pagination,
 *     compare mode, level filter — all real).
 *
 * Post-logout note : Better Auth `cookieCache` (1 h) means a verify WITH
 *     the full jar still reads authed:true after server-side revocation.
 *     The post-logout test therefore re-sends the session token ALONE
 *     (no `session_data`), forcing the DB lookup that proves revocation.
 *
 * Test-only plumbing (no production equivalent, all inside this file) :
 *     - `DATABASE_URL` : read from process.env, else from the repo .env*
 *       files (plain node does not load .env by itself). Fails fast with
 *       a clear message when absent.
 *     - `NEXT_PUBLIC_SITE_URL` is forced to the test origin when spawning
 *       the server so Better Auth `trustedOrigins` accepts our Origin.
 *     - `Member` + OTP rows are created via Prisma (no API promotes to
 *       adminRole, no API returns OTPs — by design) and hard-deleted in
 *       `after`, keyed by a unique per-run token.
 *
 * Coverage:
 *  - send-verification-otp — unknown / invalid (budget 2/5)
 *  - sign-in/email-otp   — wrong / valid+cookies / replay (budget 5/5)
 *  - /api/admin/verify   — no cookie / garbage / unknown / valid session
 *  - /api/admin/logout   — 200 + server-side revocation (LAST: it kills
 *                          the shared session)
 *  - Protected endpoints — 401/403 without cookie, 200 with session,
 *                          members pagination, analytics compare mode
 *  - Public endpoints    — work without auth (GET only)
 *  - /api/events/notify-count — auth + domain/level filters + invalid
 *  - /api/admin/audit-log     — auth + CSV format
 *  - /api/admin/activity      — auth + limit param
 *  - workshops — 401 without member session (unchanged)
 */

"use strict";

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { setTimeout: wait } = require("node:timers/promises");
const http = require("node:http");

const PORT = 3737;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SERVER_START_TIMEOUT_MS = 90_000;

// Unique per-run token: every row created by this file carries it, so
// `after` deletes exactly what this run created (never another run's).
const RUN_TOKEN = `it${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
// Secret cron du run (hérité par le serveur spawné — #153) : n'écrase jamais
// un secret réel déjà posé dans l'environnement.
process.env.CRON_SECRET ??= `integration-cron-${RUN_TOKEN}`;
const ADMIN_EMAIL = `integration-${RUN_TOKEN}-adm@example.com`;
const unknownEmail = (i) => `integration-${RUN_TOKEN}-unk${i}@example.com`;

// ── Test-only environment ───────────────────────────────────────

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Plain node does not load .env files (Next.js does for the server it
  // spawns). Fall back to the repo dotenv cascade, dev order.
  const fs = require("node:fs");
  for (const f of [".env.development.local", ".env.local", ".env.development", ".env"]) {
    try {
      const text = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (v) return v;
      }
    } catch { /* file missing — try next */ }
  }
  return null;
}

let prisma = null;
function getPrisma() {
  if (prisma) return prisma;
  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    throw new Error(
      "[integration] DATABASE_URL introuvable (ni dans l'environnement, ni dans les .env*) — " +
      "impossible de préparer la session admin. Exportez DATABASE_URL avant de lancer ce fichier.",
    );
  }
  // Same URL for the Prisma client below and the spawned server (which
  // inherits process.env): both sides always talk to the same database.
  process.env.DATABASE_URL = dbUrl;
  prisma = new (require("@prisma/client").PrismaClient)();
  return prisma;
}

// ── HTTP helpers ────────────────────────────────────────────────

function httpRequest(method, path, opts = {}) {
  const { body, headers = {}, cookies = {} } = opts;
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      "Content-Type": "application/json",
      Origin: BASE_URL,
      ...headers,
    };
    if (Object.keys(cookies).length) {
      reqHeaders["Cookie"] = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers: reqHeaders,
    }, (res) => {
      const raw = res.headers["set-cookie"];
      const setCookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, json, setCookies, text: data });
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

/** Cookie jar from raw Set-Cookie lines (one entry per cookie — never
 *  split on commas, Expires attributes contain them). */
function jarFromSetCookies(setCookies) {
  const jar = {};
  for (const c of setCookies || []) {
    const pair = String(c).split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}

// ── Server lifecycle ─────────────────────────────────────────────

let server;
let serverReady = false;

async function waitForServer() {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const r = await httpRequest("GET", "/api/community/count");
      if (r.status < 500) return;
    } catch { /* not up */ }
    await wait(500);
  }
  throw new Error(`Server did not start within ${SERVER_START_TIMEOUT_MS}ms`);
}

function startServer() {
  // NEXT_PUBLIC_SITE_URL is forced to the test origin: Better Auth
  // `trustedOrigins` (CSRF check on cookie-less /api/auth/* calls) must
  // accept our Origin header. Nothing else in these tests depends on it.
  const env = { ...process.env, NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: BASE_URL };
  const nextCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextCli, "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    env, stdio: ["ignore", "pipe", "pipe"], detached: false,
  });
  server.stderr?.on("data", () => {});
  server.stdout?.on("data", () => {});
  server.on("error", e => { throw e; });
}

async function stopServer() {
  if (!server) return;
  // Attendre la sortie réelle (sinon un zombie garde le port et le run
  // suivant parle à un serveur résiduel — contamination silencieuse).
  const exited = new Promise((resolve) => {
    server.on("exit", () => resolve(true));
    setTimeout(() => resolve(false), 10_000);
  });
  try { server.kill("SIGTERM"); } catch { /* already dead */ }
  if (!(await exited)) {
    try { server.kill("SIGKILL"); } catch { /* ignore */ }
    await wait(1000);
  }
  server = null;
}

/** Le port est-il occupé (serveur résiduel d'un run précédent) ? */
function portInUse() {
  const net = require("node:net");
  return new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1");
    s.on("connect", () => { s.end(); resolve(true); });
    s.on("error", () => resolve(false));
  });
}

async function ensureServer() {
  if (serverReady) return;
  // Fail fast (instead of a 90 s start timeout): without DATABASE_URL the
  // spawned server can never answer below 500, and the Prisma setup below
  // cannot connect either.
  if (!resolveDatabaseUrl()) {
    throw new Error(
      "[integration] DATABASE_URL introuvable (ni dans l'environnement, ni dans les .env*) — " +
      "exportez DATABASE_URL (ex. le Postgres de dev) avant de lancer ce fichier.",
    );
  }
  if (await portInUse()) {
    throw new Error(
      `[integration] le port ${PORT} est déjà occupé (serveur résiduel ?) — ` +
      "libérez-le avant de lancer ce fichier (un serveur étranger fausserait tous les tests).",
    );
  }
  startServer();
  await waitForServer();
  serverReady = true;
}

// ── Admin session setup (test-only, cleaned in `after`) ──────────

const SIGN_IN_ID = (email) => `sign-in-otp-${email}`;

function makeOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function ensureAdminMember() {
  const db = getPrisma();
  const existing = await db.member.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } });
  if (existing) return;
  await db.member.create({
    data: {
      firstName: "Integ",
      email: ADMIN_EMAIL,
      country: "BJ",
      primaryDomain: "web",
      level: "beginner",
      goal: "project",
      availability: "2-5h",
      learningStyle: "practice",
      adminRole: "operator",
    },
  });
}

/** Mint a sign-in OTP row exactly as Better Auth stores it
 *  (`<otp>:<attempts>`, plain, 5 min) — reading real OTP emails is
 *  impossible from here, and triggering a real send would email a
 *  provider + write EmailEvent rows. The HTTP verification below stays
 *  100% real. */
async function mintSignInOtp(email, otp) {
  const db = getPrisma();
  await db.verification.deleteMany({ where: { identifier: SIGN_IN_ID(email) } });
  await db.verification.create({
    data: {
      identifier: SIGN_IN_ID(email),
      value: `${otp}:0`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

let cachedAdminJar = null;
let lastConsumedOtp = null;
/** Shared admin session. In full runs the jar is populated once by the
 *  sign-in/valid test below (zero extra auth calls); standalone runs
 *  (test-name-pattern) perform one real login as fallback. */
async function authedJar() {
  if (cachedAdminJar) return cachedAdminJar;
  await ensureAdminMember();
  const otp = makeOtp();
  await mintSignInOtp(ADMIN_EMAIL, otp);
  const login = await httpRequest("POST", "/api/auth/sign-in/email-otp", {
    body: { email: ADMIN_EMAIL, otp },
  });
  assert.equal(login.status, 200, `admin sign-in failed: ${login.status} ${JSON.stringify(login.json)}`);
  cachedAdminJar = jarFromSetCookies(login.setCookies);
  assert.ok(
    cachedAdminJar["better-auth.session_token"],
    `session cookie missing in ${JSON.stringify(Object.keys(cachedAdminJar))}`,
  );
  return cachedAdminJar;
}

async function cleanupTestData() {
  if (!prisma) return;
  try {
    await prisma.verification.deleteMany({ where: { identifier: { contains: RUN_TOKEN } } });
    await prisma.session.deleteMany({ where: { user: { email: { contains: RUN_TOKEN } } } });
    await prisma.user.deleteMany({ where: { email: { contains: RUN_TOKEN } } });
    await prisma.member.deleteMany({ where: { email: { contains: RUN_TOKEN } } });
  } catch (e) {
    console.log("[integration] cleanup warning:", e?.message ?? e);
  }
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  prisma = null;
}

// ── send-verification-otp (auth calls 1-2/5) ─────────────────────
// NOTE: `POST /api/admin/login` no longer exists (passcode screen removed,
// commit 580091b). Old login intents remapped: invalid JSON / missing /
// empty payloads and the rate-limit burst do not fit the shared 5-calls-
// per-10-min budget (see header) and are documented there, not tested.

describe("POST /api/auth/email-otp/send-verification-otp", () => {
  before(ensureServer);

  test("→ 200 { success: true } for unknown email (anti-enumeration, no leak)", async () => {
    const email = unknownEmail(0);
    const res = await httpRequest("POST", "/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    });
    assert.equal(res.status, 200, `send failed: ${JSON.stringify(res.json)}`);
    assert.equal(res.json?.success, true);
  });

  test("→ 400 when email is invalid", async () => {
    const res = await httpRequest("POST", "/api/auth/email-otp/send-verification-otp", {
      body: { email: "not-an-email", type: "sign-in" },
    });
    assert.equal(res.status, 400);
  });
});

// ── sign-in/email-otp (auth calls 3-5/5 — the real login) ─────────

describe("POST /api/auth/sign-in/email-otp", () => {
  before(ensureServer);

  test("→ 400 INVALID_OTP when otp is wrong", async () => {
    await ensureAdminMember();
    const otp = makeOtp();
    await mintSignInOtp(ADMIN_EMAIL, otp);
    const res = await httpRequest("POST", "/api/auth/sign-in/email-otp", {
      body: { email: ADMIN_EMAIL, otp: "000000" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json?.code, "INVALID_OTP");
  });

  test("→ 200 with correct otp, sets session cookies", async () => {
    await ensureAdminMember();
    const otp = makeOtp();
    await mintSignInOtp(ADMIN_EMAIL, otp);
    const res = await httpRequest("POST", "/api/auth/sign-in/email-otp", {
      body: { email: ADMIN_EMAIL, otp },
    });
    assert.equal(res.status, 200, `sign-in failed: ${JSON.stringify(res.json)}`);
    assert.equal(typeof res.json?.token, "string");
    assert.equal(res.json?.user?.email, ADMIN_EMAIL);
    const jar = jarFromSetCookies(res.setCookies);
    assert.ok(jar["better-auth.session_token"], "session cookie must be set");
    cachedAdminJar = jar;
    lastConsumedOtp = otp;
  });

  test("→ 400 when the same otp is replayed (single-use)", async () => {
    // Rejoue l'OTP déjà consommé par le test précédent : aucune création
    // (zéro appel auth supplémentaire — budget 5/5 respecté). En run
    // isolé (test-name-pattern), rejoue un OTP consommé localement.
    let otp = lastConsumedOtp;
    if (!otp) {
      await ensureAdminMember();
      otp = makeOtp();
      await mintSignInOtp(ADMIN_EMAIL, otp);
      const first = await httpRequest("POST", "/api/auth/sign-in/email-otp", {
        body: { email: ADMIN_EMAIL, otp },
      });
      assert.equal(first.status, 200);
    }
    const replay = await httpRequest("POST", "/api/auth/sign-in/email-otp", {
      body: { email: ADMIN_EMAIL, otp },
    });
    assert.equal(replay.status, 400);
    assert.equal(replay.json?.code, "INVALID_OTP");
  });
});

// ── /api/admin/verify (zero auth calls — reuses the cached jar) ──

describe("GET /api/admin/verify", () => {
  before(ensureServer);

  test("→ 200 { authed: false } with no cookie", async () => {
    const res = await httpRequest("GET", "/api/admin/verify");
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
    assert.equal(res.json?.role, null);
  });

  test("→ 200 { authed: false } with garbage session cookie", async () => {
    const res = await httpRequest("GET", "/api/admin/verify", {
      cookies: { "better-auth.session_token": "garbage.invalid.token" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
  });

  test("→ 200 { authed: false } with unknown session token", async () => {
    const res = await httpRequest("GET", "/api/admin/verify", {
      cookies: { "better-auth.session_token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
  });

  test("→ 200 { authed: true, role: operator } with valid session", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/admin/verify", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, true);
    assert.equal(res.json?.role, "operator");
  });
});

// ── Protected endpoints ─────────────────────────────────────────

describe("protected endpoints require auth", () => {
  before(ensureServer);

  test("GET /api/members → 401 without cookie", async () => {
    const res = await httpRequest("GET", "/api/members");
    assert.equal(res.status, 401);
  });

  test("GET /api/analytics → 401 without cookie", async () => {
    const res = await httpRequest("GET", "/api/analytics");
    assert.equal(res.status, 401);
  });

  test("GET /api/members → 200 with valid session", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/members", { cookies: jar });
    assert.equal(res.status, 200, `got ${res.status}: ${JSON.stringify(res.json)}`);
    assert.ok(Array.isArray(res.json?.members));
  });

  test("GET /api/members?page=1&pageSize=5 → paginated shape", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/members?page=1&pageSize=5", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(res.json?.page, 1);
    assert.equal(res.json?.pageSize, 5);
    assert.equal(typeof res.json?.total, "number");
    assert.ok(Array.isArray(res.json?.members));
    assert.ok(res.json.members.length <= 5);
  });

  test("GET /api/analytics?compare=true → compare shape", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/analytics?compare=true&period=week", { cookies: jar });
    assert.equal(res.status, 200, `got ${res.status}: ${JSON.stringify(res.json)}`);
    assert.equal(typeof res.json?.current?.total, "number");
    assert.equal(typeof res.json?.change?.totalPct, "number");
  });
});

// ── Public endpoints ────────────────────────────────────────────

describe("public endpoints work without auth", () => {
  before(ensureServer);

  test("GET /api/community/count → 200", async () => {
    const res = await httpRequest("GET", "/api/community/count");
    assert.equal(res.status, 200);
    assert.equal(typeof res.json?.count, "number");
  });

  test("GET /api/health → 200", async () => {
    const res = await httpRequest("GET", "/api/health");
    assert.equal(res.status, 200);
    assert.ok(["ok", "degraded", "down"].includes(res.json?.status));
  });

  // NOTE: POST /api/analytics intentionally omitted — it would create
  // reboot_page_view events in the production database.
});

// ── GET /api/events/notify-count ─────────────────────────────────

describe("GET /api/events/notify-count — auth + params", () => {
  before(ensureServer);

  test("→ 401 without cookie", async () => {
    const res = await httpRequest("GET", "/api/events/notify-count");
    assert.equal(res.status, 401);
  });

  test("→ 200 with auth, returns count + domain/level", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/events/notify-count", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(typeof res.json?.count, "number");
    assert.equal(res.json?.domain, null);
    assert.equal(res.json?.level, null);
  });

  test("→ 200 with domain filter", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/events/notify-count?domain=web", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(res.json?.domain, "web");
    assert.equal(typeof res.json?.count, "number");
  });

  test("→ 200 with level filter", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/events/notify-count?level=beginner", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(res.json?.level, "beginner");
    assert.equal(typeof res.json?.count, "number");
  });

  test("→ 422 with invalid domain", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/events/notify-count?domain=invalid", { cookies: jar });
    assert.equal(res.status, 422);
  });
});

// ── GET /api/admin/audit-log ─────────────────────────────────────

describe("GET /api/admin/audit-log — auth + format", () => {
  before(ensureServer);

  test("→ 403 without cookie (requireAdminRole returns false)", async () => {
    const res = await httpRequest("GET", "/api/admin/audit-log");
    assert.equal(res.status, 403);
  });

  test("→ 200 with auth, returns logs array", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/admin/audit-log", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json?.logs));
    assert.equal(typeof res.json?.total, "number");
  });

  test("→ 200 with ?format=csv, returns CSV content", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/admin/audit-log?format=csv", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"]?.includes("text/csv"));
  });
});

// ── GET /api/admin/activity ──────────────────────────────────────

describe("GET /api/admin/activity — auth + format", () => {
  before(ensureServer);

  test("→ 403 without cookie (requireAdminRole returns false)", async () => {
    const res = await httpRequest("GET", "/api/admin/activity");
    assert.equal(res.status, 403);
  });

  test("→ 200 with auth, returns events array", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/admin/activity", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json?.events));
  });

  test("→ 200 with ?limit=5, respects limit", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/admin/activity?limit=5", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(res.json.events.length <= 5);
  });
});

// NOTE: POST /api/events intentionally omitted — it creates events in the
// production database. Use unit tests or a dedicated test DB for write-path.

describe("workshops — auth (read-only, aucune écriture sans session)", () => {
  test("GET /api/workshops → 401 sans cookie", async () => {
    const res = await httpRequest("GET", "/api/workshops");
    assert.equal(res.status, 401);
    assert.equal(res.json.code, "UNAUTHENTICATED");
  });

  test("GET /api/workshops/[slug] → 401 sans cookie", async () => {
    const res = await httpRequest("GET", "/api/workshops/whatever-slug");
    assert.equal(res.status, 401);
    assert.equal(res.json.code, "UNAUTHENTICATED");
  });

  // POST enroll sans session → 401 AVANT toute écriture : sonde sûre en prod.
  test("POST /api/workshops/[slug]/enroll → 401 sans cookie (aucune écriture)", async () => {
    const res = await httpRequest("POST", "/api/workshops/maitrise-github-bases/enroll", {
      body: {},
    });
    assert.equal(res.status, 401);
    assert.equal(res.json.code, "UNAUTHENTICATED");
  });

  test("GET /api/workshops/sessions/[id] → 401 sans cookie", async () => {
    const res = await httpRequest("GET", "/api/workshops/sessions/whatever-id");
    assert.equal(res.status, 401);
    assert.equal(res.json.code, "UNAUTHENTICATED");
  });

  test("POST /api/workshops/sessions/[id]/submissions → 401 sans cookie", async () => {
    const res = await httpRequest("POST", "/api/workshops/sessions/whatever-id/submissions", {
      body: { content: "x" },
    });
    assert.equal(res.status, 401);
    assert.equal(res.json.code, "UNAUTHENTICATED");
  });

  test("POST /api/workshops/quizzes/[id]/attempts → 401 sans cookie", async () => {
    const res = await httpRequest("POST", "/api/workshops/quizzes/whatever-id/attempts", {
      body: { answers: [0] },
    });
    assert.equal(res.status, 401);
    assert.equal(res.json.code, "UNAUTHENTICATED");
  });
});

// ── Anti-abus #118 : rate-limit AVANT la session/DB ───────────────
// Zéro coût sur le budget auth : authedJar() réutilise le jar caché
// (aucun appel /api/auth/* supplémentaire). Placé avant le logout qui
// tue la session partagée. Le bucket `community-join` (30/10min) n'est
// touché par aucun autre test du fichier (clé isolée par endpoint).
// NOTE: POST /api/workshops/[slug]/enroll avec session intentionally omitted —
// it would create an enrollment row in the production database. Write-path
// coverage requires a dedicated test DB (see TESTING_DATABASE_URL note above).

describe("GET /api/community/join — anti-abus #118", () => {
  before(ensureServer);

  test("trafic normal (3 clics) → redirects, jamais 429/403", async () => {
    const jar = await authedJar();
    for (let i = 0; i < 3; i++) {
      const res = await httpRequest("GET", "/api/community/join", { cookies: jar });
      assert.ok(
        [307, 308].includes(res.status),
        `clic ${i + 1} légitime non bloqué (status=${res.status})`,
      );
    }
  });

  test("rafale (35 hits) → au moins un 429 (flood coupé avant la DB)", async () => {
    const jar = await authedJar();
    let seen429 = false;
    for (let i = 0; i < 35; i++) {
      const res = await httpRequest("GET", "/api/community/join", { cookies: jar });
      if (res.status === 429) {
        seen429 = true;
        assert.equal(res.json?.code, "RATE_LIMITED");
        assert.ok(res.headers["retry-after"], "Retry-After présent");
        break;
      }
    }
    assert.ok(seen429, "la rafale doit finir en 429 (bucket 30/10min)");
  });
});

// ── GET /api/cron/purge — rétention #153 ──────────────────────────
// Zéro coût auth (aucun appel /api/auth/*). Placé avant le logout (aucun
// lien, mais le logout DOIT rester dernier : il tue la session partagée).

describe("GET /api/cron/purge — rétention #153", () => {
  before(ensureServer);

  test("→ 401 sans header Bearer", async () => {
    const res = await httpRequest("GET", "/api/cron/purge");
    assert.equal(res.status, 401);
  });

  test("→ 401 avec un mauvais secret", async () => {
    const res = await httpRequest("GET", "/api/cron/purge", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    assert.equal(res.status, 401);
  });

  test("→ 200 avec le secret, forme des compteurs (zéro écriture métier)", async () => {
    const res = await httpRequest("GET", "/api/cron/purge", {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.ok, true);
    for (const k of ["drafts", "analytics", "emailLogs", "providerMetrics"]) {
      assert.equal(typeof res.json?.purged?.[k], "number", `compteur ${k}`);
    }
  });
});

// ── Missions #232(c) : membre + revue admin ─────────────────────────
// Zéro coût auth (jar admin caché = session membre opérateur). Slugs
// uniques par run ; nettoyage par suppression des missions (cascades).
// Placé avant le logout qui tue la session partagée.

describe("Missions — parcours membre + revue admin #232c", () => {
  before(ensureServer);

  const slugA = `it-mission-a-${RUN_TOKEN}`;
  const slugB = `it-mission-b-${RUN_TOKEN}`;
  let mA = null;
  let mB = null;

  test("admin crée 2 missions (DRAFT), slug dupliqué → 409", async () => {
    const jar = await authedJar();
    for (const slug of [slugA, slugB]) {
      const res = await httpRequest("POST", "/api/admin/missions", {
        cookies: jar,
        body: { slug, title: `Mission ${slug}`, domain: "web", level: "beginner" },
      });
      assert.equal(res.status, 201, JSON.stringify(res.json));
      assert.equal(res.json?.mission?.status, "DRAFT");
      if (slug === slugA) mA = res.json.mission;
      else mB = res.json.mission;
    }
    const dup = await httpRequest("POST", "/api/admin/missions", {
      cookies: jar,
      body: { slug: slugA, title: "dup" },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.json?.code, "SLUG_TAKEN");
  });

  test("admin publie A (DRAFT→PUBLISHED), transition interdite rejetée", async () => {
    const jar = await authedJar();
    const pub = await httpRequest("PATCH", `/api/admin/missions/${mA.id}`, {
      cookies: jar,
      body: { status: "PUBLISHED" },
    });
    assert.equal(pub.status, 200);
    assert.equal(pub.json?.mission?.status, "PUBLISHED");
    const bad = await httpRequest("PATCH", `/api/admin/missions/${mB.id}`, {
      cookies: jar,
      body: { status: "ARCHIVED" },
    });
    assert.equal(bad.status, 422);
    assert.equal(bad.json?.code, "INVALID_TRANSITION");
    const pubB = await httpRequest("PATCH", `/api/admin/missions/${mB.id}`, {
      cookies: jar,
      body: { status: "PUBLISHED" },
    });
    assert.equal(pubB.status, 200);
  });

  test("public : PUBLISHED listées, DRAFT jamais", async () => {
    const res = await httpRequest("GET", "/api/missions");
    assert.equal(res.status, 200);
    const slugs = res.json?.missions?.map((m) => m.slug) ?? [];
    assert.ok(slugs.includes(slugA), "mission publiée listée");
  });

  test("start sans session → 401 ; avec session → ACTIVE idempotent", async () => {
    const noAuth = await httpRequest("POST", `/api/missions/${mA.id}/start`);
    assert.equal(noAuth.status, 401);
    const jar = await authedJar();
    const s1 = await httpRequest("POST", `/api/missions/${mA.id}/start`, { cookies: jar });
    assert.ok([200, 201].includes(s1.status));
    assert.equal(s1.json?.assignment?.status, "ACTIVE");
    const s2 = await httpRequest("POST", `/api/missions/${mA.id}/start`, { cookies: jar });
    assert.equal(s2.status, 200);
    assert.equal(s2.json?.created, false);
    assert.equal(s2.json?.assignment?.id, s1.json?.assignment?.id);
  });

  test("soumettre sans démarrer → 422 ; puis 201 attempt 1 ; double → 409", async () => {
    const jar = await authedJar();
    const early = await httpRequest("POST", `/api/missions/${mB.id}/submit`, {
      cookies: jar,
      body: { content: "trop tôt" },
    });
    assert.equal(early.status, 422);
    assert.equal(early.json?.code, "START_FIRST");
    const bad = await httpRequest("POST", `/api/missions/${mA.id}/submit`, {
      cookies: jar,
      body: { content: "" },
    });
    assert.equal(bad.status, 422);
    const s1 = await httpRequest("POST", `/api/missions/${mA.id}/submit`, {
      cookies: jar,
      body: { content: "ma réalisation" },
    });
    assert.equal(s1.status, 201);
    assert.equal(s1.json?.attempt, 1);
    assert.equal(s1.json?.submission?.status, "PENDING");
    const s2 = await httpRequest("POST", `/api/missions/${mA.id}/submit`, {
      cookies: jar,
      body: { content: "double clic" },
    });
    assert.equal(s2.status, 409);
    assert.equal(s2.json?.code, "ALREADY_SUBMITTED");
  });

  test("revue APPROVED → VALIDATED + validatedAt ; rejouée → 409 ; progression", async () => {
    const jar = await authedJar();
    const list = await httpRequest(
      "GET",
      `/api/admin/mission-submissions?missionId=${mA.id}&status=PENDING`,
      { cookies: jar },
    );
    assert.equal(list.status, 200);
    assert.equal(list.json?.submissions?.length, 1);
    const subId = list.json.submissions[0].id;
    const rev = await httpRequest(
      "POST",
      `/api/admin/mission-submissions/${subId}/review`,
      { cookies: jar, body: { decision: "APPROVED", feedback: "Beau travail." } },
    );
    assert.equal(rev.status, 200);
    assert.equal(rev.json?.submission?.status, "APPROVED");
    const again = await httpRequest(
      "POST",
      `/api/admin/mission-submissions/${subId}/review`,
      { cookies: jar, body: { decision: "REJECTED", feedback: "x" } },
    );
    assert.equal(again.status, 409);
    assert.equal(again.json?.code, "ALREADY_REVIEWED");
    const prog = await httpRequest("GET", "/api/account/missions", { cookies: jar });
    assert.equal(prog.status, 200);
    assert.equal(prog.json?.progress?.validated, 1);
    assert.ok(prog.json?.progress?.validatedMissionIds?.includes(mA.id));
  });

  test("abandon après validation → 404 ; nettoyage via Prisma (cascades)", async () => {
    const jar = await authedJar();
    const ab = await httpRequest("POST", `/api/missions/${mA.id}/abandon`, { cookies: jar });
    assert.equal(ab.status, 404);
    // Nettoyage : suppression des missions du run (cascades assignments,
    // soumissions, revues). Convention du fichier : plumbing Prisma direct.
    const db = getPrisma();
    const gone = await db.mission.deleteMany({
      where: { slug: { in: [slugA, slugB] } },
    });
    assert.equal(gone.count, 2, "missions du run nettoyées");
    const left = await db.missionAssignment.count({
      where: { missionId: { in: [mA.id, mB.id] } },
    });
    assert.equal(left, 0, "aucune assignation orpheline");
  });
});

// ── Participation unifiée + CSRF #233 ────────────────────────────
// Zéro coût auth (jar caché). Origin étrangère → 403 avant toute écriture
// (jamais d'email ni de ligne créée). Placé avant le logout qui tue la session.

describe("Participation unifiée + CSRF #233", () => {
  before(ensureServer);

  const EVIL = "https://evil.example";

  test("Origin étrangère → 403 (start, rsvp, enroll)", async () => {
    const jar = await authedJar();
    const evil = { Origin: EVIL };
    const s = await httpRequest("POST", `/api/missions/it-nope-${RUN_TOKEN}/start`, {
      cookies: jar,
      headers: evil,
    });
    assert.equal(s.status, 403);
    assert.equal(s.json?.code, "FORBIDDEN");
    const r = await httpRequest("POST", "/api/events/nope/rsvp", {
      cookies: jar,
      headers: { ...evil, "Content-Type": "application/json" },
      body: { status: "going" },
    });
    assert.equal(r.status, 403);
    const e = await httpRequest("POST", "/api/workshops/nope/enroll", {
      cookies: jar,
      headers: evil,
    });
    assert.equal(e.status, 403);
  });

  test("unifiée : start → participation contient la mission ; cleanup", async () => {
    const jar = await authedJar();
    const slug = `it-part-${RUN_TOKEN}`;
    const created = await httpRequest("POST", "/api/admin/missions", {
      cookies: jar,
      body: { slug, title: "Participation", domain: "web", level: "beginner" },
    });
    assert.equal(created.status, 201);
    const mid = created.json.mission.id;
    await httpRequest("PATCH", `/api/admin/missions/${mid}`, {
      cookies: jar,
      body: { status: "PUBLISHED" },
    });
    const started = await httpRequest("POST", `/api/missions/${mid}/start`, { cookies: jar });
    assert.ok([200, 201].includes(started.status));
    const part = await httpRequest("GET", "/api/account/participation", { cookies: jar });
    assert.equal(part.status, 200);
    const mine = (part.json?.missions ?? []).find((m) => m.mission?.slug === slug);
    assert.ok(mine, "mission démarrée présente dans la vue unifiée");
    assert.equal(mine.status, "ACTIVE");
    assert.ok((part.json?.counts?.missions ?? 0) >= 1);
    assert.ok(Array.isArray(part.json?.workshops) && Array.isArray(part.json?.events));
    // Pas de PII d'autrui : que mes lignes.
    for (const m of part.json.missions ?? []) {
      assert.ok(!("email" in (m.mission ?? {})), "pas d'email dans la vue");
    }
    const db = getPrisma();
    await db.mission.deleteMany({ where: { slug } });
  });
});

// ── Dashboard admin #237 : agrégats SQL, forme stable ─────────────
// Lignes déterministes (ref unique par run) + nettoyage. Zéro coût auth.

describe("GET /api/admin/dashboard — agrégats #237", () => {
  before(ensureServer);

  const ref = `it-q-${RUN_TOKEN}`;

  test("→ 200, forme funnel/timing inchangée", async () => {
    const jar = await authedJar();
    const res = await httpRequest("GET", "/api/admin/dashboard", { cookies: jar });
    assert.equal(res.status, 200);
    // Forme réelle : fetchFunnel() est niché sous la clé `funnel`.
    assert.equal(typeof res.json?.funnel?.funnel?.sessionsStarted, "number");
    assert.equal(typeof res.json?.funnel?.funnel?.completionRate, "number");
    assert.ok(Array.isArray(res.json?.funnel?.timing));
  });

  test("timing exact sur lignes connues [10,20,30] puis cleanup", async () => {
    const jar = await authedJar();
    const db = getPrisma();
    await db.analyticsEvent.createMany({
      data: [10, 20, 30].map((value) => ({
        type: "profiling_question_timed",
        ref,
        value,
        sessionId: `it-sess-${RUN_TOKEN}`,
      })),
    });
    const res = await httpRequest("GET", "/api/admin/dashboard", { cookies: jar });
    assert.equal(res.status, 200);
    const row = (res.json?.funnel?.timing ?? []).find((t) => t.questionId === ref);
    assert.ok(row, "ligne timing présente");
    // avg=20, p50=tri[floor(3*0.5)]=20, p95=tri[min(2,floor(3*0.95))]=30.
    assert.deepEqual(
      { samples: row.samples, avgMs: row.avgMs, p50Ms: row.p50Ms, p95Ms: row.p95Ms },
      { samples: 3, avgMs: 20, p50Ms: 20, p95Ms: 30 },
    );
    await db.analyticsEvent.deleteMany({ where: { ref } });
  });
});

// ── Missions admin UI #222 : contrôle d'accès + validation ───────
// Sans cookie → 403 (requireAdminRole, comme workshops). Slug invalide → 422.
// Zéro coût auth, aucune écriture.

describe("Missions admin — accès et validation #222", () => {
  before(ensureServer);

  test("sans session → 403 (liste, création, revue)", async () => {
    const list = await httpRequest("GET", "/api/admin/missions");
    assert.equal(list.status, 403);
    const create = await httpRequest("POST", "/api/admin/missions", {
      body: { slug: "x", title: "y" },
    });
    assert.equal(create.status, 403);
    const rev = await httpRequest("POST", "/api/admin/mission-submissions/nope/review", {
      body: { decision: "APPROVED", feedback: "ok !" },
    });
    assert.equal(rev.status, 403);
  });

  test("slug normalisé (casse tolérée), formes invalides → 422", async () => {
    const jar = await authedJar();
    const db = getPrisma();
    // Casse tolérée : normalisée en minuscules (UX, pas d'erreur).
    const upper = await httpRequest("POST", "/api/admin/missions", {
      cookies: jar,
      body: { slug: `Majuscules-222-${RUN_TOKEN}`, title: "t" },
    });
    assert.equal(upper.status, 201);
    assert.equal(upper.json?.mission?.slug, `majuscules-222-${RUN_TOKEN.toLowerCase()}`);
    for (const slug of ["avec espaces", "ponctuation!", ""]) {
      const res = await httpRequest("POST", "/api/admin/missions", {
        cookies: jar,
        body: { slug, title: "t" },
      });
      assert.equal(res.status, 422, `slug rejeté : ${slug}`);
    }
    const empty = await httpRequest("POST", "/api/admin/missions", {
      cookies: jar,
      body: { slug: `ok-slug-222-${RUN_TOKEN}`, title: "" },
    });
    assert.equal(empty.status, 422);
    await db.mission.deleteMany({
      where: { slug: { in: [`majuscules-222-${RUN_TOKEN.toLowerCase()}`] } },
    });
  });
});

// ── Actions sensibles #224 : garde serveur opérateur ─────────────
// Sans session → 403 (jamais 401/200) AVANT toute lecture/écriture.
// Zéro coût auth, aucune écriture (garde en tête de route).

describe("Actions sensibles — garde opérateur #224", () => {
  before(ensureServer);

  test("reset-2fa, revoke admin, blacklist → 403 sans session", async () => {
    const r1 = await httpRequest("POST", "/api/admin/admins/nope/reset-2fa");
    assert.equal(r1.status, 403);
    const r2 = await httpRequest("DELETE", "/api/admin/admins?id=nope");
    assert.equal(r2.status, 403);
    const r3 = await httpRequest("POST", "/api/admin/blacklist", {
      body: { email: "x@y.zz" },
    });
    assert.equal(r3.status, 403);
    const r4 = await httpRequest("DELETE", "/api/admin/blacklist/nope");
    assert.equal(r4.status, 403);
  });
});

// ── Segments #104 : CRUD + whitelist + déterminisme ──────────────
// Zéro coût auth (jar caché). Nettoyage via Prisma (aucune écriture membre).

describe("Segments admin — CRUD et déterminisme #104", () => {
  before(ensureServer);

  const SEG = `it-seg-${RUN_TOKEN}`;
  let segId = null;

  test("sans session → 403 (liste, création, preview)", async () => {
    assert.equal((await httpRequest("GET", "/api/admin/segments")).status, 403);
    assert.equal(
      (await httpRequest("POST", "/api/admin/segments", { body: { name: "x", definition: { version: 1, all: [] } } })).status,
      403,
    );
    assert.equal((await httpRequest("GET", "/api/admin/segments/nope/preview")).status, 403);
  });

  test("création 201, doublon → 409, champ interdit → 422", async () => {
    const jar = await authedJar();
    const def = {
      version: 1,
      all: [
        { field: "domain", op: "eq", value: "web" },
        { field: "profileStatus", op: "in", value: ["PENDING", "APPROVED"] },
      ],
    };
    const created = await httpRequest("POST", "/api/admin/segments", {
      cookies: jar,
      body: { name: SEG, definition: def },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json?.segment?.version, 1);
    segId = created.json.segment.id;
    const dup = await httpRequest("POST", "/api/admin/segments", {
      cookies: jar,
      body: { name: SEG, definition: def },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.json?.code, "NAME_TAKEN");
    const forbidden = await httpRequest("POST", "/api/admin/segments", {
      cookies: jar,
      body: { name: `${SEG}-bad`, definition: { version: 1, all: [{ field: "email", op: "contains", value: "@" }] } },
    });
    assert.equal(forbidden.status, 422);
  });

  test("preview déterministe (2× mêmes ids), patch → v2, delete", async () => {
    const jar = await authedJar();
    const p1 = await httpRequest("GET", `/api/admin/segments/${segId}/preview?limit=50`, { cookies: jar });
    const p2 = await httpRequest("GET", `/api/admin/segments/${segId}/preview?limit=50`, { cookies: jar });
    assert.equal(p1.status, 200);
    assert.deepEqual(
      p1.json?.sample?.map((m) => m.id),
      p2.json?.sample?.map((m) => m.id),
      "même définition → même population",
    );
    assert.equal(typeof p1.json?.total, "number");
    const patched2 = await httpRequest("PATCH", `/api/admin/segments/${segId}`, {
      cookies: jar,
      body: { definition: { version: 1, all: [{ field: "domain", op: "eq", value: "ai" }] } },
    });
    assert.equal(patched2.status, 200);
    assert.equal(patched2.json?.segment?.version, 2);
    const gone = await httpRequest("DELETE", `/api/admin/segments/${segId}`, { cookies: jar });
    assert.equal(gone.status, 200);
    const db = getPrisma();
    assert.equal(await db.segment.count({ where: { id: segId } }), 0);
  });
});

// ── Qualité leads #105 : agrégats exacts sur seed déterministe ────
// Seed via Prisma (nettoyé), lecture via route. Deltas (base partagée).

describe("Qualité leads — agrégats #105", () => {
  before(ensureServer);

  const E1 = `it-q1-${RUN_TOKEN}@example.com`;
  const E2 = `it-q2-${RUN_TOKEN}@example.com`;
  const E3 = `it-q3-${RUN_TOKEN}@example.com`;
  const baseProfile = {
    firstName: "Q",
    country: "BJ",
    primaryDomain: "web",
    level: "beginner",
    availability: "2-5h",
    learningStyle: "practice",
  };

  test("sans session → 403", async () => {
    assert.equal((await httpRequest("GET", "/api/admin/leads/quality")).status, 403);
  });

  test("agrégats exacts (deltas), sample scoré, cleanup", async () => {
    const jar = await authedJar();
    const db = getPrisma();
    const before = await (
      await httpRequest("GET", "/api/admin/leads/quality", { cookies: jar })
    ).json;
    // Seed : m1 plein+converti+consenti, m2 minimal, m3 converti sans handoff.
    const m1 = await db.member.create({
      data: {
        ...baseProfile,
        email: E1,
        lastName: "Q",
        phone: "+22990000001",
        city: "Cotonou",
        secondaryDomains: '["ai"]',
        goal: "project",
        goalProjectStage: "idea",
        availabilityTimes: "soirs",
        mentoringInterest: "yes",
        mentoringTypes: '["technique"]',
        mentoringFrequency: "hebdo",
        mentoringDomain: "web",
        budgetWillingness: "yes",
        budgetRange: "2500-5000",
        threeMonthGoal: "Lancer",
        profileStatus: "APPROVED",
      },
    });
    await db.member.create({
      data: { ...baseProfile, email: E2, goal: "employment", profileStatus: "PENDING" },
    });
    await db.member.create({
      data: { ...baseProfile, email: E3, goal: "project", profileStatus: "APPROVED" },
    });
    await db.consent.createMany({
      data: [
        { email: E1, purpose: "profiling", choice: "granted", textVersion: "t-v1" },
        { email: E1, purpose: "contact", choice: "granted", textVersion: "t-v1" },
        { email: E1, purpose: "handoff", choice: "granted", textVersion: "t-v1" },
      ],
    });
    await db.qualification.create({
      data: { memberId: m1.id, archetype: "WEB BUILDER", engineVersion: "t-1", status: "QUALIFIED" },
    });

    const after = (
      await httpRequest("GET", "/api/admin/leads/quality", { cookies: jar })
    ).json;
    assert.equal(after.totals.members - before.totals.members, 3);
    assert.equal(after.contactability.withPhone - before.contactability.withPhone, 1);
    assert.equal(after.totals.converted - before.totals.converted, 2);
    assert.equal(after.consents.profilingGranted - before.consents.profilingGranted, 1);
    assert.ok(
      (after.qualifications ?? []).some(
        (q) => q.status === "QUALIFIED" && q.n >= 1,
      ),
      "distribution qualification",
    );
    // m3 converti sans handoff → gap +1 (m1 consenti : hors gap).
    assert.equal(after.handoffGap - before.handoffGap, 1);
    // m2 emploi sans situation → incohérence +1.
    assert.ok(
      after.coherence.employmentWithoutSituation - before.coherence.employmentWithoutSituation >= 1,
    );
    const s1 = (after.sample ?? []).find((m) => m.email === E1);
    assert.ok(s1, "m1 dans l'échantillon");
    assert.equal(s1.score, 100);
    assert.deepEqual(s1.flags, []);

    // Cleanup (consents/qualifications sans FK : explicite).
    await db.qualification.deleteMany({ where: { memberId: m1.id } });
    await db.consent.deleteMany({ where: { email: { in: [E1, E2, E3] } } });
    await db.analyticsEvent.deleteMany({
      where: { memberId: { in: [m1.id] } },
    });
    await db.member.deleteMany({ where: { email: { in: [E1, E2, E3] } } });
    for (const em of [E1, E2, E3]) {
      assert.equal(await db.member.count({ where: { email: em } }), 0);
    }
  });
});

// ── Export filtré #101 : whitelist, minimisation, segment, plafond ─
// Zéro coût auth (jar caché). Seed volumineux nettoyé (préfixe RUN_TOKEN).

describe("Export filtré des leads #101", () => {
  before(ensureServer);

  const BULK = `bulk101-${RUN_TOKEN}`;

  test("sans session → 401 (csv + json)", async () => {
    assert.equal((await httpRequest("GET", "/api/export")).status, 401);
    assert.equal((await httpRequest("GET", "/api/export/json")).status, 401);
  });

  test("filtre invalide → 422 ; colonnes minimisées par défaut", async () => {
    const jar = await authedJar();
    const bad = await httpRequest("GET", "/api/export?domain=cobol", { cookies: jar });
    assert.equal(bad.status, 422);
    const csv = await httpRequest("GET", "/api/export?limit=1", { cookies: jar });
    assert.equal(csv.status, 200);
    const header = (csv.text ?? "").split("\r\n")[0] ?? "";
    assert.ok(!header.includes("adminNote"), "adminNote hors défaut CSV");
    assert.ok(!header.includes("adminRole"), "adminRole hors défaut CSV");
    assert.ok(header.includes("email"), "email présent");
    const optin = await httpRequest("GET", "/api/export?fields=email,adminNote", {
      cookies: jar,
    });
    assert.equal(optin.status, 200);
    assert.ok(((optin.text ?? "").split("\r\n")[0] ?? "").includes("adminNote"));
    const json = await httpRequest("GET", "/api/export/json?limit=1", { cookies: jar });
    assert.equal(json.status, 200);
    assert.ok(!("adminNote" in ((json.json?.members ?? [])[0] ?? {})), "adminNote hors défaut JSON");
  });

  test("segment + dataset vide (en-têtes seuls) ; audit tracé", async () => {
    const jar = await authedJar();
    const db = getPrisma();
    const seg = await db.segment.create({
      data: {
        name: `it-exp-${RUN_TOKEN}`,
        definition: { version: 1, all: [{ field: "country", op: "eq", value: "ZZ" }] },
      },
    });
    const csv = await httpRequest("GET", `/api/export?segment=${seg.id}`, { cookies: jar });
    assert.equal(csv.status, 200);
    assert.deepEqual((csv.text ?? "").split("\r\n").filter(Boolean).length, 1, "en-têtes seuls");
    const json = await httpRequest("GET", `/api/export/json?segment=${seg.id}`, { cookies: jar });
    assert.equal(json.json?.count, 0);
    assert.deepEqual(json.json?.members, []);
    const badSeg = await httpRequest("GET", "/api/export?segment=nope", { cookies: jar });
    assert.equal(badSeg.status, 404);
    // Audit : dernier export tracé (format/volume).
    const logs = await db.auditLog.findMany({
      where: { action: "member.export" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    assert.equal(logs.length, 1);
    assert.ok(String(logs[0].metadata ?? "").includes('"format"'), "filtre+volume audités");
    await db.segment.delete({ where: { id: seg.id } });
  });

  test("plafond 2000 signalé ; cleanup", async () => {
    const jar = await authedJar();
    const db = getPrisma();
    const rows = Array.from({ length: 2005 }, (_, i) => ({
      firstName: "B",
      email: `${BULK}-${i}@example.com`,
      country: "BJ",
      primaryDomain: "web",
      level: "beginner",
      goal: "project",
      availability: "2-5h",
      learningStyle: "practice",
    }));
    await db.member.createMany({ data: rows });
    const csv = await httpRequest("GET", `/api/export?q=${BULK}`, { cookies: jar });
    assert.equal(csv.status, 200);
    assert.equal(csv.headers["x-export-truncated"], "1");
    assert.equal(csv.headers["x-export-total"], "2005");
    assert.equal((csv.text ?? "").split("\r\n").filter(Boolean).length - 1, 2000);
    const json = await httpRequest("GET", `/api/export/json?q=${BULK}`, { cookies: jar });
    assert.equal(json.json?.count, 2000);
    assert.equal(json.headers["x-export-truncated"], "1");
    await db.member.deleteMany({ where: { email: { startsWith: `${BULK}-` } } });
    assert.equal(await db.member.count({ where: { email: { startsWith: `${BULK}-` } } }), 0);
  });
});

// ── Doublons #103 : prévention, détection, fusion ────────────────
// Zéro coût auth (jar caché). Paires uniques par run, cleanup explicite
// (consents/qualifications sans FK + membres).

describe("Doublons — détection et fusion #103", () => {
  before(ensureServer);

  const E_A = `it-dup-a-${RUN_TOKEN}@example.com`;
  const E_B = `it-dup-b-${RUN_TOKEN}@example.com`;
  const E_C = `it-dup-c-${RUN_TOKEN}@example.com`;
  const PHONE = "+22990000111";
  const baseProfile = {
    firstName: "D",
    country: "BJ",
    primaryDomain: "web",
    level: "beginner",
    goal: "project",
    availability: "2-5h",
    learningStyle: "practice",
  };

  test("sans session → 403 (liste, fusion)", async () => {
    assert.equal((await httpRequest("GET", "/api/admin/duplicates")).status, 403);
    assert.equal(
      (
        await httpRequest("POST", "/api/admin/duplicates/merge", {
          body: { loserId: "x", winnerId: "y" },
        })
      ).status,
      403,
    );
  });

  test("index unique : doublon de casse refusé en base (P2002)", async () => {
    const db = getPrisma();
    const m = await db.member.create({
      data: { ...baseProfile, email: `It-Case-${RUN_TOKEN}@Example.COM` },
    });
    let code = null;
    try {
      await db.member.create({
        data: { ...baseProfile, email: `it-case-${RUN_TOKEN}@example.com` },
      });
    } catch (e) {
      code = e?.code ?? null;
    }
    assert.equal(code, "P2002");
    await db.member.delete({ where: { id: m.id } });
  });

  test("AMBIGU listé ; fusion sans ack → 422 ; avec ack → 200 + conservation", async () => {
    const jar = await authedJar();
    const db = getPrisma();
    const loser = await db.member.create({
      data: { ...baseProfile, email: E_A, phone: "+229 90000111", city: "Abomey" },
    });
    const winner = await db.member.create({
      data: { ...baseProfile, email: E_B, phone: PHONE },
    });
    await db.consent.create({
      data: { email: E_A, purpose: "profiling", choice: "granted", textVersion: "t-v1" },
    });

    const list = await httpRequest("GET", "/api/admin/duplicates", { cookies: jar });
    assert.equal(list.status, 200);
    const amb = (list.json?.ambiguous ?? []).find((g) =>
      g.members?.some((m) => m.email === E_A),
    );
    assert.ok(amb, "paire téléphone listée AMBIGUOUS");
    assert.equal(amb.kind, "AMBIGUOUS");

    const noAck = await httpRequest("POST", "/api/admin/duplicates/merge", {
      cookies: jar,
      body: { loserId: loser.id, winnerId: winner.id },
    });
    assert.equal(noAck.status, 422);
    assert.equal(noAck.json?.code, "NEEDS_ACK");

    const merged = await httpRequest("POST", "/api/admin/duplicates/merge", {
      cookies: jar,
      body: { loserId: loser.id, winnerId: winner.id, acknowledgeAmbiguous: true },
    });
    assert.equal(merged.status, 200);
    assert.deepEqual(merged.json?.filled?.sort(), ["city"]);
    const w = await db.member.findUnique({ where: { id: winner.id } });
    assert.equal(w?.city, "Abomey", "trou comblé, existants intacts");
    assert.equal(
      await db.member.findUnique({ where: { id: loser.id }, select: { deletedAt: true } }).then((r) => !!r?.deletedAt),
      true,
      "perdant soft-deleted",
    );
    assert.equal(
      await db.consent.count({ where: { email: E_B, purpose: "profiling" } }),
      1,
      "consentement re-clé",
    );
    const audits = await db.auditLog.findMany({
      where: { action: "member.merge" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    assert.equal(audits.length, 1);
    assert.ok(String(audits[0].metadata ?? "").includes(loser.id), "avant/après audités");

    const replay = await httpRequest("POST", "/api/admin/duplicates/merge", {
      cookies: jar,
      body: { loserId: loser.id, winnerId: winner.id, acknowledgeAmbiguous: true },
    });
    assert.equal(replay.status, 409);

    // Cleanup (lignes sans FK : explicite).
    const other = await db.member.create({
      data: { ...baseProfile, email: E_C },
    });
    const notDupes = await httpRequest("POST", "/api/admin/duplicates/merge", {
      cookies: jar,
      body: { loserId: other.id, winnerId: winner.id, acknowledgeAmbiguous: true },
    });
    assert.equal(notDupes.status, 422);
    assert.equal(notDupes.json?.code, "NOT_DUPLICATES");
    await db.consent.deleteMany({ where: { email: { in: [E_A, E_B, E_C] } } });
    await db.member.deleteMany({ where: { email: { in: [E_A, E_B, E_C] } } });
    for (const em of [E_A, E_B, E_C]) {
      assert.equal(await db.member.count({ where: { email: em } }), 0);
    }
  });
});

// ── /api/admin/logout (LAST: it kills the shared session) ───────

describe("POST /api/admin/logout", () => {
  before(ensureServer);

  test("→ 200 and revokes the session server-side", async () => {
    const jar = await authedJar();
    const logout = await httpRequest("POST", "/api/admin/logout", { cookies: jar });
    assert.equal(logout.status, 200);
    assert.equal(logout.json?.ok, true);
  });

  test("after logout, session token alone → authed: false (DB lookup)", async () => {
    const jar = await authedJar();
    await httpRequest("POST", "/api/admin/logout", { cookies: jar });
    cachedAdminJar = null;
    // Token alone (no `session_data` cookie cache): forces the DB lookup
    // that proves the session was revoked server-side.
    const tokenOnly = { "better-auth.session_token": jar["better-auth.session_token"] };
    const verify = await httpRequest("GET", "/api/admin/verify", { cookies: tokenOnly });
    assert.equal(verify.json?.authed, false, "session must be revoked server-side after logout");
  });
});

// ── Cleanup ────────────────────────────────────────────────────

after(async () => {
  console.log("\n[integration] Cleaning test data...");
  await cleanupTestData();
  console.log("[integration] Stopping dev server...");
  await stopServer();
  serverReady = false;
  console.log("[integration] Done.");
});
