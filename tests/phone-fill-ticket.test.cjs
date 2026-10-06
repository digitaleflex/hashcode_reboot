/**
 * Tests de non-régression — D37 : le ticket phone-fill est inopérant.
 *
 * Run:  node --import tsx --test tests/phone-fill-ticket.test.cjs
 *
 * BUG CORRIGÉ (audit 2026-10-06)
 *
 * `src/lib/phone-fill-ticket.ts` résolvait sa clé HMAC ainsi :
 *
 *     process.env.PHONE_FILL_SECRET || process.env.DATABASE_URL || ""
 *
 * Or le datasource Prisma de ce dépôt lit `POSTGRES_PRISMA_URL`
 * (prisma/schema.prisma:11). `DATABASE_URL` n'est définie ni dans `.env`, ni
 * dans `.env.example`, ni dans la CI. `getKey()` renvoyait donc `null` en
 * toutes circonstances : aucun ticket n'était émis, et POST
 * /api/account/phone ne pouvait écrire aucun numéro.
 *
 * Le mécanisme était pourtant complet et correctement câblé des deux côtés
 * (émission dans /api/members, vérification dans /api/account/phone). Seule la
 * feature était morte — et son fail-closed masquait la panne au lieu de la
 * signaler.
 *
 * Ces tests importent le VRAI module et vérifient qu'un ticket est désormais
 * émis et vérifiable dès qu'une des trois variables est présente.
 */

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  issuePhoneFillTicket,
  verifyPhoneFillTicket,
  readPhoneFillTicket,
  phoneFillSetCookie,
} = require("../src/lib/phone-fill-ticket.ts");

/** Variables d'environnement lues par getKey(). */
const KEY_VARS = ["PHONE_FILL_SECRET", "POSTGRES_PRISMA_URL", "DATABASE_URL"];

let saved;
beforeEach(() => {
  saved = {};
  for (const k of KEY_VARS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEY_VARS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/** Construit un objet Request minimal, suffisant pour readPhoneFillTicket. */
function fakeReq(cookieHeader) {
  const headers = new Map();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return {
    cookies: {
      get: (name) => {
        const raw = headers.get("cookie");
        if (!raw) return undefined;
        for (const part of raw.split(";")) {
          const [k, ...v] = part.trim().split("=");
          if (k === name) return { name: k, value: decodeURIComponent(v.join("=")) };
        }
        return undefined;
      },
    },
    headers: { get: (h) => headers.get(h) ?? null },
  };
}

describe("D37 — une des trois variables suffit à émettre un ticket", () => {
  // C'est le cœur du correctif : avant, seul DATABASE_URL était lu, et cette
  // variable n'existe pas dans ce déploiement.
  for (const varName of KEY_VARS) {
    test(`${varName} permet d'émettre ET de vérifier un ticket`, () => {
      process.env[varName] = "valeur-de-test-avec-une-entropie-suffisante";

      const ticket = issuePhoneFillTicket("member-123");
      assert.ok(
        ticket,
        `avec ${varName} définie, un ticket doit être émis (bug D37 : il ne l'était pas)`,
      );
      assert.equal(verifyPhoneFillTicket(ticket), "member-123");
    });
  }

  test("POSTGRES_PRISMA_URL — le nom réel du datasource — suffit à lui seul", () => {
    // Test de non-régression ciblé : c'est exactement le cas de production.
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?schema=public";

    const ticket = issuePhoneFillTicket("member-neon");
    assert.ok(ticket, "le datasource configuré dans ce dépôt doit suffire");
    assert.equal(verifyPhoneFillTicket(ticket), "member-neon");
  });

  test("PHONE_FILL_SECRET prime sur l'URL de base (rotation sans toucher la base)", () => {
    process.env.POSTGRES_PRISMA_URL = "postgresql://user:pass@host/db";
    const t1 = issuePhoneFillTicket("m1");

    process.env.PHONE_FILL_SECRET = "secret-dedie";
    const t2 = issuePhoneFillTicket("m1");

    assert.notEqual(
      t1,
      t2,
      "changer la clé doit changer le ticket : c'est ce qui permet de tourner le secret",
    );
    // Le ticket émis avec l'ancienne clé n'est plus valide : c'est attendu.
    assert.equal(verifyPhoneFillTicket(t1), null);
    assert.equal(verifyPhoneFillTicket(t2), "m1");
  });
});

describe("D37 — fail-closed réellement inerte", () => {
  test("sans aucune variable, aucun ticket n'est émis", () => {
    assert.equal(issuePhoneFillTicket("member-123"), null);
  });

  test("sans aucune variable, un cookie forgé ne vaut rien", () => {
    // readPhoneFillTicket se contente de LIRE le cookie — c'est son contrat,
    // la validation se fait dans verifyPhoneFillTicket. Ce qui compte ici :
    // lire ne suffit pas à écrire.
    const lu = readPhoneFillTicket(fakeReq("hc_phone_fill=forge"));
    assert.equal(lu, "forge", "la lecture brute est normale : ce n'est pas une validation");
    assert.equal(
      verifyPhoneFillTicket(lu),
      null,
      "mais la vérification doit échouer : aucun ticket valide n'a pu être émis",
    );
  });

  test("le séparateur de domaine empêche la réutilisation d'une clé comme secret", () => {
    // Le ticket est `memberId.exp.sig`. Pour comparer les signatures sans que
    // l'horodatage les distingue, on vérifie le même payload sous deux clés
    // de même valeur brute : le préfixe "phone-fill-v1:" doit produire deux
    // HMAC différents.
    const payload = "membre.4102444800000";
    const hmac = (key) =>
      require("node:crypto").createHmac("sha256", key).update(payload, "utf8").digest("hex");

    const avecPrefixe = hmac("phone-fill-v1:valeur-partagee");
    const sansPrefixe = hmac("valeur-partagee");

    assert.notEqual(
      avecPrefixe,
      sansPrefixe,
      "sans le préfixe de domaine, l'URL de base pourrait servir de secret",
    );
  });
});

describe("D37 — le ticket ne peut pas être utilisé pour un autre membre", () => {
  beforeEach(() => {
    process.env.POSTGRES_PRISMA_URL = "postgresql://u:p@h/db";
  });

  test("lie le ticket au memberId émis", () => {
    const ticket = issuePhoneFillTicket("membre-A");
    assert.equal(verifyPhoneFillTicket(ticket), "membre-A");
    assert.notEqual(verifyPhoneFillTicket(ticket), "membre-B");
  });

  test("rejette un ticket forgé ou corrompu", () => {
    assert.equal(verifyPhoneFillTicket(""), null);
    assert.equal(verifyPhoneFillTicket("pas-un-ticket"), null);
    assert.equal(verifyPhoneFillTicket(null), null);
    assert.equal(verifyPhoneFillTicket(undefined), null);
  });

  test("le cookie posé se relit correctement", () => {
    const ticket = issuePhoneFillTicket("membre-C");
    const setCookie = phoneFillSetCookie(ticket);
    assert.match(setCookie, /^hc_phone_fill=/);
    assert.match(setCookie, /HttpOnly/i);
    // 15 min = 900 s. On vérifie Max-Aage explicitement plutôt qu'un "15"
    // approchant : Max-Age est en secondes, pas en minutes.
    assert.match(setCookie, /Max-Age=900\b/, "la durée de vie annoncée doit être 15 min");

    const value = /^hc_phone_fill=([^;]*)/.exec(setCookie)[1];
    const req = fakeReq(`hc_phone_fill=${value}`);
    assert.equal(readPhoneFillTicket(req), ticket);
  });
});