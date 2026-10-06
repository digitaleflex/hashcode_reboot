/**
 * Unit tests - D36 : basculement des deux lecteurs de `MemberSession` vers
 * `Session` (Better Auth).
 *
 * Run:  node --import tsx --test tests/dead-tables-d36.test.cjs
 *
 * --- LE PROBLEME ------------------------------------------------------------
 * `MemberSession` etait un doublon residuel de l'ere pre-Better Auth, sans
 * AUCUN ecrivain applicatif. Ses deux lecteurs lisaient donc une table vide et
 * renvoyaient des resultats faux, en silence :
 *
 *   1. `GET /api/admin/activity-logins` -> DAU a 0, affiche comme un chiffre.
 *   2. `GET /api/account/export`         -> `sessions: []`, donc un export
 *      RGPD incomplet : le membre demande ses donnees, le systeme lui repond
 *      qu'il n'a aucune session alors que `Session` en contient.
 *
 * --- CE QUE CE FICHIER VERROUILLE --------------------------------------------
 * Le point de SECURITE du basculement (2) : `Session.userId` reference `User`,
 * pas `Member`. Une route qui lirait `db.session` sans rattacher la session au
 * membre authentique sortirait les sessions de TOUT le monde. C'est le test
 * central ci-dessous, et il execute la clause `where` reellement passee par la
 * route contre une table qui contient les sessions des DEUX membres.
 *
 * Methode : la VRAIE route est importee et appelee. Seule la frontiere est
 * doublee - `auth.api.getSession` (resolution Better Auth), les methodes du
 * client Prisma, et `next/headers` (le handler appelle `getSession()` sans
 * argument, donc sans `NextRequest`). Aucun miroir : ni le `where`, ni le
 * `select`, ni `buildExportPayload` ne sont reimplementes cote test. La
 * doublure `db.session.findMany` n'ignore pas une relation non geree : elle
 * leve, donc un `where` qui ne filtrerait pas le proprietaire echouerait ici.
 *
 * NON teste ici, et pour cause :
 *  - le SQL brut de `activity-logins` n'est pas execute (il faut Postgres pour
 *    ca). Ce fichier verifie le TEXTE de la requete et verifie que le mapping
 *    jour/compteurs produit bien une serie non nulle a partir de lignes
 *    reelles. Le round-trip SQL n'est couvert nulle part dans le repo.
 *  - la migration `drop_dead_tables` n'est pas executee contre une base : aucune
 *    base de test n'est disponible dans cet environnement.
 */

"use strict";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "d36-test-secret-at-least-32-characters-long";
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * Source SANS les commentaires.
 *
 * Indispensable ici : ce fichier verifie notamment que `lastSeenAt` /
 * `revokedAt` ont disparu de la route et que `Member` n'a plus de relation
 * `sessions`. Or le fichier DOIT les mentionner en commentaire, puisque c'est
 * l'explication du choix de `updatedAt` / `expiresAt` qui est demandee. Sans
 * cette separation, les deux exigences s'annulent.
 */
function readCode(p) {
  return read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const EXPORT_ROUTE = "src/app/api/account/export/route.ts";
const ACTIVITY_ROUTE = "src/app/api/admin/activity-logins/route.ts";
const MIGRATION = "prisma/migrations/20261006150000_drop_dead_tables/migration.sql";

// --- LE JEU DE DONNEES ------------------------------------------------------
//
// DEUX membres, chacun avec son `User` Better Auth et ses sessions. Le membre
// connecte est `MOI` ; `AUTRE` est un tiers qui ne demandera jamais cet export.

const MOI = { email: "moi@test.invalid", userId: "u_moi", memberId: "m_moi" };
const AUTRE = { email: "autre@test.invalid", userId: "u_autre", memberId: "m_autre" };

/** Colonnes de `Session`, telles que le schema les declare. */
const SESSION_COLUMNS = [
  "id",
  "expiresAt",
  "token",
  "createdAt",
  "updatedAt",
  "ipAddress",
  "userAgent",
  "userId",
];

/** `days` dans le passe -> Date. Les dates sont relatives a "maintenant". */
function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

function session(over) {
  return {
    id: over.id,
    userId: over.userId,
    token: `secret-token-${over.id}`,
    ipAddress: over.ip ?? null,
    userAgent: over.userAgent ?? null,
    createdAt: daysAgo(over.createdDaysAgo),
    updatedAt: daysAgo(over.updatedDaysAgo),
    expiresAt: daysAgo(over.expiresInDays),
  };
}

/**
 * Contenu de la table `Session`. Chaque ligne porte son `userId`, donc son
 * proprietaire reel : c'est exactement ce que le `where` de la route doit
 * selectionner.
 *
 * Les dates sont relatives a maintenant, sinon la serie du DAU deviendrait nulle
 * avec le temps et le test passerait au vert sur une route qui ne lit rien.
 */
const SESSION_TABLE = [
  // Deux sessions de MOI (deux appareils), toutes deux dans la fenetre 7j, plus
  // une session hors fenetre 30j et une expiree.
  session({
    id: "s_moi_1",
    userId: MOI.userId,
    ip: "10.0.0.1",
    userAgent: "Mozilla/5.0 (macOS)",
    createdDaysAgo: 5,
    updatedDaysAgo: 2,
    expiresInDays: -36500,
  }),
  session({
    id: "s_moi_2",
    userId: MOI.userId,
    ip: "10.0.0.2",
    userAgent: "Mozilla/5.0 (iPhone)",
    createdDaysAgo: 1,
    updatedDaysAgo: 0,
    expiresInDays: -36500,
  }),
  session({
    id: "s_moi_ancienne",
    userId: MOI.userId,
    ip: "10.0.0.3",
    userAgent: "Mozilla/5.0 (Windows)",
    createdDaysAgo: 45,
    updatedDaysAgo: 40,
    expiresInDays: -36500,
  }),
  session({
    id: "s_moi_expiree",
    userId: MOI.userId,
    ip: "10.0.0.4",
    userAgent: "Mozilla/5.0 (Android)",
    createdDaysAgo: 200,
    updatedDaysAgo: 199,
    expiresInDays: 30,
  }),
  // Une session d'un autre membre. Elle ne doit JAMAIS sortir d'un export.
  session({
    id: "s_autre_1",
    userId: AUTRE.userId,
    ip: "203.0.113.7",
    userAgent: "Mozilla/5.0 (Linux; Windows NT 10.0)",
    createdDaysAgo: 3,
    updatedDaysAgo: 1,
    expiresInDays: -36500,
  }),
];

/** Un `User` minimal, indexe par email (c'est par email que la route filtre). */
const USER_BY_EMAIL = new Map([
  [MOI.email, { id: MOI.userId, email: MOI.email }],
  [AUTRE.email, { id: AUTRE.userId, email: AUTRE.email }],
]);

// --- UN PRISMA RELATIONNEL MINIMAL, MAIS HONNETE ----------------------------
//
// Il execute reellement le `where` recu. Une relation non geree n'est PAS
// ignoree silencieusement : la doublure leve. C'est ce qui fait que ce fichier
// detecterait une fuite au lieu de la valider.

/** Simule le JOIN + filtre relationnel de Prisma sur une relation 1-n. */
function rowsForOwner(whereUser, rows) {
  if (whereUser === undefined) return rows;
  const wanted =
    typeof whereUser === "string"
      ? whereUser
      : whereUser && typeof whereUser.email === "string"
        ? whereUser.email
        : null;
  if (wanted === null) {
    throw new Error(
      "doublure : filtre de relation `user` non gere -> " + JSON.stringify(whereUser),
    );
  }
  const user = USER_BY_EMAIL.get(wanted);
  if (!user) return [];
  return rows.filter((r) => r.userId === user.id);
}

let db;
let auth;
let exportRoute;
let activityRoute;
let realAuthGetSession;
const savedPrisma = {};
const savedEnv = {};

/** Journal du dernier `where` vu par `db.session.findMany`. */
let seenSessionWhere;
/** Membre que l'on fait passer pour authentifie. `null` = aucune session. */
let authenticated;

function useFakeDb({ memberEmails = [MOI.email] } = {}) {
  auth.api.getSession = async () =>
    authenticated
      ? {
          user: { id: authenticated.userId, email: authenticated.email },
          session: {
            id: `sess_${authenticated.userId}`,
            userId: authenticated.userId,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          },
        }
      : null;

  // La route export résout le membre par `id` (session -> member), et
  // `account-auth.ts` le résout par `email`. On accepte les deux, comme la base.
  db.member.findUnique = async (args) => {
    const wanted = args?.where?.id ?? args?.where?.email;
    const who = [MOI, AUTRE].find((m) => m.memberId === wanted || m.email === wanted);
    if (!who || !memberEmails.includes(who.email)) return null;
    return {
      id: who.memberId,
      email: who.email,
      firstName: "Moi",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };
  };
  db.memberBlacklist.findUnique = async () => null;

  // Les autres lectures de l'export : vides, sans effet sur le sujet.
  for (const model of [
    "eventRsvp",
    "workshopEnrollment",
    "workshopSubmission",
    "workshopQuizAttempt",
    "memberEmailLog",
  ]) {
    db[model].findMany = async () => [];
  }
  db.profilingDraft.findUnique = async () => null;
  db.analyticsEvent.findMany = async () => [];

  db.session.findMany = async (args = {}) => {
    const { select, orderBy, where } = args;
    seenSessionWhere = where;
    let rows = rowsForOwner(where?.user, SESSION_TABLE);
    if (where?.userId !== undefined) {
      rows = rows.filter((r) => r.userId === where.userId);
    }
    if (orderBy?.updatedAt) rows = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!select) return rows;
    const unknown = Object.keys(select).filter((k) => !SESSION_COLUMNS.includes(k));
    if (unknown.length) {
      throw new Error("doublure : colonne inconnue dans le select -> " + unknown.join(","));
    }
    return rows.map((r) => {
      const out = {};
      for (const [k, want] of Object.entries(select)) if (want) out[k] = r[k];
      return out;
    });
  };

  // `groupBy({ by: ["userId"], where })` : une ligne par proprietaire distinct.
  db.session.groupBy = async (args = {}) => {
    const { by, where } = args;
    if (!Array.isArray(by) || by.length !== 1) {
      throw new Error("doublure : groupBy sur " + JSON.stringify(by) + " non gere");
    }
    const cutoff = where?.updatedAt?.gte instanceof Date ? where.updatedAt.gte : null;
    const notExpired = where?.expiresAt?.gt instanceof Date ? where.expiresAt.gt : null;
    const rows = SESSION_TABLE.filter(
      (r) =>
        (!cutoff || r.updatedAt >= cutoff) && (!notExpired || r.expiresAt > notExpired),
    );
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (seen.has(r[by[0]])) continue;
      seen.add(r[by[0]]);
      out.push({ [by[0]]: r[by[0]] });
    }
    return out;
  };

  // Le SQL brut n'est pas executable sans Postgres. On rend le resultat que la
  // requete decrit, a partir des MEMES lignes, pour verifier le mapping jour ->
  // compteurs. Le contenu du SQL est verifie separement, sur son texte.
  db.$queryRaw = async () => {
    const byDay = new Map();
    for (const r of SESSION_TABLE) {
      if (r.expiresAt <= new Date()) continue;
      const day = r.updatedAt.toISOString().split("T")[0];
      if (!byDay.has(day)) byDay.set(day, new Set());
      byDay.get(day).add(r.userId);
    }
    return [...byDay.entries()]
      .map(([day, users]) => ({ day, active: BigInt(users.size) }))
      .sort((a, b) => a.day.localeCompare(b.day));
  };
}

/** Faux NextRequest : les routes ne lisent que `headers` et `url`. */
let ipCounter = 0;
function fakeReq() {
  ipCounter += 1;
  return {
    url: "http://localhost:3000/api/account/export",
    method: "GET",
    // IP unique par appel : chaque test a son propre seau de rate limit.
    headers: new Headers({ "x-forwarded-for": `10.99.0.${ipCounter % 250}` }),
  };
}

before(async () => {
  // `getSession()` est appelle SANS argument par la route export : il lit donc
  // `next/headers`. Hors requete Next, `headers()` leve et `getSession()`
  // renverrait `null`. On shime le module qui l'exporte reellement, AVANT tout
  // import de la route - sinon la session de test ne serait jamais resolue.
  const headersModule = require.resolve("next/dist/server/request/headers");
  require.cache[headersModule] = {
    id: headersModule,
    filename: headersModule,
    loaded: true,
    paths: [],
    exports: {
      headers: async () => new Headers({ cookie: "better-auth.session_token=fake" }),
    },
  };

  db = (await import("../src/lib/db.ts")).db;
  ({ auth } = await import("../src/lib/auth/index.ts"));
  realAuthGetSession = auth.api.getSession;

  savedPrisma.memberFindUnique = db.member.findUnique;
  savedPrisma.memberBlacklistFindUnique = db.memberBlacklist.findUnique;
  savedPrisma.sessionFindMany = db.session.findMany;
  savedPrisma.sessionGroupBy = db.session.groupBy;
  savedPrisma.queryRaw = db.$queryRaw;

  exportRoute = await import("../src/app/api/account/export/route.ts");
  activityRoute = await import("../src/app/api/admin/activity-logins/route.ts");
});

after(() => {
  auth.api.getSession = realAuthGetSession;
  db.member.findUnique = savedPrisma.memberFindUnique;
  db.memberBlacklist.findUnique = savedPrisma.memberBlacklistFindUnique;
  db.session.findMany = savedPrisma.sessionFindMany;
  db.session.groupBy = savedPrisma.sessionGroupBy;
  db.$queryRaw = savedPrisma.queryRaw;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  authenticated = MOI;
  seenSessionWhere = null;

  // Neutralise Redis : sans ces variables, `rateLimit()` bascule sur son
  // fallback memoire. Sinon le test parlerait au vrai Upstash de `.env`.
  // Refait dans `beforeEach` (et pas au top-level) car tsx charge `.env` a la
  // PREMIERE resolution de module, donc bien apres le top-level de ce fichier.
  for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
    savedEnv[k] = savedEnv[k] ?? process.env[k];
    delete process.env[k];
  }

  useFakeDb();
});

// --- 1. LE POINT DE SECURITE ------------------------------------------------

describe("D36 - GET /api/account/export : isolation des sessions (securite)", () => {
  test("l'export ne contient que les sessions du membre connecte", async () => {
    const res = await exportRoute.GET(fakeReq());
    assert.equal(res.status, 200, "l'export du membre authentifie doit reussir");

    const body = await res.json();
    assert.deepEqual(
      body.sessions.map((s) => s.id).sort(),
      ["s_moi_1", "s_moi_2", "s_moi_ancienne", "s_moi_expiree"],
      "l'export doit contenir exactement les sessions du membre connecte",
    );
  });

  test("aucune session d'un AUTRE membre n'est exposee", async () => {
    const res = await exportRoute.GET(fakeReq());
    assert.equal(res.status, 200);
    const body = await res.json();

    // L'invariant de securite, verifie sur les identifiants ET sur les
    // metadonnees identifiantes (une IP ou un user-agent suffisent a identifier).
    for (const s of body.sessions) {
      assert.notEqual(s.id, "s_autre_1", "session d'un autre membre exposee");
      assert.notEqual(s.ipAddress, "203.0.113.7", "IP d'un autre membre exposee");
      assert.doesNotMatch(s.userAgent ?? "", /Linux/, "user-agent d'un autre membre expose");
    }

    const serialized = JSON.stringify(body);
    assert.equal(
      serialized.includes("s_autre_1"),
      false,
      "aucune trace de la session d'un autre membre dans l'export",
    );
    assert.equal(
      serialized.includes("203.0.113.7"),
      false,
      "l'IP d'un autre membre ne doit pas figurer dans l'export",
    );
    assert.equal(
      serialized.includes("u_autre"),
      false,
      "l'identite Better Auth d'un autre membre ne doit pas figurer dans l'export",
    );
  });

  test("le where interroge le proprietaire par email, sans porte de sortie", async () => {
    await exportRoute.GET(fakeReq());
    const where = seenSessionWhere;
    assert.ok(where, "db.session.findMany sans where : fuite garantie");
    assert.deepEqual(
      where.user,
      { email: MOI.email },
      "le filtre doit porter sur la relation `user.email`, resolue sur le membre connecte",
    );
    assert.equal(
      where.userId,
      undefined,
      "`userId` ne doit pas etre fourni separement : deux sources d'identite, "
        + "donc deux occasions de se tromper",
    );
    assert.equal(where.OR, undefined, "aucun OR : une seule identite doit matcher");
    assert.equal(where.NOT, undefined, "aucun NOT : une seule identite doit matcher");
    assert.equal(
      where.user?.email?.in,
      undefined,
      "aucune liste d'emails : une seule identite doit matcher",
    );
  });

  test("le secret de session (token) n'est jamais exporte", async () => {
    const res = await exportRoute.GET(fakeReq());
    const serialized = JSON.stringify(await res.json());
    assert.equal(
      serialized.includes("secret-token-"),
      false,
      "`Session.token` authentifie le cookie : le divulguer dans un JSON "
        + "telechargeable offrirait le vol de session",
    );
  });

  test("le select demande des colonnes metier, sans `token`", async () => {
    let select = null;
    const real = db.session.findMany;
    db.session.findMany = async (args) => {
      select = args.select;
      return real(args);
    };
    try {
      await exportRoute.GET(fakeReq());
    } finally {
      db.session.findMany = real;
    }
    assert.ok(select, "aucun select observe");
    assert.deepEqual(
      Object.keys(select).sort(),
      ["createdAt", "expiresAt", "id", "ipAddress", "updatedAt", "userAgent"],
      "le select doit rester limite aux metadonnees utiles, sans `token`",
    );
    assert.equal(select.token, undefined, "`token` ne doit jamais etre selectionne");
  });

  test("un membre different n'obtient que ses propres sessions", async () => {
    // Le routeur ne depend pas du membre : on change seulement l'identite
    // resolue par Better Auth. C'est le meme code de production.
    authenticated = AUTRE;
    useFakeDb({ memberEmails: [MOI.email, AUTRE.email] });
    const res = await exportRoute.GET(fakeReq());
    assert.equal(res.status, 200, "l'export de l'autre membre doit reussir aussi");
    const body = await res.json();
    assert.deepEqual(
      body.sessions.map((s) => s.id),
      ["s_autre_1"],
      "chaque membre ne doit voir que ses sessions",
    );
    assert.equal(JSON.stringify(body).includes("s_moi_1"), false);
  });

  test("sans session authentifiee, aucune session n'est lue", async () => {
    authenticated = null;
    const res = await exportRoute.GET(fakeReq());
    assert.equal(res.status, 401);
    assert.equal(seenSessionWhere, null, "aucune lecture de Session sans session");
  });

  test("membre supprime (soft-delete) : l'export ne se poursuit pas", async () => {
    useFakeDb({ memberEmails: [] });
    const res = await exportRoute.GET(fakeReq());
    assert.equal(res.status, 401);
  });
});

// --- 2. LE DAU ADMIN REDEVIENT UN VRAI CHIFFRE ------------------------------

describe("D36 - GET /api/admin/activity-logins : le DAU lit des donnees reelles", () => {
  test("la route interroge `Session`, plus `MemberSession`", () => {
    const src = readCode(ACTIVITY_ROUTE);
    assert.doesNotMatch(
      src,
      /memberSession/i,
      "la route ne doit plus lire MemberSession : la table est supprimee",
    );
    assert.match(src, /db\.session\.groupBy/, "la route doit compter sur db.session");
    assert.match(src, /FROM "Session"/, 'le SQL brut doit lire la table "Session"');
  });

  test("updatedAt remplace lastSeenAt, et expiresAt remplace revokedAt", () => {
    const src = readCode(ACTIVITY_ROUTE);
    assert.doesNotMatch(
      src,
      /lastSeenAt|revokedAt/,
      "ces colonnes n'existent pas dans Session : le WHERE mentirait sur le schema",
    );
    assert.match(
      src,
      /COUNT\(DISTINCT "userId"\)/,
      "un membre = un userId : compter les sessions compterait les appareils",
    );
    assert.match(
      src,
      /"updatedAt" >= NOW\(\) - INTERVAL '30 days'/,
      "le SQL doit filtrer sur updatedAt",
    );
    assert.match(
      src,
      /"expiresAt" > NOW\(\)/,
      "le SQL doit exclure les sessions expirees (equivalent de revokedAt IS NULL)",
    );
  });

  test("le groupBy filtre sur updatedAt ET expiresAt, par userId", () => {
    const src = readCode(ACTIVITY_ROUTE);
    assert.match(src, /by: \["userId"\]/, "le groupBy doit grouper par userId");
    assert.match(
      src,
      /updatedAt: \{ gte: new Date\(Date\.now\(\) - 30 \* 24 \* 3600 \* 1000\) \}/,
      "le groupBy doit filtrer sur updatedAt",
    );
    assert.match(
      src,
      /expiresAt: \{ gt: new Date\(\) \}/,
      "le groupBy doit exclure les sessions expirees",
    );
  });

  test("le DAU n'est plus structurellement nul", async () => {
    for (const k of ["ADMIN_OPERATORS", "ADMIN_VIEWERS", "ADMIN_EMAILS"]) {
      savedEnv[k] = savedEnv[k] ?? process.env[k];
    }
    process.env.ADMIN_OPERATORS = MOI.email;
    process.env.ADMIN_VIEWERS = "";
    process.env.ADMIN_EMAILS = "";

    const res = await activityRoute.GET(fakeReq());
    assert.equal(res.status, 200, "un admin doit obtenir une reponse");
    const body = await res.json();

    assert.equal(body.ok, true);
    assert.equal(body.daily.length, 30, "30 jours sont toujours produits");
    // Tout l'interet du basculement : la serie n'est plus un tableau de zeros.
    assert.ok(
      body.daily.some((d) => d.active > 0),
      "le DAU doit contenir au moins une journee non nulle : sinon la route "
        + "lit encore une table vide",
    );
    // Fenetre 30j, session expiree exclue : 2 proprietaires distincts
    // (`s_moi_expiree` est hors fenetre ET expiree, `s_moi_ancienne` a 40j).
    assert.equal(
      body.distinct30,
      2,
      "« Actifs 30j » doit compter des proprietaires distincts, sessions non expirees",
    );
    // Fenetre 7j : MOI est actif 2 jours sur 7 et AUTRE 1 jour sur 7.
    assert.ok(body.dau7Avg > 0, "le DAU moyen 7j doit deriver de la serie reelle");
  });

  test("un non-admin est refuse (garde inchange)", async () => {
    for (const k of ["ADMIN_OPERATORS", "ADMIN_VIEWERS", "ADMIN_EMAILS"]) {
      savedEnv[k] = savedEnv[k] ?? process.env[k];
    }
    process.env.ADMIN_OPERATORS = "";
    process.env.ADMIN_VIEWERS = "";
    process.env.ADMIN_EMAILS = "";

    const res = await activityRoute.GET(fakeReq());
    assert.equal(res.status, 401, "le garde admin doit toujours refuser");
  });
});

// --- 3. LES TROIS TABLES SONT HORS DU SCHEMA --------------------------------

describe("D36 - schema.prisma ne declare plus les trois tables mortes", () => {
  // Les commentaires du schema expliquent la suppression (et citent les noms des
  // modeles) : seule la declaration compte, pas la mention.
  const schema = readCode("prisma/schema.prisma");

  for (const model of ["MemberSession", "AdminKey", "RateLimit"]) {
    test(`le modele ${model} a disparu du schema`, () => {
      assert.doesNotMatch(
        schema,
        new RegExp("^model " + model + " \\{", "m"),
        model + " est encore declare : le DROP de la migration ne "
          + "correspondrait pas au schema, et `prisma migrate` le regenererait",
      );
    });
  }

  test("Member n'a plus de relation `sessions` vers un modele supprime", () => {
    assert.doesNotMatch(
      schema,
      /MemberSession\[\]/,
      "la relation inverse doit disparaitre avec le modele",
    );
    // Le store de sessions qui reste, et qui est le vrai.
    assert.match(schema, /^model Session \{/m, "Session (Better Auth) doit rester");
    assert.match(schema, /^model User \{/m, "User (Better Auth) doit rester");
  });

  test("la migration de DROP existe et cite les trois tables", () => {
    const file = path.join(ROOT, ...MIGRATION.split("/"));
    assert.ok(fs.existsSync(file), "migration.sql absent : " + MIGRATION);
    const sql = fs.readFileSync(file, "utf8");
    for (const table of ["MemberSession", "AdminKey", "RateLimit"]) {
      assert.match(
        sql,
        new RegExp('DROP TABLE IF EXISTS "' + table + '"'),
        `le DROP de ${table} est absent`,
      );
    }
  });

  test("la migration s'applique dans un transaction et reste idempotente", () => {
    // `DROP TABLE IF EXISTS` : la production a ete amenee par `prisma db push`,
    // donc rien ne garantit que les trois tables y soient. Sans IF EXISTS, la
    // migration echouerait sur une base ou `RateLimit` n'a jamais existe (elle
    // n'est arrivee qu'avec D07).
    const sql = fs.readFileSync(path.join(ROOT, ...MIGRATION.split("/")), "utf8");
    const drops = sql.match(/DROP TABLE(?! IF EXISTS)/gi) ?? [];
    assert.deepEqual(drops, [], "tout DROP doit etre idempotent (IF EXISTS)");
  });
});

// --- 4. PLUS AUCUN LECTEUR APPLICATIF DES TROIS MODELS ----------------------

describe("D36 - aucun code applicatif ne reference les trois models", () => {
  const readDir = (dir, acc = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) readDir(full, acc);
      else if (/\.(ts|tsx|mjs|cjs|js)$/.test(entry.name)) acc.push(full);
    }
    return acc;
  };

  const sourceFiles = readDir(path.join(ROOT, "src")).concat(
    readDir(path.join(ROOT, "scripts")),
  );

  test("pas de db.memberSession / db.adminKey / db.rateLimit dans src/ ni scripts/", () => {
    const offenders = [];
    for (const file of sourceFiles) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of ["memberSession", "adminKey", "rateLimit"]) {
        if (new RegExp("db\\." + m + "\\b").test(src)) {
          offenders.push(`${path.relative(ROOT, file)} -> db.${m}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `references residuelles : ${offenders.join(", ")}`);
  });

  test("pas de chaine SQL vers une table supprimee dans src/", () => {
    const offenders = [];
    for (const file of sourceFiles) {
      const src = fs.readFileSync(file, "utf8");
      for (const table of ["MemberSession", "AdminKey", "RateLimit"]) {
        if (src.includes(`FROM "${table}"`) || src.includes(`JOIN "${table}"`)) {
          offenders.push(`${path.relative(ROOT, file)} -> "${table}"`);
        }
      }
    }
    assert.deepEqual(offenders, [], `SQL residuel : ${offenders.join(", ")}`);
  });

  test("la route export ne lit plus `MemberSession`", () => {
    assert.doesNotMatch(
      readCode(EXPORT_ROUTE),
      /memberSession/i,
      "l'export RGPD doit lire Session, pas la table supprimee",
    );
  });

  test("le type MemberSession de use-member-session.ts n'a rien a voir avec la table", () => {
    // Garde-fou de comprehension : `src/lib/use-member-session.ts` definit un
    // TYPE local du meme nom, utilise par le client. Il ne doit pas etre confondu
    // avec le modele Prisma supprime - et il n'a donc pas ete touche.
    const src = read("src/lib/use-member-session.ts");
    assert.match(src, /export type MemberSession =/, "le type client existe toujours");
    assert.doesNotMatch(src, /@prisma|\bdb\./, "ce type ne doit rien demander a Prisma");
  });
});
