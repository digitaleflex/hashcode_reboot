/**
 * Unit tests — tags libres des membres (#102).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/member-custom-tags.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - validateCustomTags in src/app/api/members/[id]/route.ts (PATCH) :
 *    trim, minuscules, vides retirés, dédupliqués, max 20 tags,
 *    40 caractères chacun (bornes calées sur les skills ateliers, cf.
 *    src/lib/workshops/validation.ts validateSessionCreate).
 *  - Tag filter in src/app/api/members/route.ts (GET liste, ?tag=) :
 *    trim + minuscules, ignoré si vide, `contains` sur customTags.
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - validation: happy path, trim/lowercase, vides retirés, dédup,
 *    non-tableau rejeté, tag > 40 rejeté, > 20 tags rejetés, pile 20 ok
 *  - filtre: normalisation, vide ignoré, clause contains documentée
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirror of validateCustomTags (src/app/api/members/[id]/route.ts) ──

const CUSTOM_TAGS_MAX = 20;
const CUSTOM_TAG_MAX_LEN = 40;

function validateCustomTags(v) {
  if (!Array.isArray(v)) {
    return { ok: false, error: "customTags doit être un tableau de chaînes." };
  }
  const seen = new Set();
  const tags = [];
  for (const raw of v) {
    const t = String(raw).trim().toLowerCase();
    if (!t) continue;
    if (t.length > CUSTOM_TAG_MAX_LEN) {
      return { ok: false, error: "Chaque tag est limité à 40 caractères." };
    }
    if (seen.has(t)) continue;
    seen.add(t);
    tags.push(t);
  }
  if (tags.length > CUSTOM_TAGS_MAX) {
    return { ok: false, error: "20 tags libres maximum." };
  }
  return { ok: true, tags };
}

// ── Mirror of the ?tag= filter (src/app/api/members/route.ts GET) ──

function buildTagFilter(tagParam) {
  const tag = tagParam?.trim().toLowerCase();
  if (!tag) return {};
  // LIMITE documentée : `contains` = substring match sans index.
  return { customTags: { contains: tag } };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("validateCustomTags", () => {
  test("happy path — tableau simple conservé tel quel", () => {
    const r = validateCustomTags(["mentor", "suivi"]);
    assert.deepEqual(r, { ok: true, tags: ["mentor", "suivi"] });
  });

  test("trim + minuscules appliqués", () => {
    const r = validateCustomTags(["  Mentor-Potentiel ", "SUIVI"]);
    assert.deepEqual(r, { ok: true, tags: ["mentor-potentiel", "suivi"] });
  });

  test("vides retirés (espaces, chaînes vides)", () => {
    const r = validateCustomTags(["mentor", "   ", "", "suivi"]);
    assert.deepEqual(r, { ok: true, tags: ["mentor", "suivi"] });
  });

  test("doublons dédupliqués (après normalisation)", () => {
    const r = validateCustomTags(["Mentor", "mentor", " MENTOR "]);
    assert.deepEqual(r, { ok: true, tags: ["mentor"] });
  });

  test("tableau vide accepté (reset des tags)", () => {
    assert.deepEqual(validateCustomTags([]), { ok: true, tags: [] });
  });

  test("non-tableau rejeté", () => {
    assert.equal(validateCustomTags("mentor").ok, false);
    assert.equal(validateCustomTags(null).ok, false);
    assert.equal(validateCustomTags(undefined).ok, false);
    assert.equal(validateCustomTags({ 0: "mentor" }).ok, false);
  });

  test("tag > 40 caractères rejeté", () => {
    assert.equal(validateCustomTags(["a".repeat(41)]).ok, false);
  });

  test("tag pile 40 caractères accepté", () => {
    const r = validateCustomTags(["a".repeat(40)]);
    assert.equal(r.ok, true);
    assert.equal(r.tags[0].length, 40);
  });

  test("plus de 20 tags rejeté", () => {
    const many = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const r = validateCustomTags(many);
    assert.equal(r.ok, false);
    assert.match(r.error, /20 tags libres maximum/);
  });

  test("pile 20 tags accepté", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    const r = validateCustomTags(twenty);
    assert.equal(r.ok, true);
    assert.equal(r.tags.length, 20);
  });

  test("dédup avant le comptage (21 entrées, 20 uniques → ok)", () => {
    const entries = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    entries.push("tag-0"); // doublon
    const r = validateCustomTags(entries);
    assert.equal(r.ok, true);
    assert.equal(r.tags.length, 20);
  });

  test("sortie sérialisable en JSON string[] (convention colonne)", () => {
    const r = validateCustomTags(["Mentor", "suivi"]);
    assert.equal(JSON.stringify(r.tags), '["mentor","suivi"]');
  });
});

describe("?tag= filter", () => {
  test("normalise trim + minuscules", () => {
    assert.deepEqual(buildTagFilter("  Mentor "), {
      customTags: { contains: "mentor" },
    });
  });

  test("vide / espaces → pas de filtre", () => {
    assert.deepEqual(buildTagFilter(null), {});
    assert.deepEqual(buildTagFilter(undefined), {});
    assert.deepEqual(buildTagFilter(""), {});
    assert.deepEqual(buildTagFilter("   "), {});
  });

  test("clause contains sur customTags uniquement (pas tags auto)", () => {
    const where = buildTagFilter("mentor");
    assert.ok("customTags" in where, "filtre sur customTags");
    assert.ok(!("tags" in where), "ne touche pas aux tags auto");
    assert.deepEqual(where.customTags, { contains: "mentor" });
  });

  test("LIMITE : substring match (tag=art matche aussi artisan)", () => {
    // Documente le comportement `contains` : pas de match exact, pas
    // d'index — assumé côté route (commentaire dans members/route.ts).
    const stored = JSON.stringify(["artisan", "mentor"]);
    const { contains } = buildTagFilter("art").customTags;
    assert.ok(
      stored.includes(contains),
      `"${contains}" est un substring de ${stored}`,
    );
  });
});
