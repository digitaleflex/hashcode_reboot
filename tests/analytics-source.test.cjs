/**
 * Tests de non-régression — D40 : la source d'acquisition est capturée.
 *
 * Run:  node --import tsx --test tests/analytics-source.test.cjs
 *
 * BUG CORRIGÉ (audit 2026-10-06)
 *
 * `src/lib/analytics.ts` déclarait `SOURCE_KEY = "hashcode:reboot:source"` et
 * l'exposait via `getSource()` — mais plus rien ne l'écrivait. `getOrCreateSource`,
 * seul écrivain, avait disparu du dépôt.
 *
 * Conséquence : `getSource()` renvoyait `"direct"` en toutes circonstances, et
 * cette valeur partait dans `POST /api/members` vers la colonne `Member.source`
 * — documentée dans `prisma/schema.prisma:66` comme
 * « utm_source/medium/campaign, e.g. "whatsapp/post?reboot" | "direct" ».
 *
 * La donnée n'était donc pas absente, elle était FAUSSE : tous les membres
 * étaient enregistrés comme « direct », quelle que soit leur origine.
 */

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// localStorage minimal, faithful sur le contrat lu par analytics.ts
function installStorage() {
  const store = new Map();
  globalThis.window = {
    location: { search: "" },
  };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
  return store;
}

let savedWindow;
let savedStorage;
let savedUrl;

beforeEach(() => {
  savedWindow = globalThis.window;
  savedStorage = globalThis.localStorage;
  savedUrl = globalThis.URLSearchParams;
  installStorage();
});

afterEach(() => {
  globalThis.window = savedWindow;
  globalThis.localStorage = savedStorage;
  globalThis.URLSearchParams = savedUrl;
});

// Le module lit `window` et `localStorage` au moment de l'appel, pas à
// l'import : on importe une fois pour toutes, la doublure est réinstallée
// avant chaque test.
const { getSource, captureSource } = require("../src/lib/analytics.ts");

describe("D40 — capture de la source d'acquisition", () => {
  test("sans paramètre UTM, la source reste « direct »", () => {
    assert.equal(captureSource(""), "direct");
    assert.equal(getSource(), "direct");
  });

  test("utm_source seul est capturé", () => {
    assert.equal(captureSource("?utm_source=whatsapp"), "whatsapp");
    assert.equal(getSource(), "whatsapp", "la source doit être persistée, pas seulement retournée");
  });

  test("source et medium sont combinés avec « / »", () => {
    // Format conforme à l'exemple du schéma : "whatsapp/post?reboot"
    assert.equal(captureSource("?utm_source=whatsapp&utm_medium=post"), "whatsapp/post");
  });

  test("la campagne est ajoutée après « ? »", () => {
    assert.equal(
      captureSource("?utm_source=whatsapp&utm_medium=post&utm_campaign=reboot"),
      "whatsapp/post?reboot",
      "doit reproduire exactement l'exemple de prisma/schema.prisma:66",
    );
  });

  test("la source est la SEULE paramètre requis", () => {
    assert.equal(captureSource("?utm_medium=post&utm_campaign=reboot"), "direct");
    assert.equal(captureSource("?utm_campaign=reboot"), "direct");
  });

  test("une source déjà capturée n'est pas écrasée", () => {
    // Garde-fou important : la première visite est la bonne. Un visiteur d'une
    // campagne ne doit pas voir son origine écrasée par un `?share=` ou une
    // relance.
    captureSource("?utm_source=whatsapp&utm_medium=post");
    assert.equal(captureSource("?utm_source=linkedin"), "whatsapp/post");
    assert.equal(getSource(), "whatsapp/post");
  });

  test("l'absence de source ne verrouille pas « direct » définitivement", () => {
    // visits sans UTM, puis une campagne : la capture doit rester possible.
    assert.equal(captureSource(""), "direct");
    assert.equal(captureSource("?utm_source=email"), "email");
  });

  test("les espaces et la casse sont gérés sans casser la donnée", () => {
    assert.equal(captureSource("?utm_source=%20WhatsApp%20"), "WhatsApp");
  });

  test("les caractères hors alphabet de source sont retirés", () => {
    // La valeur part en base : une chaîne non bornée autoriserait d'y glisser un
    // contenu arbitraire.
    const v = captureSource("?utm_source=<script>alert(1)</script>");
    assert.ok(!/[<>]/.test(v), `caractères de balisage conservés : "${v}"`);
    assert.ok(v.length <= 40, `longueur non bornée : ${v.length}`);
  });

  test("chaque segment est borné en longueur", () => {
    const long = "x".repeat(200);
    const v = captureSource(`?utm_source=${long}&utm_medium=${long}&utm_campaign=${long}`);
    assert.ok(v.length <= 40 + 1 + 40 + 1 + 40, `dépassement : ${v.length}`);
  });

  test("hors navigateur, la source est « direct » (SSR)", () => {
    globalThis.window = undefined;
    assert.equal(captureSource("?utm_source=whatsapp"), "direct");
    assert.equal(getSource(), "direct");
  });
});

describe("D40 — la valeur persistée est celle qui part en base", () => {
  test("captureSource() sans argument lit window.location.search", () => {
    globalThis.window.location.search = "?utm_source=qr&utm_medium=print";
    assert.equal(captureSource(), "qr/print");
  });

  test("getSource() relit exactement ce que captureSource a écrit", () => {
    const captured = captureSource("?utm_source=qr&utm_medium=print&utm_campaign=spring");
    assert.equal(getSource(), captured, "lecture et écriture doivent être cohérentes");
  });
});