/**
 * Integration tests — admin auth API + protected endpoints.
 * Runs against a real Next.js dev server spawned automatically.
 *
 * Run:  node --test tests/integration.test.cjs
 *
 * ⚠️  SAFETY: These tests spawn a dev server that connects to DATABASE_URL.
 *     If DATABASE_URL points to production, WRITE tests (POST) will pollute it.
 *     All WRITE tests below are intentionally READ-ONLY or sandboxed:
 *       - POST /api/admin/login  → only creates rate-limit state (in-memory)
 *       - POST /api/admin/logout → only clears a cookie
 *       - POST /api/analytics    → REMOVED (would pollute production analytics)
 *       - POST /api/events       → REMOVED (would pollute production events)
 *       - POST /api/members      → REMOVED (would pollute production members)
 *     Only GET/verify/logout tests remain. For write-path testing, use a
 *     dedicated test database (set TESTING_DATABASE_URL in .env.test).
 *
 * Requires: Next.js dev server starts on port 3737 with ADMIN_PASSCODE set.
 * Server lifecycle is managed automatically (before/after hooks).
 *
 * Coverage:
 *  - /api/admin/login    — valid / wrong / missing / invalid JSON / rate-limit
 *  - /api/admin/verify   — no cookie / invalid / expired / valid
 *  - /api/admin/logout   — clears cookie
 *  - Protected endpoints — require auth, return 401 without cookie
 *  - Public endpoints    — work without auth (GET only)
 *  - /api/events/notify-count — auth + domain filter + invalid domain
 *  - /api/admin/audit-log     — auth + CSV format
 *  - /api/admin/activity      — auth + limit param
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
const TEST_PASSPHRASE = "test-integration-passphrase-16c";
const SERVER_START_TIMEOUT_MS = 90_000;

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
      const rawSetCookie = res.headers["set-cookie"];
      const setCookie = Array.isArray(rawSetCookie) ? rawSetCookie.join(", ") : rawSetCookie ?? null;
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, json, setCookie });
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

function parseSetCookies(header) {
  if (!header) return {};
  const jar = {};
  for (const part of header.split(/, (?=[^;]+; )/)) {
    const [pair] = part.split(";");
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
  const env = { ...process.env, NODE_ENV: "development", ADMIN_PASSCODE: TEST_PASSPHRASE };
  const nextCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  server = spawn(process.execPath, [nextCli, "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    env, stdio: ["ignore", "pipe", "pipe"], detached: false,
  });
  server.stderr?.on("data", () => {});
  server.stdout?.on("data", () => {});
  server.on("error", e => { throw e; });
}

async function stopServer() {
  if (!server || server.killed) return;
  server.kill("SIGTERM");
  await wait(800);
  if (!server.killed) server.kill("SIGKILL");
}

// ── /api/admin/verify ──────────────────────────────────────────

describe("GET /api/admin/verify", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("→ 200 { authed: false } with no cookie", async () => {
    const res = await httpRequest("GET", "/api/admin/verify");
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
    assert.equal(res.json?.role, null);
  });

  test("→ 200 { authed: false } with garbage cookie", async () => {
    const res = await httpRequest("GET", "/api/admin/verify", { cookies: { "hashcode-admin": "garbage.invalid.token" } });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
  });

  test("→ 200 { authed: false } with expired cookie", async () => {
    const crypto = require("node:crypto");
    const expiredMs = String(Date.now() - 3_600_000);
    const expB64 = Buffer.from(expiredMs, "utf8").toString("base64url");
    const sig = crypto.createHmac("sha256", TEST_PASSPHRASE).update(expiredMs, "utf8").digest("base64url");
    const expired = `${expB64}.${sig}.${Buffer.from("operator").toString("base64url")}`;
    const res = await httpRequest("GET", "/api/admin/verify", { cookies: { "hashcode-admin": expired } });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
  });

  test("→ 200 { authed: true, role: operator } with valid cookie", async () => {
    await wait(11_000); // rate-limit cooldown
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    assert.equal(login.status, 200, `login failed: ${JSON.stringify(login.json)}`);
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/admin/verify", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, true);
    assert.equal(res.json?.role, "operator");
  });
});

// ── /api/admin/login ───────────────────────────────────────────

describe("POST /api/admin/login", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("→ 400 on invalid JSON body", async () => {
    const res = await httpRequest("POST", "/api/admin/login", {
      body: "not-json", headers: { "Content-Type": "text/plain" },
    });
    assert.equal(res.status, 400);
  });

  test("→ 422 when passcode is missing", async () => {
    const res = await httpRequest("POST", "/api/admin/login", { body: {} });
    assert.equal(res.status, 422);
    assert.equal(res.json?.code, "INVALID_PAYLOAD");
  });

  test("→ 422 when passcode is empty", async () => {
    const res = await httpRequest("POST", "/api/admin/login", { body: { passcode: "   " } });
    assert.equal(res.status, 422);
  });

  test("→ 401 when passcode is wrong (length differs)", async () => {
    await wait(11_000);
    const res = await httpRequest("POST", "/api/admin/login", { body: { passcode: "short" } });
    assert.equal(res.status, 401);
  });

  test("→ 401 when passcode is wrong (different content)", async () => {
    await wait(11_000);
    const res = await httpRequest("POST", "/api/admin/login", {
      body: { passcode: "completely-different-passphrase-16c" },
    });
    assert.equal(res.status, 401);
    assert.equal(res.json?.code, "UNAUTHORIZED");
  });

  test("→ 429 after 15 rapid wrong attempts (capacity: 10/10s)", async () => {
    await wait(11_000); // ensure rate-limit bucket is full
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        httpRequest("POST", "/api/admin/login", { body: { passcode: "wrong-phrase-for-test" } }),
      ),
    );
    const statuses = results.map(r => r.status);
    assert.ok(statuses.includes(429), `expected at least one 429 in ${JSON.stringify(statuses)}`);
    const r429 = results.find(r => r.status === 429);
    assert.ok(
      r429.headers["retry-after"] || parseInt(r429.headers["retry-after"]) >= 0,
      "429 must include Retry-After header",
    );
  });

  test("→ 200 with correct passcode, sets HttpOnly cookie", async () => {
    await wait(11_000);
    const res = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.json)}`);
    assert.equal(res.json?.ok, true);
    assert.ok(res.setCookie, "must set Set-Cookie header");
    const jar = parseSetCookies(res.setCookie);
    assert.ok(jar["hashcode-admin"], "hashcode-admin cookie must be present");
    assert.ok(jar["hashcode-admin"].includes("."), "token should be dot-separated");
  });
});

// ── /api/admin/logout ──────────────────────────────────────────

describe("POST /api/admin/logout", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("→ 200 and clears cookie (Max-Age=0)", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const logout = await httpRequest("POST", "/api/admin/logout", { cookies: jar });
    assert.equal(logout.status, 200);
    assert.ok(logout.setCookie?.includes("Max-Age=0"), "must set Max-Age=0 to clear cookie");
  });

  test("after logout, /api/admin/verify → authed: false", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const logout = await httpRequest("POST", "/api/admin/logout", { cookies: jar });
    const clearedJar = parseSetCookies(logout.setCookie);
    const verify = await httpRequest("GET", "/api/admin/verify", { cookies: clearedJar });
    assert.equal(verify.json?.authed, false, "must not be authed after logout");
  });
});

// ── Protected endpoints ─────────────────────────────────────────

describe("protected endpoints require auth", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("GET /api/members → 401 without cookie", async () => {
    const res = await httpRequest("GET", "/api/members");
    assert.equal(res.status, 401);
  });

  test("GET /api/analytics → 401 without cookie", async () => {
    const res = await httpRequest("GET", "/api/analytics");
    assert.equal(res.status, 401);
  });

  test("GET /api/members → 200 with valid cookie", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/members", { cookies: jar });
    assert.equal(res.status, 200, `got ${res.status}: ${JSON.stringify(res.json)}`);
    assert.ok(Array.isArray(res.json?.members));
  });
});

// ── Public endpoints ────────────────────────────────────────────

describe("public endpoints work without auth", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

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
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("→ 401 without cookie", async () => {
    const res = await httpRequest("GET", "/api/events/notify-count");
    assert.equal(res.status, 401);
  });

  test("→ 200 with auth, returns count + domain/level", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/events/notify-count", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(typeof res.json?.count, "number");
    assert.equal(res.json?.domain, null);
    assert.equal(res.json?.level, null);
  });

  test("→ 200 with domain filter", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/events/notify-count?domain=web", { cookies: jar });
    assert.equal(res.status, 200);
    assert.equal(res.json?.domain, "web");
    assert.equal(typeof res.json?.count, "number");
  });

  test("→ 422 with invalid domain", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/events/notify-count?domain=invalid", { cookies: jar });
    assert.equal(res.status, 422);
  });
});

// ── POST /api/account/phone ──────────────────────────────────────

describe("POST /api/account/phone — middleware auth + validation", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("→ 401 without session cookie (middleware blocks /api/account/*)", async () => {
    const res = await httpRequest("POST", "/api/account/phone", {
      body: { memberId: "test", phone: "+22991000000" },
    });
    assert.equal(res.status, 401);
  });
});

// ── GET /api/admin/audit-log ─────────────────────────────────────

describe("GET /api/admin/audit-log — auth + format", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("→ 403 without cookie (requireAdminRole returns false)", async () => {
    const res = await httpRequest("GET", "/api/admin/audit-log");
    assert.equal(res.status, 403);
  });

  test("→ 200 with auth, returns logs array", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/admin/audit-log", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json?.logs));
    assert.equal(typeof res.json?.total, "number");
  });

  test("→ 200 with ?format=csv, returns CSV content", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/admin/audit-log?format=csv", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"]?.includes("text/csv"));
  });
});

// ── GET /api/admin/activity ──────────────────────────────────────

describe("GET /api/admin/activity — auth + format", () => {
  before(async () => {
    if (!serverReady) { startServer(); await waitForServer(); serverReady = true; }
  });

  test("→ 403 without cookie (requireAdminRole returns false)", async () => {
    const res = await httpRequest("GET", "/api/admin/activity");
    assert.equal(res.status, 403);
  });

  test("→ 200 with auth, returns events array", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/admin/activity", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json?.events));
  });

  test("→ 200 with ?limit=5, respects limit", async () => {
    await wait(11_000);
    const login = await httpRequest("POST", "/api/admin/login", { body: { passcode: TEST_PASSPHRASE } });
    const jar = parseSetCookies(login.setCookie);
    const res = await httpRequest("GET", "/api/admin/activity?limit=5", { cookies: jar });
    assert.equal(res.status, 200);
    assert.ok(res.json.events.length <= 5);
  });
});

// NOTE: POST /api/events intentionally omitted — it creates events in the
// production database. Use unit tests or a dedicated test DB for write-path.

// ── Cleanup ────────────────────────────────────────────────────

after(async () => {
  console.log("\n[integration] Stopping dev server...");
  await stopServer();
  serverReady = false;
  console.log("[integration] Done.");
});
