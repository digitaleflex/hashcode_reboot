/**
 * Tests for CSV import normalization (issue #124).
 * Pure functions — no server, no DB.
 *
 * Miroirs de src/lib/import/normalize.ts (+ règles de
 * src/lib/import/schema.ts) : Node plain ne peut pas importer le TS du
 * projet (module esnext), donc la logique est ré-implémentée à l'identique
 * ici, comme tests/profiling.test.cjs.
 *
 * Run: node --test tests/import-normalize.test.cjs
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Miroir de src/lib/import/normalize.ts ─────────────────────────

function fold(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function normalizeAccessLane(raw) {
  const s = fold(raw);
  if (!s) return null;
  if (
    s === "immediate" ||
    s === "immediat" ||
    s === "immediatee" ||
    s === "immediat(e)" ||
    s === "immediate-access" ||
    s === "acces-immediat" ||
    s === "acces immediat"
  )
    return "immediate";
  if (
    s === "pending" ||
    s === "en traitement" ||
    s === "en-traitement" ||
    s === "en_traitement" ||
    s === "en attente" ||
    s === "en-attente" ||
    s === "attente"
  )
    return "pending";
  return null;
}

function normalizeLevel(raw) {
  const s = fold(raw);
  if (!s) return null;
  if (s === "beginner" || s === "debutant" || s === "debutante")
    return "beginner";
  if (
    s === "practicing" ||
    s.startsWith("inter") ||
    s === "intermediaire" ||
    s === "pratiquant" ||
    s === "pratique"
  )
    return "practicing";
  if (s === "autonomous" || s === "autonome") return "autonomous";
  if (
    s === "advanced" ||
    s.startsWith("avanc") ||
    s === "avance" ||
    s === "avancee" ||
    s === "expert"
  )
    return "advanced";
  return null;
}

function normalizeDomain(raw) {
  const s = fold(raw);
  if (!s) return null;
  if (s === "web" || s.startsWith("dev") || s === "developpement")
    return "web";
  if (
    s === "cybersecurity" ||
    s === "cyber" ||
    s === "cybersecurite" ||
    s === "securite" ||
    s === "security"
  )
    return "cybersecurity";
  if (s === "ai" || s === "ia" || s === "intelligence artificielle")
    return "ai";
  return null;
}

const COUNTRY_NAME_TO_ISO = {
  "cote d'ivoire": "CI",
  ivoire: "CI",
  senegal: "SN",
  benin: "BJ",
  cameroun: "CM",
  mali: "ML",
  niger: "NE",
  "burkina faso": "BF",
  burkina: "BF",
  togo: "TG",
  congo: "CG",
  "republique du congo": "CG",
  rdc: "CD",
  "republique democratique du congo": "CD",
  tunisie: "TN",
  maroc: "MA",
  algerie: "DZ",
  gabon: "GA",
  guinee: "GN",
  france: "FR",
  belgique: "BE",
  suisse: "CH",
  canada: "CA",
  luxembourg: "LU",
};

function normalizeCountry(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const s = fold(trimmed);
  if (!s || s === "autres pays du monde" || s === "autre") return "";
  return COUNTRY_NAME_TO_ISO[s] ?? "";
}

// ── Miroir des règles de src/lib/import/schema.ts ─────────────────
// Reproduit le comportement observable : email lowercase+trim, name 1-120,
// enums level/domain, country 2 lettres, accessLane normalisé.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LEVELS = new Set(["beginner", "practicing", "autonomous", "advanced"]);
const DOMAINS = new Set(["web", "cybersecurity", "ai"]);
const LANES = new Set(["immediate", "pending"]);

function validateImportRow(row) {
  const errors = [];
  const out = {};

  const email = String(row.email ?? "").trim().toLowerCase();
  if (!email) errors.push({ field: "email", message: "Email requis." });
  else if (email.length > 254) errors.push({ field: "email", message: "Email trop long (max 254 caractères)." });
  else if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Email invalide." });
  else out.email = email;

  const name = String(row.name ?? row.firstName ?? "").trim();
  if (!name) errors.push({ field: "name", message: "Nom requis." });
  else if (name.length > 120) errors.push({ field: "name", message: "Nom trop long (max 120 caractères)." });
  else out.name = name;

  if (row.level !== undefined && String(row.level).trim() !== "") {
    const lvl = normalizeLevel(row.level) ?? String(row.level).trim().toLowerCase();
    if (!LEVELS.has(lvl)) errors.push({ field: "level", message: "Niveau invalide (beginner, practicing, autonomous, advanced)." });
    else out.level = lvl;
  }
  if (row.domain !== undefined && String(row.domain).trim() !== "") {
    const dom = normalizeDomain(row.domain) ?? String(row.domain).trim().toLowerCase();
    if (!DOMAINS.has(dom)) errors.push({ field: "domain", message: "Domaine invalide (web, cybersecurity, ai)." });
    else out.domain = dom;
  }
  if (row.country !== undefined && String(row.country).trim() !== "") {
    const code = normalizeCountry(row.country);
    const v = code === "" ? "" : code;
    if (v.length > 2) errors.push({ field: "country", message: "Pays invalide (code ISO 2 lettres)." });
    else out.country = v;
  }
  if (row.accessLane !== undefined && row.accessLane !== null && String(row.accessLane).trim() !== "") {
    const lane = normalizeAccessLane(row.accessLane) ?? row.accessLane;
    if (!LANES.has(lane)) errors.push({ field: "accessLane", message: "Voie d'accès invalide (immediate, pending)." });
    else out.accessLane = lane;
  }
  return { errors, value: out };
}

// ══════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════

describe("normalizeAccessLane", () => {
  test("canoniques conservées", () => {
    assert.equal(normalizeAccessLane("immediate"), "immediate");
    assert.equal(normalizeAccessLane("pending"), "pending");
  });

  test("trim + lowercase", () => {
    assert.equal(normalizeAccessLane("  Immediate "), "immediate");
    assert.equal(normalizeAccessLane("PENDING"), "pending");
  });

  test("alias FR : immédiate/immédiat → immediate", () => {
    assert.equal(normalizeAccessLane("immédiate"), "immediate");
    assert.equal(normalizeAccessLane("immédiat"), "immediate");
    assert.equal(normalizeAccessLane("immediat"), "immediate");
  });

  test("alias FR : en traitement → pending", () => {
    assert.equal(normalizeAccessLane("en traitement"), "pending");
    assert.equal(normalizeAccessLane("En traitement"), "pending");
    assert.equal(normalizeAccessLane("en-traitement"), "pending");
  });

  test("inconnu/vide → null", () => {
    assert.equal(normalizeAccessLane("express"), null);
    assert.equal(normalizeAccessLane(""), null);
    assert.equal(normalizeAccessLane("   "), null);
    assert.equal(normalizeAccessLane(undefined), null);
    assert.equal(normalizeAccessLane(null), null);
    assert.equal(normalizeAccessLane(123), null);
  });
});

describe("normalizeLevel", () => {
  test("canoniques conservées", () => {
    assert.equal(normalizeLevel("beginner"), "beginner");
    assert.equal(normalizeLevel("practicing"), "practicing");
    assert.equal(normalizeLevel("autonomous"), "autonomous");
    assert.equal(normalizeLevel("advanced"), "advanced");
  });

  test("alias FR (miroir import-invite)", () => {
    assert.equal(normalizeLevel("Débutant"), "beginner");
    assert.equal(normalizeLevel("intermédiaire"), "practicing");
    assert.equal(normalizeLevel("Inter"), "practicing");
    assert.equal(normalizeLevel("autonome"), "autonomous");
    assert.equal(normalizeLevel("avancé"), "advanced");
    assert.equal(normalizeLevel("expert"), "advanced");
  });

  test("inconnu/vide → null", () => {
    assert.equal(normalizeLevel("guru"), null);
    assert.equal(normalizeLevel(""), null);
    assert.equal(normalizeLevel(undefined), null);
  });
});

describe("normalizeDomain", () => {
  test("canoniques conservées", () => {
    assert.equal(normalizeDomain("web"), "web");
    assert.equal(normalizeDomain("cybersecurity"), "cybersecurity");
    assert.equal(normalizeDomain("ai"), "ai");
  });

  test("alias FR", () => {
    assert.equal(normalizeDomain("cyber"), "cybersecurity");
    assert.equal(normalizeDomain("IA"), "ai");
    assert.equal(normalizeDomain("dev"), "web");
  });

  test("inconnu/vide → null", () => {
    assert.equal(normalizeDomain("blockchain"), null);
    assert.equal(normalizeDomain(""), null);
    assert.equal(normalizeDomain(undefined), null);
  });
});

describe("normalizeCountry", () => {
  test("2 lettres → uppercase", () => {
    assert.equal(normalizeCountry("fr"), "FR");
    assert.equal(normalizeCountry("BJ"), "BJ");
    assert.equal(normalizeCountry(" ci "), "CI");
  });

  test("noms FR → ISO (miroir import-invite)", () => {
    assert.equal(normalizeCountry("Côte d'Ivoire"), "CI");
    assert.equal(normalizeCountry("Sénégal"), "SN");
    assert.equal(normalizeCountry("bénin"), "BJ");
    assert.equal(normalizeCountry("Cameroun"), "CM");
  });

  test("vide/autres/inconnu → chaîne vide (jamais bloquant)", () => {
    assert.equal(normalizeCountry(""), "");
    assert.equal(normalizeCountry("   "), "");
    assert.equal(normalizeCountry("Autres pays du monde"), "");
    assert.equal(normalizeCountry("Atlantide"), "");
    assert.equal(normalizeCountry(undefined), "");
  });
});

describe("validateImportRow (miroir schema.ts)", () => {
  test("ligne valide complète", () => {
    const { errors, value } = validateImportRow({
      email: "  Jean.Dupont@Example.com ",
      name: "Jean Dupont",
      level: "Débutant",
      domain: "cyber",
      country: "bénin",
      accessLane: "Immédiate",
    });
    assert.deepEqual(errors, []);
    assert.equal(value.email, "jean.dupont@example.com");
    assert.equal(value.name, "Jean Dupont");
    assert.equal(value.level, "beginner");
    assert.equal(value.domain, "cybersecurity");
    assert.equal(value.country, "BJ");
    assert.equal(value.accessLane, "immediate");
  });

  test("ligne minimale (optionnels absents)", () => {
    const { errors, value } = validateImportRow({
      email: "a@b.co",
      name: "A",
    });
    assert.deepEqual(errors, []);
    assert.equal(value.email, "a@b.co");
    assert.equal("level" in value, false);
    assert.equal("accessLane" in value, false);
  });

  test("email invalide + nom manquant + enums inconnus", () => {
    const { errors } = validateImportRow({
      email: "pas-un-email",
      name: "",
      level: "guru",
      domain: "blockchain",
      accessLane: "express",
    });
    const fields = errors.map((e) => e.field);
    assert.ok(fields.includes("email"));
    assert.ok(fields.includes("name"));
    assert.ok(fields.includes("level"));
    assert.ok(fields.includes("domain"));
    assert.ok(fields.includes("accessLane"));
  });

  test("nom > 120 caractères refusé", () => {
    const { errors } = validateImportRow({
      email: "a@b.co",
      name: "x".repeat(121),
    });
    assert.ok(errors.some((e) => e.field === "name"));
  });

  test("en traitement → pending", () => {
    const { errors, value } = validateImportRow({
      email: "a@b.co",
      name: "A",
      accessLane: "en traitement",
    });
    assert.deepEqual(errors, []);
    assert.equal(value.accessLane, "pending");
  });
});
