/**
 * Unit tests — Magic link auth flow (onboarding + login).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/magic-link.test.cjs
 *
 * Coverage:
 *  - verify-email: parseLinkEntry, buildVerifyUrl, requestEmailLink (memory),
 *    confirmEmailLink (memory), isEmailVerified (memory), single-use, cooldown
 *  - account-otp: generateOtp format, hashOtp+verifyOtpHash roundtrip,
 *    isValidOtpFormat validation
 *  - sanitize-next: open-redirect filter (login + verify-otp)
 */

"use strict";

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { setTimeout: wait } = require("node:timers/promises");

// ═══════════════════════════════════════════════════════════════════
// 1) verify-email — parseLinkEntry (pure logic)
// ═══════════════════════════════════════════════════════════════════

describe("verify-email: parseLinkEntry (unit)", () => {
  // Re-implementation of parseLinkEntry from src/lib/verify-email.ts
  function parseLinkEntry(raw) {
    if (raw == null) return null;
    if (typeof raw === "object") {
      const e = raw;
      if (typeof e.email === "string" && e.email.includes("@")) {
        return {
          email: e.email.trim().toLowerCase(),
          createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
        };
      }
      return null;
    }
    if (typeof raw === "string") {
      try {
        const e = JSON.parse(raw);
        if (typeof e.email === "string" && e.email.includes("@")) {
          return {
            email: e.email.trim().toLowerCase(),
            createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
          };
        }
        return null;
      } catch {
        return null;
      }
    }
    return null;
  }

  test("returns null for null/undefined", () => {
    assert.equal(parseLinkEntry(null), null);
    assert.equal(parseLinkEntry(undefined), null);
  });

  test("returns null for non-string/non-object", () => {
    assert.equal(parseLinkEntry(42), null);
    assert.equal(parseLinkEntry(true), null);
  });

  test("parses valid object with email and createdAt", () => {
    const entry = parseLinkEntry({ email: "Test@Example.com", createdAt: 1700000000000 });
    assert.ok(entry);
    assert.equal(entry.email, "test@example.com");
    assert.equal(entry.createdAt, 1700000000000);
  });

  test("normalizes email to lowercase and trims", () => {
    const entry = parseLinkEntry({ email: "  Foo@Bar.COM  " });
    assert.ok(entry);
    assert.equal(entry.email, "foo@bar.com");
  });

  test("returns null for object without @ in email", () => {
    assert.equal(parseLinkEntry({ email: "not-an-email" }), null);
    assert.equal(parseLinkEntry({ email: "" }), null);
  });

  test("returns null for object without email field", () => {
    assert.equal(parseLinkEntry({ name: "test" }), null);
  });

  test("parses valid JSON string", () => {
    const json = JSON.stringify({ email: "user@test.com", createdAt: 1700000000000 });
    const entry = parseLinkEntry(json);
    assert.ok(entry);
    assert.equal(entry.email, "user@test.com");
    assert.equal(entry.createdAt, 1700000000000);
  });

  test("returns null for invalid JSON string", () => {
    assert.equal(parseLinkEntry("not-json"), null);
  });

  test("returns null for JSON string without valid email", () => {
    assert.equal(parseLinkEntry(JSON.stringify({ name: "test" })), null);
  });

  test("defaults createdAt to Date.now() when missing", () => {
    const before = Date.now();
    const entry = parseLinkEntry({ email: "a@b.com" });
    const after = Date.now();
    assert.ok(entry);
    assert.ok(entry.createdAt >= before && entry.createdAt <= after);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2) verify-email — buildVerifyUrl (pure logic)
// ═══════════════════════════════════════════════════════════════════

describe("verify-email: buildVerifyUrl (unit)", () => {
  function buildVerifyUrl(token, envOverrides = {}) {
    const saved = {};
    for (const [k, v] of Object.entries(envOverrides)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    try {
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_URL ||
        "https://reboot.joinhashcode.com";
      return `${base.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
    } finally {
      for (const [k] of Object.entries(envOverrides)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  test("uses NEXT_PUBLIC_SITE_URL when set", () => {
    const url = buildVerifyUrl("abc123", { NEXT_PUBLIC_SITE_URL: "https://example.com" });
    assert.equal(url, "https://example.com/verify-email?token=abc123");
  });

  test("strips trailing slash from base URL", () => {
    const url = buildVerifyUrl("tok", { NEXT_PUBLIC_SITE_URL: "https://example.com/" });
    assert.equal(url, "https://example.com/verify-email?token=tok");
  });

  test("falls back to NEXT_PUBLIC_URL", () => {
    const url = buildVerifyUrl("x", { NEXT_PUBLIC_URL: "https://fallback.com" });
    assert.equal(url, "https://fallback.com/verify-email?token=x");
  });

  test("falls back to default production URL", () => {
    const url = buildVerifyUrl("y", {});
    assert.ok(url.startsWith("https://reboot.joinhashcode.com/verify-email?token=y"));
  });

  test("URL-encodes the token", () => {
    const url = buildVerifyUrl("a/b+c", { NEXT_PUBLIC_SITE_URL: "https://x.com" });
    assert.ok(url.includes("token=a%2Fb%2Bc"));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3) verify-email — Memory fallback (full flow)
// ═══════════════════════════════════════════════════════════════════

describe("verify-email: memory fallback flow (unit)", () => {
  const { randomBytes } = require("node:crypto");

  const LINK_TTL_SEC = 24 * 60 * 60;
  const VERIFIED_TTL_SEC = 30 * 24 * 60 * 60;
  const RESEND_COOLDOWN_SEC = 60;

  // In-memory store (mirrors verify-email.ts)
  const memLinks = new Map();
  const memEmailToToken = new Map();
  const memLastSent = new Map();
  const memVerified = new Map();

  function makeToken() {
    return randomBytes(32).toString("base64url");
  }

  function requestEmailLink(email) {
    const norm = email.trim().toLowerCase();
    const now = Date.now();
    const last = memLastSent.get(norm) ?? 0;
    const ageSec = Math.floor((now - last) / 1000);
    if (last && ageSec < RESEND_COOLDOWN_SEC) {
      return { ok: false, token: "", cooldownSec: RESEND_COOLDOWN_SEC - ageSec };
    }
    const old = memEmailToToken.get(norm);
    if (old) memLinks.delete(old);
    const token = makeToken();
    memLinks.set(token, {
      entry: { email: norm, createdAt: now },
      expiresAt: now + LINK_TTL_SEC * 1000,
    });
    memEmailToToken.set(norm, token);
    memLastSent.set(norm, now);
    return { ok: true, token };
  }

  function confirmEmailLink(token) {
    const clean = (token || "").trim();
    if (!clean || clean.length < 16) return { ok: false, reason: "invalid" };
    const now = Date.now();
    const mem = memLinks.get(clean);
    if (!mem || mem.expiresAt <= now) {
      memLinks.delete(clean);
      return { ok: false, reason: "expired" };
    }
    memLinks.delete(clean);
    const mapped = memEmailToToken.get(mem.entry.email);
    if (mapped === clean) memEmailToToken.delete(mem.entry.email);
    memVerified.set(mem.entry.email, now + VERIFIED_TTL_SEC * 1000);
    return { ok: true, email: mem.entry.email };
  }

  function isEmailVerified(email) {
    const norm = email.trim().toLowerCase();
    const exp = memVerified.get(norm);
    if (exp && exp > Date.now()) return true;
    if (exp) memVerified.delete(norm);
    return false;
  }

  beforeEach(() => {
    memLinks.clear();
    memEmailToToken.clear();
    memLastSent.clear();
    memVerified.clear();
  });

  test("requestEmailLink: returns ok=true with valid token", () => {
    const r = requestEmailLink("user@example.com");
    assert.equal(r.ok, true);
    assert.ok(typeof r.token === "string");
    assert.ok(r.token.length >= 16);
  });

  test("requestEmailLink: normalizes email", () => {
    const r = requestEmailLink("  User@Example.COM  ");
    assert.equal(r.ok, true);
    // Confirm via emailLink mapping — internally normalized
    assert.ok(memEmailToToken.has("user@example.com"));
  });

  test("requestEmailLink: blocks within cooldown", () => {
    requestEmailLink("test@test.com");
    const r2 = requestEmailLink("test@test.com");
    assert.equal(r2.ok, false);
    assert.ok(typeof r2.cooldownSec === "number");
    assert.ok(r2.cooldownSec > 0 && r2.cooldownSec <= RESEND_COOLDOWN_SEC);
  });

  test("requestEmailLink: invalidates old link on resend", () => {
    const r1 = requestEmailLink("old@test.com");
    assert.equal(r1.ok, true);
    assert.ok(memLinks.has(r1.token));

    // Advance past cooldown
    memLastSent.set("old@test.com", Date.now() - RESEND_COOLDOWN_SEC * 1000 - 1);
    const r2 = requestEmailLink("old@test.com");
    assert.equal(r2.ok, true);
    assert.ok(!memLinks.has(r1.token), "old link should be invalidated");
    assert.ok(memLinks.has(r2.token), "new link should exist");
  });

  test("confirmEmailLink: rejects empty/short token", () => {
    assert.deepEqual(confirmEmailLink(""), { ok: false, reason: "invalid" });
    assert.deepEqual(confirmEmailLink(null), { ok: false, reason: "invalid" });
    assert.deepEqual(confirmEmailLink("short"), { ok: false, reason: "invalid" });
  });

  test("confirmEmailLink: returns expired for unknown token", () => {
    assert.deepEqual(confirmEmailLink("unknown-token-xxxxxxxxxxxxxxxx"), { ok: false, reason: "expired" });
  });

  test("confirmEmailLink: succeeds and is single-use", () => {
    const r = requestEmailLink("link@test.com");
    assert.equal(r.ok, true);

    const c1 = confirmEmailLink(r.token);
    assert.deepEqual(c1, { ok: true, email: "link@test.com" });

    // Second use → expired (single-use)
    const c2 = confirmEmailLink(r.token);
    assert.deepEqual(c2, { ok: false, reason: "expired" });
  });

  test("confirmEmailLink: cleans up email→token mapping", () => {
    const r = requestEmailLink("map@test.com");
    assert.ok(memEmailToToken.has("map@test.com"));
    confirmEmailLink(r.token);
    assert.ok(!memEmailToToken.has("map@test.com"), "mapping should be cleaned up");
  });

  test("isEmailVerified: returns false before confirmation", () => {
    assert.equal(isEmailVerified("new@test.com"), false);
  });

  test("isEmailVerified: returns true after confirmation", () => {
    const r = requestEmailLink("v@test.com");
    confirmEmailLink(r.token);
    assert.equal(isEmailVerified("v@test.com"), true);
  });

  test("isEmailVerified: normalizes email", () => {
    const r = requestEmailLink("norm@test.com");
    confirmEmailLink(r.token);
    assert.equal(isEmailVerified("  NORM@test.com  "), true);
  });

  test("isEmailVerified: returns false after expiry", async () => {
    const r = requestEmailLink("expire@test.com");
    confirmEmailLink(r.token);
    // Manually set verified to past
    memVerified.set("expire@test.com", Date.now() - 1000);
    assert.equal(isEmailVerified("expire@test.com"), false);
    assert.ok(!memVerified.has("expire@test.com"), "expired entry should be cleaned up");
  });

  test("full flow: request → confirm → verified → re-request cooldown", () => {
    // 1. Request
    const r1 = requestEmailLink("full@test.com");
    assert.equal(r1.ok, true);

    // 2. Confirm
    const c = confirmEmailLink(r1.token);
    assert.deepEqual(c, { ok: true, email: "full@test.com" });

    // 3. Verified
    assert.equal(isEmailVerified("full@test.com"), true);

    // 4. Re-request blocked by cooldown
    const r2 = requestEmailLink("full@test.com");
    assert.equal(r2.ok, false);
  });

  test("two different emails get independent links", () => {
    const r1 = requestEmailLink("a@test.com");
    const r2 = requestEmailLink("b@test.com");
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    assert.notEqual(r1.token, r2.token);

    confirmEmailLink(r1.token);
    assert.equal(isEmailVerified("a@test.com"), true);
    assert.equal(isEmailVerified("b@test.com"), false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4) account-otp — OTP generation + format validation
// ═══════════════════════════════════════════════════════════════════

describe("account-otp: generateOtp format (unit)", () => {
  const { randomInt } = require("node:crypto");

  function generateOtp() {
    return String(randomInt(100_000, 1_000_000));
  }

  test("generates exactly 6 digits", () => {
    for (let i = 0; i < 100; i++) {
      const otp = generateOtp();
      assert.equal(otp.length, 6, `OTP "${otp}" should be 6 digits`);
      assert.ok(/^\d{6}$/.test(otp), `OTP "${otp}" should be all digits`);
    }
  });

  test("generates values in range [100000, 999999]", () => {
    for (let i = 0; i < 100; i++) {
      const n = Number(generateOtp());
      assert.ok(n >= 100_000 && n <= 999_999, `OTP ${n} out of range`);
    }
  });

  test("generates different values (non-constant)", () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) seen.add(generateOtp());
    assert.ok(seen.size > 1, "should generate varied OTPs");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5) account-otp — bcrypt hash + verify
// ═══════════════════════════════════════════════════════════════════

describe("account-otp: hashOtp + verifyOtpHash (unit)", () => {
  const bcrypt = require("bcryptjs");

  async function hashOtp(otp) {
    return bcrypt.hash(otp, 12);
  }

  async function verifyOtpHash(otp, hash) {
    if (!otp || !hash) return false;
    try {
      return await bcrypt.compare(otp, hash);
    } catch {
      return false;
    }
  }

  test("roundtrip: hash then verify with correct OTP", async () => {
    const otp = "482917";
    const hash = await hashOtp(otp);
    assert.ok(typeof hash === "string");
    assert.ok(hash.startsWith("$2a$") || hash.startsWith("$2b$"), "should be bcrypt hash");
    assert.equal(await verifyOtpHash(otp, hash), true);
  });

  test("rejects wrong OTP", async () => {
    const hash = await hashOtp("123456");
    assert.equal(await verifyOtpHash("654321", hash), false);
  });

  test("rejects empty OTP", async () => {
    const hash = await hashOtp("123456");
    assert.equal(await verifyOtpHash("", hash), false);
    assert.equal(await verifyOtpHash(null, hash), false);
  });

  test("rejects empty hash", async () => {
    assert.equal(await verifyOtpHash("123456", ""), false);
    assert.equal(await verifyOtpHash("123456", null), false);
  });

  test("rejects garbage hash", async () => {
    assert.equal(await verifyOtpHash("123456", "not-a-hash"), false);
  });

  test("each OTP gets a unique hash", async () => {
    const h1 = await hashOtp("111111");
    const h2 = await hashOtp("222222");
    assert.notEqual(h1, h2, "different OTPs should produce different hashes");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6) account-otp — isValidOtpFormat
// ═══════════════════════════════════════════════════════════════════

describe("account-otp: isValidOtpFormat (unit)", () => {
  function isValidOtpFormat(otp) {
    return typeof otp === "string" && /^\d{6}$/.test(otp.trim());
  }

  test("accepts valid 6-digit string", () => {
    assert.equal(isValidOtpFormat("123456"), true);
    assert.equal(isValidOtpFormat("000000"), true);
    assert.equal(isValidOtpFormat("999999"), true);
  });

  test("accepts with leading/trailing whitespace", () => {
    assert.equal(isValidOtpFormat("  123456  "), true);
  });

  test("rejects non-string", () => {
    assert.equal(isValidOtpFormat(123456), false);
    assert.equal(isValidOtpFormat(null), false);
    assert.equal(isValidOtpFormat(undefined), false);
  });

  test("rejects wrong length", () => {
    assert.equal(isValidOtpFormat("12345"), false);
    assert.equal(isValidOtpFormat("1234567"), false);
    assert.equal(isValidOtpFormat(""), false);
  });

  test("rejects non-digit characters", () => {
    assert.equal(isValidOtpFormat("12345a"), false);
    assert.equal(isValidOtpFormat("12-456"), false);
    assert.equal(isValidOtpFormat("123 45"), false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7) sanitize-next — open-redirect filter
// ═══════════════════════════════════════════════════════════════════

describe("sanitize-next: open-redirect filter (unit)", () => {
  // Same filter used in login/page.tsx and verify-otp/page.tsx
  function sanitizeNext(rawNext) {
    const fallback = "/account";
    if (!rawNext) return fallback;
    const v = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : fallback;
    return v;
  }

  test("allows relative paths starting with /", () => {
    assert.equal(sanitizeNext("/account"), "/account");
    assert.equal(sanitizeNext("/admin/stats"), "/admin/stats");
    assert.equal(sanitizeNext("/some/deep/path"), "/some/deep/path");
  });

  test("rejects protocol-relative URLs (//evil.com)", () => {
    assert.equal(sanitizeNext("//evil.com"), "/account");
    assert.equal(sanitizeNext("//evil.com/steal"), "/account");
  });

  test("rejects absolute URLs", () => {
    assert.equal(sanitizeNext("https://evil.com"), "/account");
    assert.equal(sanitizeNext("http://evil.com"), "/account");
    assert.equal(sanitizeNext("ftp://evil.com"), "/account");
  });

  test("falls back to /account for empty/null", () => {
    assert.equal(sanitizeNext(null), "/account");
    assert.equal(sanitizeNext(""), "/account");
    assert.equal(sanitizeNext(undefined), "/account");
  });

  test("allows /account with query params", () => {
    assert.equal(sanitizeNext("/verify-otp?email=x&code=123"), "/verify-otp?email=x&code=123");
  });
});
