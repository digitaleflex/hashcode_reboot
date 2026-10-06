/**
 * Non-regression D25 — la distinction 401 / 403 vue du NAVIGATEUR.
 *
 * Run:  node --import tsx --test tests/admin-client-d25.test.cjs
 *
 * POURQUOI CE TEST EXISTE
 *
 * D24 a corrigé le contrat SERVEUR : `requireAdmin` distingue désormais
 *   - 401 `AUTH_REQUIRED`  : aucune session admin
 *   - 403 `FORBIDDEN`      : session valide, rôle insuffisant
 *
 * Mais le contrat n'est clos que si le CLIENT le respecte aussi. Mesure avant
 * refactor : 31 sites `status === 401` dans 20 fichiers côté admin, et le
 * dashboard traitait 401 comme « session expirée » en ne regardant que le
 * statut — donc un 403 « rôle insuffisant » partait vers la page de connexion
 * alors que la session était parfaitement valide.
 *
 * Le cas le plus net était `TestEmailPanel.tsx:26`, qui fusionnait les deux
 * explicitement :
 *
 *   if (res.status === 401 || code === "UNAUTHORIZED" || res.status === 403)
 *     onSessionExpired();
 *
 * Conséquence pour un viewer légitime : on le déconnecte de l'admin sur une
 * page qu'il a le droit de lire. S'il reclique, il est redirigé à nouveau,
 * indéfiniment.
 *
 * Ces tests verrouillent la DÉCISION, pas l'implémentation : ils importent le
 * vrai `classifyAdminResponse` et le vrai `resolveAdminVerdict`, et vérifient
 * que le verdict 403 ne déclenche aucune redirection.
 */

"use strict";

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyAdminResponse,
  appendRetryAfter,
  DEFAULT_FORBIDDEN_MESSAGE,
} = require("../src/lib/admin-client.ts");

/* ------------------------------------------------------------------ */
/* Faux environnement navigateur : on observe ce que le client demande */
/* ------------------------------------------------------------------ */

/** Chaque appel à location.href est enregistré ici. */
let navigations = [];
const savedLocation = globalThis.window;

/**
 * `resolveAdminVerdict` ne teste que `typeof window`. On installe un
 * `window.location` minimal et on enregistre les redirections, ce qui permet
 * d'affirmer qu'un 403 n'en produit aucune.
 */
function installWindow() {
  navigations = [];
  globalThis.window = {
    get location() {
      return {
        set href(value) {
          navigations.push(value);
        },
        get href() {
          return navigations[navigations.length - 1];
        },
      };
    },
  };
}

function uninstallWindow() {
  if (savedLocation === undefined) delete globalThis.window;
  else globalThis.window = savedLocation;
}

/* ------------------------------------------------------------------ */
/* 1. Le verdict : 401 et 403 sont deux choses différentes             */
/* ------------------------------------------------------------------ */

describe("D25 — classifyAdminResponse distingue 401 et 403", () => {
  test("401 AUTH_REQUIRED = session absente (verdict unauthorized)", () => {
    const v = classifyAdminResponse({ status: 401, code: "AUTH_REQUIRED" });
    assert.equal(v.kind, "unauthorized");
  });

  test("401 UNAUTHORIZED (code historique) reste unauthorized", () => {
    // Les routes non migrees par D24 lancent encore AuthError(..., "UNAUTHORIZED").
    const v = classifyAdminResponse({ status: 401, code: "UNAUTHORIZED" });
    assert.equal(v.kind, "unauthorized");
  });

  test("403 FORBIDDEN = acces refuse, PAS unauthorized", () => {
    // L'assertion centrale de D25.
    const v = classifyAdminResponse({
      status: 403,
      code: "FORBIDDEN",
      error: "Accès refusé.",
    });
    assert.equal(v.kind, "forbidden");
    assert.notEqual(v.kind, "unauthorized");
  });

  test("403 sans code reste forbidden", () => {
    // Les routes admin répondent encore `{ status: 403 }` nu pour le CSRF.
    const v = classifyAdminResponse({ status: 403, error: "CSRF validation failed." });
    assert.equal(v.kind, "forbidden");
  });

  test("le statut prime sur le code : un 403 code UNAUTHORIZED reste forbidden", () => {
    // Garde-fou d'ordre. Si le code pouvait lever un 403 au rang de « session
    // expirée », la régression D24 renterait par la porte du `code`.
    const v = classifyAdminResponse({ status: 403, code: "UNAUTHORIZED" });
    assert.equal(v.kind, "forbidden");
  });

  test("le message 403 du serveur est conservé tel quel", () => {
    const v = classifyAdminResponse({ status: 403, error: "Accès refusé." });
    assert.equal(v.message, "Accès refusé.");
  });

  test("403 sans message : repli sur le refus, pas sur « Erreur de chargement. »", () => {
    const v = classifyAdminResponse({ status: 403 });
    assert.equal(v.message, DEFAULT_FORBIDDEN_MESSAGE);
    assert.notEqual(
      v.message,
      "Erreur de chargement.",
      "un refus de rôle ne doit pas ressembler à une panne",
    );
  });

  test("un 403 ne propose PAS de message de session expirée", () => {
    const v = classifyAdminResponse({ status: 403 });
    assert.ok(
      !/expir/i.test(v.message ?? ""),
      "un refus ne doit jamais parler de session expirée",
    );
  });

  test("429 RATE_LIMITED = rateLimited, avec le Retry-After", () => {
    const v = classifyAdminResponse({
      status: 429,
      code: "RATE_LIMITED",
      error: "Trop de demandes.",
      retryAfterSec: 30,
    });
    assert.equal(v.kind, "rateLimited");
    assert.match(v.message, /30/);
  });

  test("200 = ok", () => {
    assert.equal(classifyAdminResponse({ status: 200 }).kind, "ok");
  });

  test("500 = error avec le message du serveur", () => {
    const v = classifyAdminResponse({ status: 500, error: "Erreur interne." });
    assert.equal(v.kind, "error");
    assert.equal(v.message, "Erreur interne.");
  });

  test("appendRetryAfter est sans effet sans Retry-After", () => {
    assert.equal(appendRetryAfter("Base.", null), "Base.");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Le comportement : seul le 401 redirige                          */
/* ------------------------------------------------------------------ */

describe("D25 — resolveAdminVerdict : le 403 ne redirige pas", () => {
  beforeEach(installWindow);
  afterEach(uninstallWindow);

  /**
   * `adminQuery.ts` est un module `"use client"` : on l'importe tel quel, le
   * marqueur de directive n'a aucune incidence sur `require`. Il tire React et
   * React Query, tous deux présents — on veut le VRAI code de redirection, pas
   * une réimplémentation.
   */
  const { resolveAdminVerdict, ADMIN_SIGNIN_URL } = require(
    "../src/components/reboot/admin/lib/adminQuery.ts",
  );

  test("401 déclenche exactement une redirection vers la connexion", () => {
    resolveAdminVerdict({ status: 401, code: "AUTH_REQUIRED" });
    assert.deepEqual(navigations, [ADMIN_SIGNIN_URL]);
  });

  test("403 ne déclenche AUCUNE redirection", () => {
    // C'est le bug D24, côté navigateur. Avant : le 403 partait vers /?admin=1.
    const verdict = resolveAdminVerdict({
      status: 403,
      code: "FORBIDDEN",
      error: "Accès refusé.",
    });
    assert.equal(verdict.kind, "forbidden");
    assert.deepEqual(navigations, [], "un 403 ne doit jamais rediriger");
  });

  test("403 nu (CSRF) ne déclenche AUCUNE redirection", () => {
    resolveAdminVerdict({ status: 403, error: "CSRF validation failed." });
    assert.deepEqual(navigations, []);
  });

  test("429 ne déclenche aucune redirection non plus", () => {
    resolveAdminVerdict({ status: 429, code: "RATE_LIMITED", retryAfterSec: 10 });
    assert.deepEqual(navigations, []);
  });

  test("500 ne déclenche aucune redirection", () => {
    resolveAdminVerdict({ status: 500, error: "Erreur interne." });
    assert.deepEqual(navigations, []);
  });

  test("200 ne déclenche aucune redirection et renvoie ok", () => {
    const verdict = resolveAdminVerdict({ status: 200 });
    assert.equal(verdict.kind, "ok");
    assert.deepEqual(navigations, []);
  });

  test("une seule stratégie de redirection : plus de /?admin=1", () => {
    resolveAdminVerdict({ status: 401 });
    assert.equal(navigations[0], ADMIN_SIGNIN_URL);
    assert.ok(
      !navigations[0].includes("admin=1"),
      "D33 a tranché : ?admin=1 est un alias, la destination est la connexion",
    );
  });

  test("la redirection 401 est neutralisable, le 403 reste sans effet", () => {
    resolveAdminVerdict({ status: 401 }, { noRedirectOnUnauthorized: true });
    assert.deepEqual(navigations, [], "le drapeau coupe bien le 401");

    resolveAdminVerdict({ status: 403, error: "Accès refusé." }, { noRedirectOnUnauthorized: true });
    assert.deepEqual(navigations, [], "et le 403 reste muet dans tous les cas");
  });
});

/* ------------------------------------------------------------------ */
/* 3. adminRequest : le contrat vu par un composant                    */
/* ------------------------------------------------------------------ */

describe("D25/D32 — adminRequest fait passer le signal et lève typé", () => {
  const {
    adminRequest,
    AdminRequestError,
    isForbiddenError,
    isRateLimitedError,
    adminErrorMessage,
  } = require("../src/components/reboot/admin/lib/adminQuery.ts");

  /** Réponse `fetch` minimale, en JSON. */
  function jsonResponse(status, body, headers = {}) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  }

  let savedFetch;
  beforeEach(() => {
    savedFetch = globalThis.fetch;
    installWindow();
  });
  afterEach(() => {
    globalThis.fetch = savedFetch;
    uninstallWindow();
  });

  test("200 renvoie la charge utile parsée", async () => {
    globalThis.fetch = async () => jsonResponse(200, { ok: true, total: 3 });
    assert.deepEqual(await adminRequest("/api/x"), { ok: true, total: 3 });
  });

  test("D32 : le signal de la query est transmis au fetch", async () => {
    // C'est ce qui rend l'annulation automatique possible : sans lui, un
    // `useQuery` ne pourrait pas annuler la requête au changement de clé.
    const ctrl = new AbortController();
    let received = null;
    globalThis.fetch = async (_url, init) => {
      received = init?.signal ?? null;
      return jsonResponse(200, { ok: true });
    };
    await adminRequest("/api/x", { signal: ctrl.signal });
    assert.equal(received, ctrl.signal, "le signal doit arriver au fetch");
  });

  test("403 lève une AdminRequestError « forbidden », sans rediriger", async () => {
    globalThis.fetch = async () =>
      jsonResponse(403, { error: "Accès refusé.", code: "FORBIDDEN" });
    await assert.rejects(
      adminRequest("/api/x"),
      (e) => {
        assert.ok(e instanceof AdminRequestError);
        assert.equal(e.kind, "forbidden");
        assert.equal(e.status, 403);
        assert.equal(e.message, "Accès refusé.");
        return true;
      },
    );
    assert.deepEqual(navigations, [], "un 403 ne doit toujours pas rediriger");
  });

  test("403 sans message serveur retombe sur « Accès refusé. »", async () => {
    globalThis.fetch = async () => jsonResponse(403, {});
    await assert.rejects(adminRequest("/api/x"), (e) => {
      assert.equal(e.message, "Accès refusé.");
      return true;
    });
  });

  test("429 lève une AdminRequestError « rateLimited » avec le Retry-After", async () => {
    globalThis.fetch = async () =>
      jsonResponse(429, { error: "Trop de requêtes.", code: "RATE_LIMITED" }, { "Retry-After": "42" });
    await assert.rejects(adminRequest("/api/x"), (e) => {
      assert.ok(isRateLimitedError(e));
      assert.equal(e.retryAfterSec, 42);
      assert.match(e.message, /42/);
      return true;
    });
    assert.deepEqual(navigations, []);
  });

  test("401 redirige ET lève (on ne rend pas de donnée périmée)", async () => {
    globalThis.fetch = async () =>
      jsonResponse(401, { error: "Authentification requise.", code: "AUTH_REQUIRED" });
    await assert.rejects(adminRequest("/api/x"));
    assert.equal(navigations.length, 1, "une redirection, puis on stoppe le rendu");
  });

  test("le fallbackMessage sert quand le serveur n'envoie pas d'erreur", async () => {
    globalThis.fetch = async () => jsonResponse(500, {});
    await assert.rejects(adminRequest("/api/x", undefined, { fallbackMessage: "Panne custom." }), (e) => {
      assert.equal(e.message, "Panne custom.");
      return true;
    });
  });

  test("les aides de tri classent bien les trois natures d'erreur", async () => {
    globalThis.fetch = async () => jsonResponse(403, { error: "Accès refusé." });
    await assert.rejects(adminRequest("/api/x"), (e) => {
      assert.equal(isForbiddenError(e), true);
      assert.equal(isRateLimitedError(e), false);
      assert.equal(adminErrorMessage(e), "Accès refusé.");
      return true;
    });
  });
});
