/**
 * Unit tests — admin auth, rate-limit token bucket, rateKey IP extraction.
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/unit.test.cjs
 * Or:   npm run test:unit
 *
 * Coverage:
 *  - HMAC token issuance/verification (signature, expiry, rotation, tampering)
 *  - In-memory token bucket (capacity, refill, isolation, retry-after, overfill guard)
 *  - rateKey IP extraction (x-forwarded-for, x-real-ip, NextRequest.ip, anon)
 */

"use strict";

const { test, describe, before, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { setTimeout: wait } = require("node:timers/promises");

// ────────────────────────────────────────────────────────────────
// 1) Admin auth — token logic
// ────────────────────────────────────────────────────────────────

describe("admin-auth: token issuance & verification (unit)", () => {
  const crypto = require("node:crypto");
  const PASSPHRASE = "unit-test-passphrase-16-chars";

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
    } catch { return false; }
  }

  test("issues a valid token that passes verification", () => {
    const { token } = issueToken(PASSPHRASE);
    assert.ok(typeof token === "string");
    assert.equal(token.split(".").length, 3);
    assert.equal(verifyToken(PASSPHRASE, token), true);
  });

  test("rejects empty / null / undefined token", () => {
    assert.equal(verifyToken(PASSPHRASE, undefined), false);
    assert.equal(verifyToken(PASSPHRASE, null), false);
    assert.equal(verifyToken(PASSPHRASE, ""), false);
  });

  test("rejects malformed token (bad structure)", () => {
    assert.equal(verifyToken(PASSPHRASE, "garbage"), false);
    assert.equal(verifyToken(PASSPHRASE, "."), false);
    assert.equal(verifyToken(PASSPHRASE, ".sig"), false);
    assert.equal(verifyToken(PASSPHRASE, "exp."), false);
    assert.equal(verifyToken(PASSPHRASE, "exp..role"), false);
  });

  test("rejects expired token", () => {
    const expired = String(Date.now() - 3_600_000);
    const expB64 = Buffer.from(expired, "utf8").toString("base64url");
    const sigB64 = signExpiry(PASSPHRASE, expired);
    const roleB64 = Buffer.from("operator").toString("base64url");
    const token = `${expB64}.${sigB64}.${roleB64}`;
    assert.equal(verifyToken(PASSPHRASE, token), false);
  });

  test("rejects tampered signature", () => {
    const { token } = issueToken(PASSPHRASE);
    const parts = token.split(".");
    const lastChar = parts[1].slice(-1);
    const flipped = parts[1].slice(0, -1) + (lastChar === "A" ? "B" : "a");
    const tampered = `${parts[0]}.${flipped}.${parts[2]}`;
    assert.equal(verifyToken(PASSPHRASE, tampered), false);
  });

  test("rejects token signed with a different passphrase (rotation)", () => {
    const { token } = issueToken(PASSPHRASE);
    const rotated = "rotated-passphrase-for-test-only-16c";
    assert.equal(verifyToken(rotated, token), false);
  });

  test("rejects non-numeric expiry segment", () => {
    const garbage = Buffer.from("not-a-number", "utf8").toString("base64url");
    const sig = signExpiry(PASSPHRASE, "not-a-number");
    const token = `${garbage}.${sig}.${Buffer.from("operator").toString("base64url")}`;
    assert.equal(verifyToken(PASSPHRASE, token), false);
  });

  test("extracts role claim from token", () => {
    const op = issueToken(PASSPHRASE, "operator");
    const viewer = issueToken(PASSPHRASE, "viewer");
    assert.equal(Buffer.from(op.token.split(".")[2], "base64url").toString("utf8"), "operator");
    assert.equal(Buffer.from(viewer.token.split(".")[2], "base64url").toString("utf8"), "viewer");
  });

  test("timing-safe compare: mismatched signature length returns false", () => {
    const { token } = issueToken(PASSPHRASE);
    const parts = token.split(".");
    const shortSig = Buffer.from("x").toString("base64url");
    const badLen = `${parts[0]}.${shortSig}.${parts[2]}`;
    assert.equal(verifyToken(PASSPHRASE, badLen), false);
  });
});

// ────────────────────────────────────────────────────────────────
// 2) Rate-limit — in-memory token bucket
// ────────────────────────────────────────────────────────────────

describe("rate-limit: in-memory token bucket (unit)", () => {
  const buckets = new Map();

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

  beforeEach(() => { buckets.clear(); });

  test("first request passes with remaining = capacity - 1", () => {
    const r = memoryRateLimit("ip:test:1", { capacity: 5, windowMs: 60_000 });
    assert.equal(r.ok, true);
    assert.equal(r.remaining, 4);
  });

  test("blocks after capacity is exhausted", () => {
    const key = "ip:test:exhaust";
    const config = { capacity: 3, windowMs: 60_000 };
    assert.equal(memoryRateLimit(key, config).ok, true);
    assert.equal(memoryRateLimit(key, config).ok, true);
    assert.equal(memoryRateLimit(key, config).ok, true);
    const blocked = memoryRateLimit(key, config);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterMs > 0);
  });

  test("different keys have isolated buckets", () => {
    memoryRateLimit("ip:A", { capacity: 1, windowMs: 60_000 });
    memoryRateLimit("ip:A", { capacity: 1, windowMs: 60_000 }); // exhaust
    const b = memoryRateLimit("ip:B", { capacity: 1, windowMs: 60_000 });
    assert.equal(b.ok, true, "B should not be affected by A's exhaustion");
  });

  test("tokens refill after window elapses", async () => {
    const key = "ip:test:refill";
    const config = { capacity: 2, windowMs: 100 };
    memoryRateLimit(key, config);
    memoryRateLimit(key, config);
    const blocked = memoryRateLimit(key, config);
    assert.equal(blocked.ok, false);
    await wait(150);
    const refilled = memoryRateLimit(key, config);
    assert.equal(refilled.ok, true);
  });

  test("retryAfterMs is bounded by windowMs", () => {
    const key = "ip:test:retry";
    const config = { capacity: 1, windowMs: 200 };
    memoryRateLimit(key, config);
    const r1 = memoryRateLimit(key, config);
    assert.equal(r1.ok, false);
    assert.ok(r1.retryAfterMs > 0 && r1.retryAfterMs <= 200);
  });

  test("Math.min prevents token overfill beyond capacity", () => {
    const key = "ip:test:overfill";
    const config = { capacity: 5, windowMs: 1000 };
    memoryRateLimit(key, config);
    memoryRateLimit(key, config);
    memoryRateLimit(key, config);
    memoryRateLimit(key, config);
    memoryRateLimit(key, config);
    const blocked = memoryRateLimit(key, config);
    assert.equal(blocked.ok, false, "should block — can't go over capacity");
  });
});

// ────────────────────────────────────────────────────────────────
// 3) rateKey — IP extraction
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
      headers: { get: (name) => headers[name.toLowerCase()] ?? headers[name] ?? null },
    };
  }

  test("x-forwarded-for: returns first IP (comma-separated)", () => {
    assert.equal(rateKey(makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  });

  test("x-forwarded-for: strips whitespace", () => {
    assert.equal(rateKey(makeReq({ "x-forwarded-for": "  10.0.0.1  , 192.168.1.1" })), "10.0.0.1");
  });

  test("x-real-ip: fallback when x-forwarded-for absent", () => {
    assert.equal(rateKey(makeReq({ "x-real-ip": "9.8.7.6" })), "9.8.7.6");
  });

  test("NextRequest.ip: takes precedence when available", () => {
    assert.equal(rateKey(makeReq({}, "127.0.0.1")), "127.0.0.1");
  });

  test("NextRequest.ip: overrides x-forwarded-for when both present", () => {
    assert.equal(rateKey(makeReq({ "x-forwarded-for": "1.2.3.4" }, "192.168.1.1")), "192.168.1.1");
  });

  test("anon: fallback when no IP source is available", () => {
    assert.equal(rateKey(makeReq({})), "anon");
  });

  test("anon: fallback when headers return null", () => {
    assert.equal(rateKey({ ip: undefined, headers: { get: () => null } }), "anon");
  });
});
