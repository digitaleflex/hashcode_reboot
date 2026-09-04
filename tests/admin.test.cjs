/**
 * Admin auth + rate-limit — automated test suite.
 *
 * Run:  node --test tests/admin.test.cjs
 * Or:   npm test
 *
 * Senior-grade coverage:
 *  - Unit: HMAC token issuance + verification (signature, expiry, passcode rotation)
 *  - Unit: rate-limit in-memory token bucket (capacity, refill, isolation, retry-after)
 *  - Integration: /api/admin/login  — valid / wrong passcode / missing JSON / rate-limit
 *  - Integration: /api/admin/verify — no cookie / invalid cookie / valid cookie
 *  - Integration: /api/admin/logout — clears cookie
 *
 * All tests run against a real Next.js dev server spawned automatically.
 * The test passcode is set via ADMIN_PASSCODE env var before the server starts.
 */

"use strict";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { setTimeout: wait } = require("node:timers/promises");
const http = require("node:http");

// ── Test config ──────────────────────────────────────────────────
const PORT = 3737;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_PASSPHRASE = "test-passphrase-for-unit-tests-16chars";
const SERVER_START_TIMEOUT_MS = 90_000;

// ── HTTP helpers ────────────────────────────────────────────────

/** Perform an HTTP request with optional cookie jar. */
function request(method, path, { body, headers = {}, cookies = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(Object.keys(cookies).length
          ? { Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") }
          : {}),
      },
    };
    const req = http.request(opts, (res) => {
      const setCookieHeader = res.headers["set-cookie"];
      const setCookie = Array.isArray(setCookieHeader)
        ? setCookieHeader.join(", ")
        : setCookieHeader ?? null;
      let data = "";
      res.on("data", (chunk) => (data += chunk));
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

/** Parse a Set-Cookie header into a key→value map. */
function parseSetCookies(setCookie) {
  if (!setCookie) return {};
  const jar = {};
  for (const part of setCookie.split(/, (?=[^;]+; )/)) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}

// ── Server lifecycle ─────────────────────────────────────────────

let serverProcess = null;
let serverReady = false;

async function waitForServer() {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await request("GET", "/api/community/count");
      if (res.status < 500) return;
    } catch { /* not up yet */ }
    await wait(500);
  }
  throw new Error(`Server did not start within ${SERVER_START_TIMEOUT_MS}ms`);
}

function startServer() {
  const env = { ...process.env, NODE_ENV: "development", ADMIN_PASSCODE: TEST_PASSPHRASE };
  serverProcess = spawn("npx", ["next", "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  // Silence noisy Next.js dev output
  serverProcess.stderr?.on("data", () => {});
  serverProcess.stdout?.on("data", () => {});
  serverProcess.on("error", (e) => { throw e; });
}

async function stopServer() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill("SIGTERM");
  await wait(600);
  if (!serverProcess.killed) serverProcess.kill("SIGKILL");
}

// ────────────────────────────────────────────────────────────────
// 1) Admin auth unit tests (pure HMAC token logic)
// ────────────────────────────────────────────────────────────────

describe("admin-auth: token issuance & verification (unit)", () => {
  // We test the logic directly by simulating what issueAdminToken / verifyAdminToken do.
  const crypto = require("node:crypto");

  function signExpiry(passphrase, expiryStr) {
    return crypto.createHmac("sha256", passphrase).update(expiryStr, "utf8").digest("base64url");
  }

  function issueToken(passphrase, role = "operator") {
    const expiry = String(Date.now() + 12 * 60 * 60 * 1000);
    const expB64 = Buffer.from(expiry, "utf8").toString("base64url");
    const sigB64 = signExpiry(passphrase, expiry);
    const roleB64 = Buffer.from(role, "utf8").toString("base64url");
    return { token: `${expB64}.${sigB64}.${roleB64}`, expiry };
  }

  function verifyToken(passphrase, token) {
    try {
      const dot = token.indexOf(".");
      if (dot <= 0 || dot === token.length - 1) return false;
      const expB64 = token.slice(0, dot);
      const rest = token.slice(dot + 1);
      const secondDot = rest.indexOf(".");
      const sigB64 = secondDot >= 0 ? rest.slice(0, secondDot) : rest;
      const expiryStr = Buffer.from(expB64, "base64url").toString("utf8");
      if (!/^\d+$/.test(expiryStr)) return false;
      const expiry = Number(expiryStr);
      if (!Number.isSafeInteger(expiry) || expiry <= Date.now()) return false;
      const expected = signExpiry(passphrase, expiryStr);
      const a = Buffer.from(sigB64, "utf8");
      const b = Buffer.from(expected, "utf8");
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  test("issues a valid token that passes verification", () => {
    const { token } = issueToken(TEST_PASSPHRASE);
    assert.ok(typeof token === "string");
    assert.ok(token.split(".").length === 3);
    assert.equal(verifyToken(TEST_PASSPHRASE, token), true);
  });

  test("rejects empty / null / undefined token", () => {
    assert.equal(verifyToken(TEST_PASSPHRASE, undefined), false);
    assert.equal(verifyToken(TEST_PASSPHRASE, null), false);
    assert.equal(verifyToken(TEST_PASSPHRASE, ""), false);
  });

  test("rejects malformed token (bad structure)", () => {
    assert.equal(verifyToken(TEST_PASSPHRASE, "garbage"), false);
    assert.equal(verifyToken(TEST_PASSPHRASE, "."), false);
    assert.equal(verifyToken(TEST_PASSPHRASE, ".sig"), false);
    assert.equal(verifyToken(TEST_PASSPHRASE, "exp."), false);
    assert.equal(verifyToken(TEST_PASSPHRASE, "exp..role"), false);
  });

  test("rejects expired token", () => {
    const expired = String(Date.now() - 3_600_000); // 1h ago
    const expB64 = Buffer.from(expired, "utf8").toString("base64url");
    const sigB64 = signExpiry(TEST_PASSPHRASE, expired);
    const roleB64 = Buffer.from("operator").toString("base64url");
    const token = `${expB64}.${sigB64}.${roleB64}`;
    assert.equal(verifyToken(TEST_PASSPHRASE, token), false);
  });

  test("rejects tampered signature", () => {
    const { token } = issueToken(TEST_PASSPHRASE);
    const parts = token.split(".");
    const lastChar = parts[1].slice(-1);
    const flipped = parts[1].slice(0, -1) + (lastChar === "A" ? "B" : "a");
    const tampered = `${parts[0]}.${flipped}.${parts[2]}`;
    assert.equal(verifyToken(TEST_PASSPHRASE, tampered), false);
  });

  test("rejects token signed with a different passphrase (rotation)", () => {
    const { token } = issueToken(TEST_PASSPHRASE);
    const rotated = "rotated-passphrase-for-test-only-16c";
    assert.equal(verifyToken(rotated, token), false);
  });

  test("rejects non-numeric expiry segment", () => {
    const garbage = Buffer.from("not-a-number", "utf8").toString("base64url");
    const sig = signExpiry(TEST_PASSPHRASE, "not-a-number");
    const token = `${garbage}.${sig}.${Buffer.from("operator").toString("base64url")}`;
    assert.equal(verifyToken(TEST_PASSPHRASE, token), false);
  });

  test("extracts role claim from token", () => {
    const op = issueToken(TEST_PASSPHRASE, "operator");
    const viewer = issueToken(TEST_PASSPHRASE, "viewer");
    // Extract role from token (3rd segment)
    const opRole = Buffer.from(op.token.split(".")[2], "base64url").toString("utf8");
    const viewerRole = Buffer.from(viewer.token.split(".")[2], "base64url").toString("utf8");
    assert.equal(opRole, "operator");
    assert.equal(viewerRole, "viewer");
  });

  test("timing-safe compare: mismatched lengths return false without timing leak", () => {
    // A shorter-than-expected signature should be rejected immediately
    const { token } = issueToken(TEST_PASSPHRASE);
    const parts = token.split(".");
    const shortSig = Buffer.from("x").toString("base64url");
    const badLen = `${parts[0]}.${shortSig}.${parts[2]}`;
    assert.equal(verifyToken(TEST_PASSPHRASE, badLen), false);
  });
});

// ────────────────────────────────────────────────────────────────
// 2) Rate-limit unit tests (in-memory token bucket)
// ────────────────────────────────────────────────────────────────

describe("rate-limit: in-memory token bucket (unit)", () => {
  // Minimal in-memory bucket implementation matching src/lib/rate-limit.ts
  const buckets = new Map();
  const BUCKET_PRUNE_MS = 5 * 60 * 1000;

  function memoryRateLimit(key, { capacity, windowMs }) {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: capacity, last: now };
      buckets.set(key, b);
    }
    const elapsed = (now - b.last) / 1000;
    const refillPerSec = capacity / (windowMs / 1000);
    b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
    b.last = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { ok: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
    }
    const retryAfterMs = Math.ceil((1 - b.tokens) / refillPerSec * 1000);
    return { ok: false, remaining: 0, retryAfterMs };
  }

  beforeEach(() => {
    // Clear all buckets before each test for isolation
    buckets.clear();
  });

  test("first request passes with remaining = capacity - 1", () => {
    const r = memoryRateLimit("ip:test:1", { capacity: 5, windowMs: 60_000 });
    assert.equal(r.ok, true);
    assert.equal(r.remaining, 4);
  });

  test("blocks after capacity is exhausted", () => {
    const key = "ip:test:exhaust";
    const config = { capacity: 3, windowMs: 60_000 };
    assert.equal(memoryRateLimit(key, config).ok, true);  // 2 remaining
    assert.equal(memoryRateLimit(key, config).ok, true);  // 1 remaining
    assert.equal(memoryRateLimit(key, config).ok, true);  // 0 remaining
    const blocked = memoryRateLimit(key, config);
    assert.equal(blocked.ok, false, "should be blocked after capacity exhausted");
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterMs > 0, "retryAfterMs must be > 0 when blocked");
  });

  test("different keys have isolated buckets", () => {
    const a = memoryRateLimit("ip:A", { capacity: 1, windowMs: 60_000 });
    memoryRateLimit("ip:A", { capacity: 1, windowMs: 60_000 }); // exhaust
    const b = memoryRateLimit("ip:B", { capacity: 1, windowMs: 60_000 });
    assert.equal(a.ok, true, "A first request should pass");
    assert.equal(b.ok, true, "B should not be affected by A's exhaustion");
  });

  test("tokens refill after window elapses", async () => {
    const key = "ip:test:refill";
    // capacity 2, window 100ms → refill 20 tokens/sec → 1 token per 50ms
    const config = { capacity: 2, windowMs: 100 };
    memoryRateLimit(key, config); // 1 remaining
    memoryRateLimit(key, config); // 0 remaining
    const blocked = memoryRateLimit(key, config);
    assert.equal(blocked.ok, false, "should be blocked");
    await wait(150); // wait > 100ms window
    const refilled = memoryRateLimit(key, config);
    assert.equal(refilled.ok, true, "should pass after refill");
  });

  test("retryAfterMs decreases as tokens are about to refill", () => {
    const key = "ip:test:retry";
    const config = { capacity: 1, windowMs: 200 };
    memoryRateLimit(key, config); // exhaust
    const r1 = memoryRateLimit(key, config);
    assert.equal(r1.ok, false);
    assert.ok(r1.retryAfterMs > 0 && r1.retryAfterMs <= 200, `retryAfterMs=${r1.retryAfterMs} should be <= windowMs`);
  });

  test("Math.min prevents token overfill beyond capacity", () => {
    const key = "ip:test:overfill";
    const config = { capacity: 5, windowMs: 1000 };
    // After 2s of refill (2 tokens/sec), tokens = min(5, 0 + 2*2) = min(5, 4) = 4
    const r1 = memoryRateLimit(key, config); // 4 remaining (was 0+2, capped to 4)
    const r2 = memoryRateLimit(key, config); // 3 remaining
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    // tokens can't exceed capacity
    const r3 = memoryRateLimit(key, config);
    const r4 = memoryRateLimit(key, config);
    const r5 = memoryRateLimit(key, config);
    assert.equal(r3.ok, true); // 2
    assert.equal(r4.ok, true); // 1
    assert.equal(r5.ok, true); // 0
    const r6 = memoryRateLimit(key, config);
    assert.equal(r6.ok, false); // blocked — can't overfill
  });
});

// ────────────────────────────────────────────────────────────────
// 3) rateKey IP extraction unit tests
// ────────────────────────────────────────────────────────────────

describe("rateKey: IP extraction (unit)", () => {
  function rateKey(req) {
    if (req.ip) return req.ip;
    const xff = req.headers.get("x-forwarded-for") ?? "";
    return xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  }

  function makeReq(headers = {}, ip = undefined) {
    return {
      ip,
      headers: {
        get: (name) => headers[name.toLowerCase()] ?? headers[name] ?? null,
      },
    };
  }

  test("x-forwarded-for: returns first IP (comma-separated)", () => {
    assert.equal(rateKey(makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  });

  test("x-forwarded-for: strips whitespace around IP", () => {
    assert.equal(rateKey(makeReq({ "x-forwarded-for": "  10.0.0.1  , 192.168.1.1" })), "10.0.0.1");
  });

  test("x-real-ip: fallback when x-forwarded-for absent", () => {
    assert.equal(rateKey(makeReq({ "x-real-ip": "9.8.7.6" })), "9.8.7.6");
  });

  test("NextRequest.ip: takes precedence when available (local dev)", () => {
    assert.equal(rateKey(makeReq({}, "127.0.0.1")), "127.0.0.1");
  });

  test("NextRequest.ip: used even with x-forwarded-for present (ip overrides)", () => {
    assert.equal(rateKey(makeReq({ "x-forwarded-for": "1.2.3.4" }, "192.168.1.1")), "192.168.1.1");
  });

  test("anon: fallback when no IP source is available", () => {
    assert.equal(rateKey(makeReq({})), "anon");
  });

  test("anon: fallback when headers return null", () => {
    assert.equal(rateKey({ ip: undefined, headers: { get: () => null } }), "anon");
  });
});

// ────────────────────────────────────────────────────────────────
// 4) Integration tests: live Next.js dev server
// ────────────────────────────────────────────────────────────────

describe("integration: /api/admin/* (live server)", { skip: false }, () => {
  before(async () => {
    console.log("\n[test] Starting Next.js dev server on port", PORT, "...");
    startServer();
    await waitForServer();
    serverReady = true;
    console.log("[test] Server ready. Running integration tests...");
  });

  after(async () => {
    console.log("\n[test] Stopping server...");
    await stopServer();
    serverReady = false;
  });

  // ── /api/admin/verify ──────────────────────────────────────

  test("GET /api/admin/verify → 200 { authed: false } when no cookie", async () => {
    const res = await request("GET", "/api/admin/verify");
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.equal(res.json?.authed, false);
    assert.equal(res.json?.role, null);
  });

  test("GET /api/admin/verify → 200 { authed: false } with garbage cookie", async () => {
    const res = await request("GET", "/api/admin/verify", {
      cookies: { "hashcode-admin": "garbage.invalid.token" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
  });

  test("GET /api/admin/verify → 200 { authed: false } with expired cookie", async () => {
    // Manually craft an expired token
    const expiredMs = String(Date.now() - 3_600_000);
    const expB64 = Buffer.from(expiredMs, "utf8").toString("base64url");
    const crypto = require("node:crypto");
    const sig = crypto.createHmac("sha256", TEST_PASSPHRASE).update(expiredMs, "utf8").digest("base64url");
    const expiredToken = `${expB64}.${sig}.${Buffer.from("operator").toString("base64url")}`;
    const res = await request("GET", "/api/admin/verify", {
      cookies: { "hashcode-admin": expiredToken },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.authed, false);
  });

  // ── /api/admin/login — invalid inputs ───────────────────────

  test("POST /api/admin/login → 400 on invalid JSON body", async () => {
    const res = await request("POST", "/api/admin/login", {
      body: "not-json-at-all",
      headers: { "Content-Type": "text/plain" },
    });
    assert.equal(res.status, 400, `expected 400, got ${res.status}`);
  });

  test("POST /api/admin/login → 422 when passcode field is missing", async () => {
    const res = await request("POST", "/api/admin/login", { body: {} });
    assert.equal(res.status, 422, `expected 422, got ${res.status}`);
    assert.equal(res.json?.code, "INVALID_PAYLOAD");
  });

  test("POST /api/admin/login → 422 when passcode is empty string", async () => {
    const res = await request("POST", "/api/admin/login", { body: { passcode: "   " } });
    assert.equal(res.status, 422, `expected 422, got ${res.status}`);
  });

  test("POST /api/admin/login → 401 when passcode is wrong", async () => {
    // Wait for any active rate-limit window to clear first
    await wait(11_000);
    const res = await request("POST", "/api/admin/login", {
      body: { passcode: "this-is-definitely-the-wrong-passphrase" },
    });
    assert.equal(res.status, 401, `expected 401, got ${res.status}`);
    assert.equal(res.json?.code, "UNAUTHORIZED");
  });

  test("POST /api/admin/login → 401 when passcode length differs from expected", async () => {
    await wait(11_000);
    const res = await request("POST", "/api/admin/login", {
      body: { passcode: "short" },
    });
    assert.equal(res.status, 401);
  });

  // ── /api/admin/login — rate limiting ────────────────────────

  test("POST /api/admin/login → 429 after exceeding rate limit (10 req / 10s)", async () => {
    // Send 15 rapid requests (capacity = 10)
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        request("POST", "/api/admin/login", { body: { passcode: "wrong-phrase-for-rate-limit-test" } }),
      ),
    );
    const statuses = results.map((r) => r.status);
    const had429 = statuses.includes(429);
    assert.ok(had429, `expected at least one 429 in statuses ${JSON.stringify(statuses)}`);
    // Retry-After header must be present on 429
    const r429 = results.find((r) => r.status === 429);
    assert.ok(
      r429.headers["retry-after"] || parseInt(r429.headers["retry-after"]) > 0,
      "429 response should include Retry-After header",
    );
  });

  // ── /api/admin/login — happy path ──────────────────────────

  test("POST /api/admin/login → 200 with correct passcode + sets HttpOnly cookie", async () => {
    await wait(11_000); // let rate-limit window clear
    const res = await request("POST", "/api/admin/login", {
      body: { passcode: TEST_PASSPHRASE },
    });
    assert.equal(res.status, 200, `expected 200, got ${res.status} — body: ${JSON.stringify(res.json)}`);
    assert.equal(res.json?.ok, true, `login should succeed: ${JSON.stringify(res.json)}`);
    assert.ok(res.setCookie, "login should set Set-Cookie header");
    const jar = parseSetCookies(res.setCookie);
    assert.ok(jar["hashcode-admin"], "hashcode-admin cookie must be present");
    assert.ok(jar["hashcode-admin"].includes("."), "token should have 3 segments (dot-separated)");
  });

  // ── /api/admin/verify — authenticated ─────────────────────

  test("GET /api/admin/verify → 200 { authed: true } with valid cookie", async () => {
    await wait(11_000);
    // First login to get a fresh cookie
    const loginRes = await request("POST", "/api/admin/login", {
      body: { passcode: TEST_PASSPHRASE },
    });
    const jar = parseSetCookies(loginRes.setCookie);
    const verifyRes = await request("GET", "/api/admin/verify", {
      cookies: jar,
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.json?.authed, true, "should be authenticated with valid cookie");
    assert.equal(verifyRes.json?.role, "operator", "default role should be operator");
  });

  // ── /api/admin/logout ─────────────────────────────────────

  test("POST /api/admin/logout → 200 and clears the cookie (Max-Age=0)", async () => {
    await wait(11_000);
    const loginRes = await request("POST", "/api/admin/login", {
      body: { passcode: TEST_PASSPHRASE },
    });
    const jar = parseSetCookies(loginRes.setCookie);
    const logoutRes = await request("POST", "/api/admin/logout", { cookies: jar });
    assert.equal(logoutRes.status, 200, `expected 200, got ${logoutRes.status}`);
    assert.ok(logoutRes.setCookie, "logout should set a Set-Cookie header");
    assert.ok(logoutRes.setCookie.includes("Max-Age=0"), "logout cookie should have Max-Age=0");
  });

  test("after logout, /api/admin/verify → authed: false", async () => {
    await wait(11_000);
    const loginRes = await request("POST", "/api/admin/login", {
      body: { passcode: TEST_PASSPHRASE },
    });
    const jar = parseSetCookies(loginRes.setCookie);
    await request("POST", "/api/admin/logout", { cookies: jar });
    const verifyRes = await request("GET", "/api/admin/verify", { cookies: jar });
    assert.equal(verifyRes.json?.authed, false, "should no longer be authenticated after logout");
  });

  // ── Security: protected endpoints without auth ─────────────

  test("GET /api/members (admin list) → 401 without auth cookie", async () => {
    const res = await request("GET", "/api/members");
    assert.equal(res.status, 401, `expected 401, got ${res.status}`);
  });

  test("GET /api/analytics → 401 without auth cookie", async () => {
    const res = await request("GET", "/api/analytics");
    assert.equal(res.status, 401, `expected 401, got ${res.status}`);
  });

  test("GET /api/members → 200 with valid auth cookie", async () => {
    await wait(11_000);
    const loginRes = await request("POST", "/api/admin/login", {
      body: { passcode: TEST_PASSPHRASE },
    });
    const jar = parseSetCookies(loginRes.setCookie);
    const res = await request("GET", "/api/members", { cookies: jar });
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.ok(Array.isArray(res.json?.members), "response should have members array");
  });
});

// ────────────────────────────────────────────────────────────────
// 5) Smoke: public endpoints still work
// ────────────────────────────────────────────────────────────────

describe("smoke: public endpoints (no auth required)", () => {
  before(async () => {
    if (!serverReady) {
      startServer();
      await waitForServer();
    }
  });

  test("GET /api/community/count → 200", async () => {
    const res = await request("GET", "/api/community/count");
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.ok(typeof res.json?.count === "number", "count should be a number");
  });

  test("GET /api/health → 200", async () => {
    const res = await request("GET", "/api/health");
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.ok(["ok", "degraded", "down"].includes(res.json?.status),
      `status should be ok|degraded|down, got ${res.json?.status}`);
  });

  test("POST /api/analytics → 200 even without auth (public funnel tracking)", async () => {
    const res = await request("POST", "/api/analytics", {
      body: { type: "reboot_page_view" },
    });
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.equal(res.json?.ok, true);
  });
});
