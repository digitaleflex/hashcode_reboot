/**
 * Déduplication (#103) — normalisation et classification, sans DB.
 * Run: tsx --test tests/dedup.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  classifyPair,
  mergeFillValues,
  normalizeEmail,
  normalizePhone,
} from "../src/lib/dedup";

describe("normalizeEmail : insensible casse/espaces, règles Gmail", () => {
  test("trim + minuscules partout", () => {
    assert.equal(normalizeEmail("  Awa@Example.COM "), "awa@example.com");
  });

  test("Gmail : points ignorés, sous-adresses retirées", () => {
    assert.equal(normalizeEmail("a.w.a+spam@gmail.com"), "awa@gmail.com");
    assert.equal(normalizeEmail("awa@googlemail.com"), "awa@googlemail.com");
  });

  test("non-Gmail : points conservés (faux positifs évités)", () => {
    assert.equal(normalizeEmail("a.wa@outlook.com"), "a.wa@outlook.com");
    assert.equal(normalizeEmail("a.wa+tag@yahoo.fr"), "a.wa+tag@yahoo.fr");
  });

  test("invalides → null", () => {
    for (const bad of ["", "   ", "sans-arobase", null, undefined, 42]) {
      assert.equal(normalizeEmail(bad), null, JSON.stringify(bad));
    }
  });
});

describe("normalizePhone : séparateurs retirés, faux positifs bornés", () => {
  test("formes équivalentes", () => {
    assert.equal(normalizePhone("+229 90 00 00"), "+229900000");
    assert.equal(normalizePhone("+229-90-00-00"), "+229900000");
    assert.equal(normalizePhone("+229 (90) 00-00"), "+229900000");
  });

  test("trop court / vide → null (pas de match hasardeux)", () => {
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone("123"), null);
    assert.equal(normalizePhone(null), null);
  });
});

describe("classifyPair : EXACT, AMBIGU, ou rien", () => {
  test("même email normalisé → EXACT", () => {
    assert.equal(
      classifyPair({ email: "Awa@x.y" }, { email: " awa@X.Y " }),
      "EXACT",
    );
    assert.equal(
      classifyPair({ email: "a.wa@gmail.com" }, { email: "awa@gmail.com" }),
      "EXACT",
    );
  });

  test("même téléphone, emails distincts → AMBIGU", () => {
    assert.equal(
      classifyPair(
        { email: "a@x.y", phone: "+229 90 00 00" },
        { email: "b@x.y", phone: "+229900000" },
      ),
      "AMBIGUOUS",
    );
  });

  test("faux positifs préservés (jamais fusionnés)", () => {
    // Points significatifs hors Gmail.
    assert.equal(
      classifyPair({ email: "a.wa@outlook.com" }, { email: "awa@outlook.com" }),
      null,
    );
    // Rien en commun.
    assert.equal(classifyPair({ email: "a@x.y" }, { email: "b@x.y" }), null);
    // Téléphone trop court des deux côtés.
    assert.equal(
      classifyPair({ email: "a@x.y", phone: "123" }, { email: "b@x.y", phone: "123" }),
      null,
    );
  });
});

describe("mergeFillValues : comble sans écraser", () => {
  test("trous comblés, existants intacts (tags AUTO exclus : moteur)", () => {
    const out = mergeFillValues(
      { phone: "+1", city: "" },
      { phone: "+2", city: "Cotonou", lastName: "D" },
    );
    assert.deepEqual(out, { city: "Cotonou", lastName: "D" });
  });
});
