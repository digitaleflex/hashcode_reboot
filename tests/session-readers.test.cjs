/**
 * Garde anti-régression — lecteurs de sessions (export RGPD + DAU admin).
 *
 * Contexte (D36, retrouvé le 2026-11-13) : après la bascule Better Auth, la
 * table applicative `MemberSession` n'est plus écrite (0 écriture, cf.
 * prisma/schema.prisma). Deux lecteurs la lisaient encore et rendaient donc
 * des résultats *silencieusement faux* :
 *
 *   1. GET /api/account/export        → `sessions: []` systématique
 *      (le membre demandait ses données, on répondait « aucune session »)
 *   2. GET /api/admin/activity-logins → DAU toujours à 0, affiché comme un
 *      vrai chiffre dans le tableau de bord admin
 *
 * La source de vérité est la table Better Auth `Session` (`updatedAt` est
 * rafraîchi à chaque requête authentifiée, `expiresAt > NOW()` remplace
 * l'absence de colonne de révocation puisque la ligne est supprimée à la
 * déconnexion).
 *
 * Ces tests lisent les sources (pas de serveur, pas de DB) : ils échouent si
 * un `memberSession` réapparaît dans ces deux routes, où si le `token` de
 * session (le secret qui authentifie le cookie) se retrouve dans l'export.
 *
 * Run: prod  npm run test:session-readers
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("lecteurs de sessions : `Session` (Better Auth), jamais `MemberSession`", () => {
  test("export RGPD : lit db.session filtré par user.email, sans token", () => {
    const src = read("src/app/api/account/export/route.ts");

    assert.ok(
      src.includes("db.session.findMany"),
      "l'export doit lire db.session (table Better Auth)",
    );
    assert.ok(
      !src.includes("db.memberSession"),
      "db.memberSession ne doit plus être lu (table non écrite → sessions: [])",
    );
    assert.ok(
      src.includes("user: { email }"),
      "Session.userId pointe sur User : le filtre doit passer par user.email",
    );
    assert.ok(
      !/select:\s*\{[^}]*\btoken\b/.test(src),
      "`token` est le secret du cookie de session : jamais exporté",
    );
    assert.ok(
      src.includes("updatedAt: true"),
      "métadonnées utiles : updatedAt remplace lastSeenAt (inexistant sur Session)",
    );
  });

  test("DAU admin : SQL brut + groupBy sur Session.userId", () => {
    const src = read("src/app/api/admin/activity-logins/route.ts");

    assert.ok(
      !src.includes("db.memberSession") && !src.includes('FROM "MemberSession"'),
      "le DAU ne doit plus interroger MemberSession (toujours 0)",
    );
    assert.ok(
      src.includes('FROM "Session"'),
      "le SQL brut doit lire la table Session",
    );
    assert.ok(
      src.includes('COUNT(DISTINCT "userId")'),
      "on compte des membres (userId), pas des appareils",
    );
    assert.ok(
      src.includes('"expiresAt" > NOW()'),
      "session active = expiresAt dans le futur (pas de colonne de révocation)",
    );
    assert.ok(
      src.includes("db.session.groupBy"),
      "distinct30 doit être calculé sur db.session",
    );
  });
});
