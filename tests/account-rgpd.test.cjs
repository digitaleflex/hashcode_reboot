/**
 * Unit tests — RGPD membre #64 : export + suppression (fonctions pures).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/account-rgpd.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - DELETE_CONFIRM_WORD / EXPORT_ANALYTICS_MAX / EXPORT_FORMAT /
 *    isDeleteConfirmed / buildExportPayload from src/lib/account-rgpd.ts
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - confirmation : mot exact uniquement (casse, espaces, types rejetés)
 *  - export : présence des 9 blocs, format versionné, exportedAt ISO,
 *    analytics plafonnées + flag tronqué
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/account-rgpd.ts ──

const DELETE_CONFIRM_WORD = "SUPPRIMER";
const EXPORT_ANALYTICS_MAX = 500;
const EXPORT_FORMAT = "hashcode-reboot-export-v1";

function isDeleteConfirmed(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return body.confirm === DELETE_CONFIRM_WORD;
}

function buildExportPayload(member, relations) {
  return {
    exportedAt: new Date().toISOString(),
    format: EXPORT_FORMAT,
    member,
    rsvps: relations.rsvps,
    enrollments: relations.enrollments,
    submissions: relations.submissions,
    quizAttempts: relations.quizAttempts,
    emailLogs: relations.emailLogs,
    sessions: relations.sessions,
    draft: relations.draft,
    analytics: relations.analytics,
    analyticsTruncated: relations.analyticsTruncated,
  };
}

// ── Tests ──

describe("isDeleteConfirmed", () => {
  test("accepte uniquement le mot exact", () => {
    assert.equal(isDeleteConfirmed({ confirm: "SUPPRIMER" }), true);
  });

  test("rejette casse, espaces, vide, types et absents", () => {
    assert.equal(isDeleteConfirmed({ confirm: "supprimer" }), false);
    assert.equal(isDeleteConfirmed({ confirm: " SUPPRIMER" }), false);
    assert.equal(isDeleteConfirmed({ confirm: "SUPPRIMER " }), false);
    assert.equal(isDeleteConfirmed({ confirm: "" }), false);
    assert.equal(isDeleteConfirmed({}), false);
    assert.equal(isDeleteConfirmed(null), false);
    assert.equal(isDeleteConfirmed(undefined), false);
    assert.equal(isDeleteConfirmed("SUPPRIMER"), false);
    assert.equal(isDeleteConfirmed(["SUPPRIMER"]), false);
    assert.equal(isDeleteConfirmed({ confirm: 123 }), false);
  });
});

describe("buildExportPayload", () => {
  const member = { id: "c1", email: "a@x.y", firstName: "Awa" };
  const empty = {
    rsvps: [], enrollments: [], submissions: [], quizAttempts: [],
    emailLogs: [], sessions: [], draft: null, analytics: [],
    analyticsTruncated: false,
  };

  test("contient les 9 blocs + format + date ISO", () => {
    const out = buildExportPayload(member, empty);
    assert.deepEqual(out.member, member);
    assert.equal(out.format, EXPORT_FORMAT);
    assert.ok(!Number.isNaN(Date.parse(out.exportedAt)), out.exportedAt);
    for (const k of ["rsvps", "enrollments", "submissions", "quizAttempts", "emailLogs", "sessions", "draft", "analytics"]) {
      assert.ok(k in out, `bloc manquant : ${k}`);
    }
    assert.equal(out.analyticsTruncated, false);
  });

  test("sérialisable JSON (téléchargeable tel quel)", () => {
    const out = buildExportPayload(member, {
      ...empty,
      draft: { email: "a@x.y", answers: "{}" },
      analyticsTruncated: true,
    });
    assert.doesNotThrow(() => JSON.stringify(out));
    assert.equal(out.analyticsTruncated, true);
  });

  test("constantes : plafond analytics 500, format versionné", () => {
    assert.equal(EXPORT_ANALYTICS_MAX, 500);
    assert.ok(EXPORT_FORMAT.startsWith("hashcode-reboot-export-"));
  });
});

// ══════════════════════════════════════════════════════════════════
// #210 phase 2 — Consentements (miroirs de src/lib/consents.ts,
// servis par POST/GET /api/consents — append-only, dernière ligne lue
// par max createdAt pour (email, purpose)).
// ══════════════════════════════════════════════════════════════════

// ── Mirrors of src/lib/consents.ts ──

const CONSENT_PURPOSES = ["cookies", "contact", "profiling"];
const CONSENT_CHOICES = ["granted", "withdrawn"];
const ANONYMOUS_CONSENT_EMAIL = "anonymous";

function normalizeConsentEmail(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v || ANONYMOUS_CONSENT_EMAIL;
}

// Miroir de consentBodySchema : mêmes règles (email optionnel,
// unions strictes, textVersion 1..60, proof objet BORNÉ (#215 : ≤ 20 clés,
// clés ≤ 128, valeurs ≤ 2 Ko sérialisées — miroir de isConsentBodyValid),
// memberId ≤ 40).
function isConsentBodyValid(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  if (!CONSENT_PURPOSES.includes(b.purpose)) return false;
  if (!CONSENT_CHOICES.includes(b.choice)) return false;
  if (typeof b.textVersion !== "string") return false;
  const tv = b.textVersion.trim();
  if (tv.length < 1 || tv.length > 60) return false;
  if (b.email !== undefined) {
    if (typeof b.email !== "string") return false;
    const em = b.email.trim().toLowerCase();
    if (em.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return false;
  }
  if (b.proof !== undefined) {
    if (!b.proof || typeof b.proof !== "object" || Array.isArray(b.proof)) return false;
    const entries = Object.entries(b.proof);
    if (entries.length > 20) return false;
    for (const [k, v] of entries) {
      if (!k || k.length > 128) return false;
      const s = typeof v === "string" ? v : JSON.stringify(v) ?? "";
      if (Buffer.byteLength(s, "utf8") > 2048) return false;
    }
  }
  if (b.memberId !== undefined) {
    if (typeof b.memberId !== "string" || b.memberId.trim().length > 40) return false;
  }
  return true;
}

// Miroir de pickLatestConsent : max createdAt.
function pickLatestConsent(rows) {
  let latest = null;
  for (const r of rows) {
    if (!latest || new Date(r.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
      latest = r;
    }
  }
  return latest;
}

// ── Tests ──

describe("consentBody — unions Zod (pas d'enum DB)", () => {
  const base = { purpose: "cookies", choice: "granted", textVersion: "cookies-v1" };

  test("purposes reconnues acceptées", () => {
    for (const purpose of CONSENT_PURPOSES) {
      assert.equal(isConsentBodyValid({ ...base, purpose }), true, purpose);
    }
  });

  test("purpose inconnue rejetée", () => {
    assert.equal(isConsentBodyValid({ ...base, purpose: "marketing" }), false);
    assert.equal(isConsentBodyValid({ ...base, purpose: "" }), false);
    const { purpose, ...sansPurpose } = base;
    assert.equal(isConsentBodyValid(sansPurpose), false);
  });

  test("choices granted/withdrawn acceptés, autres rejetés", () => {
    assert.equal(isConsentBodyValid({ ...base, choice: "granted" }), true);
    assert.equal(isConsentBodyValid({ ...base, choice: "withdrawn" }), true);
    assert.equal(isConsentBodyValid({ ...base, choice: "accepted" }), false);
    assert.equal(isConsentBodyValid({ ...base, choice: "declined" }), false);
  });

  test("textVersion 1..60, proof objet, memberId optionnels", () => {
    assert.equal(isConsentBodyValid({ ...base, textVersion: "" }), false);
    assert.equal(isConsentBodyValid({ ...base, textVersion: "x".repeat(61) }), false);
    assert.equal(isConsentBodyValid({ ...base, proof: { ts: 1 } }), true);
    assert.equal(isConsentBodyValid({ ...base, proof: [1] }), false);
    assert.equal(isConsentBodyValid({ ...base, memberId: "c123" }), true);
  });

  test("proof borné #215 : 20 clés max, valeurs ≤ 2 Ko", () => {
    const keys20 = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`k${i}`, "v"]),
    );
    assert.equal(isConsentBodyValid({ ...base, proof: keys20 }), true);
    const keys21 = { ...keys20, k20: "v" };
    assert.equal(isConsentBodyValid({ ...base, proof: keys21 }), false);
    assert.equal(
      isConsentBodyValid({ ...base, proof: { big: "x".repeat(2048) } }),
      true,
    );
    assert.equal(
      isConsentBodyValid({ ...base, proof: { big: "x".repeat(2049) } }),
      false,
    );
    // Objet imbriqué mesuré sérialisé, pas au nombre de champs.
    assert.equal(
      isConsentBodyValid({ ...base, proof: { nested: { a: [1, 2, 3] } } }),
      true,
    );
    assert.equal(
      isConsentBodyValid({ ...base, proof: { nested: { a: "x".repeat(3000) } } }),
      false,
    );
  });

  test("parité source : bornes proof dans src/lib/consents.ts", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "src", "lib", "consents.ts"),
      "utf8",
    );
    assert.ok(src.includes("isConsentProofValid"), "garde pure manquante");
    assert.ok(src.includes("CONSENT_PROOF_MAX_KEYS = 20"), "borne 20 clés manquante");
    assert.ok(
      src.includes("CONSENT_PROOF_VALUE_MAX_BYTES = 2048"),
      "borne 2 Ko manquante",
    );
    assert.ok(src.includes(".refine("), "refine Zod manquant sur proof");
  });
});

describe("normalizeConsentEmail — email optionnel (bandeau cookies, modale privacy)", () => {
  test("absent/vide → marqueur anonyme (colonne DB non nulle)", () => {
    assert.equal(normalizeConsentEmail(undefined), ANONYMOUS_CONSENT_EMAIL);
    assert.equal(normalizeConsentEmail(""), ANONYMOUS_CONSENT_EMAIL);
    assert.equal(normalizeConsentEmail("   "), ANONYMOUS_CONSENT_EMAIL);
    assert.equal(normalizeConsentEmail(null), ANONYMOUS_CONSENT_EMAIL);
  });

  test("fourni → trim + lowercase", () => {
    assert.equal(normalizeConsentEmail("  Awa@Example.COM "), "awa@example.com");
  });
});

describe("pickLatestConsent — GET ?email=&purpose= (dernière ligne)", () => {
  const rows = [
    { email: "a@x.y", purpose: "cookies", choice: "granted", createdAt: "2026-01-01T00:00:00Z" },
    { email: "a@x.y", purpose: "cookies", choice: "withdrawn", createdAt: "2026-02-01T00:00:00Z" },
    { email: "a@x.y", purpose: "contact", choice: "granted", createdAt: "2026-03-01T00:00:00Z" },
  ];

  test("retourne la ligne au createdAt max", () => {
    const latest = pickLatestConsent(rows.filter((r) => r.purpose === "cookies"));
    assert.equal(latest.choice, "withdrawn");
  });

  test("vide → null (GET répond { consent: null }, pas 404)", () => {
    assert.equal(pickLatestConsent([]), null);
  });

  test("accepte Date et string ISO indifféremment", () => {
    const latest = pickLatestConsent([
      { email: "a@x.y", purpose: "cookies", choice: "granted", createdAt: new Date("2026-01-01") },
      { email: "a@x.y", purpose: "cookies", choice: "withdrawn", createdAt: new Date("2026-05-01") },
    ]);
    assert.equal(latest.choice, "withdrawn");
  });
});
