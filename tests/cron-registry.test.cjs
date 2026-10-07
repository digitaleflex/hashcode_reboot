/**
 * Tests — registre cron unique + générateur de crontab (Lane A).
 * No server required. Le registre est en TypeScript : les tests .cjs ne
 * peuvent pas l'importer, donc on analyse sa source en texte (regex) et on
 * exécute le générateur en sous-processus (contrat CLI réel).
 *
 * Run:  node --test tests/cron-registry.test.cjs
 * Or:   npm run test:cron
 *
 * Coverage:
 *  - CRON_HEALTH : exactement 8 entrées, 5 premières = clés AnalyticsEvent
 *    attendues par le dashboard (garde-fou anti-régression de la dédup),
 *    dérivées de CRON_JOBS via eventKey + CRON_MANUAL concaténé
 *  - CRON_JOBS : expression cron valide (5 champs), eventKey unique ou null
 *  - collect-metrics strictement AVANT email-alerts (minute/heure)
 *  - rendu crontab : jamais CRON_SECRET ni Bearer, déterministe,
 *    --out/--check fonctionnels
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY_PATH = path.join(ROOT, "src/lib/cron/registry.ts");
const GENERATOR = path.join(ROOT, "scripts/generate-crontab.ts");

// ── Helpers : lecture du registre TS en texte ──

function readRegistry() {
  return fs.readFileSync(REGISTRY_PATH, "utf8");
}

/** Extrait le contenu entre crochets du `export const <name> ... = [ ... ];`. */
function extractArrayBlock(src, name) {
  const marker = `export const ${name}`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `${name} introuvable dans registry.ts`);
  const open = src.indexOf("[", start);
  assert.ok(open > start, `crochet ouvrant de ${name} introuvable`);
  const close = src.indexOf("];", open);
  assert.ok(close > open, `crochet fermant de ${name} introuvable`);
  return src.slice(open + 1, close);
}

/** Découpe un bloc `[...]` en corps d'objets `{ ... }` (pas d'imbrication). */
function parseObjects(block) {
  const objs = [];
  const re = /\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(block)) !== null) objs.push(m[1]);
  return objs;
}

/** Champ string `"..."` / `'...'` / null. Retourne undefined si absent. */
function strField(body, name) {
  const re = new RegExp(name + '\\s*:\\s*(?:"([^"]*)"|\'([^\']*)\'|null)');
  const m = body.match(re);
  if (!m) return undefined;
  if (m[0].endsWith("null")) return null;
  return m[1] !== undefined ? m[1] : m[2];
}

/** Champ number / null. Retourne undefined si absent. */
function numField(body, name) {
  const re = new RegExp(name + "\\s*:\\s*(\\d+|null)");
  const m = body.match(re);
  if (!m) return undefined;
  return m[1] === "null" ? null : Number(m[1]);
}

function parseCronJobs(src) {
  return parseObjects(extractArrayBlock(src, "CRON_JOBS")).map((body) => ({
    slug: strField(body, "slug"),
    label: strField(body, "label"),
    schedule: strField(body, "schedule"),
    expectedEveryH: numField(body, "expectedEveryH"),
    eventKey: strField(body, "eventKey"),
  }));
}

function parseManual(src) {
  return parseObjects(extractArrayBlock(src, "CRON_MANUAL")).map((body) => ({
    key: strField(body, "key"),
    label: strField(body, "label"),
    expectedEveryH: numField(body, "expectedEveryH"),
  }));
}

function parseCommands(src) {
  return parseObjects(extractArrayBlock(src, "CRON_COMMANDS")).map((body) => ({
    slug: strField(body, "slug"),
    schedule: strField(body, "schedule"),
    command: strField(body, "command"),
  }));
}

// Expression cron : 5 champs, chacun * | */n | nombres/listes/plages/pas.
const CRON_TOKEN = /^(?:\*|\*\/\d+|\d+(?:-\d+)?(?:\/\d+)?(?:,\d+(?:-\d+)?(?:\/\d+)?)*)$/;

function assertValidCron(schedule, what) {
  assert.ok(typeof schedule === "string", `${what} : schedule manquant`);
  const parts = schedule.trim().split(/\s+/);
  assert.equal(parts.length, 5, `${what} : "${schedule}" doit avoir 5 champs`);
  for (const p of parts) {
    assert.match(p, CRON_TOKEN, `${what} : champ invalide "${p}" dans "${schedule}"`);
  }
  return parts;
}

/** Minutes depuis minuit pour un schedule à heure fixe (minute/heure numériques). */
function fixedTimeToMinutes(schedule, what) {
  const [minute, hour] = schedule.trim().split(/\s+/);
  assert.match(minute, /^\d+$/, `${what} : minute non fixe ("${minute}") — l'ordre collect < alerts exige des heures fixes`);
  assert.match(hour, /^\d+$/, `${what} : heure non fixe ("${hour}") — l'ordre collect < alerts exige des heures fixes`);
  return Number(hour) * 60 + Number(minute);
}

// ── Exécution du générateur (contrat CLI réel) ──

function renderStdout() {
  return execFileSync("node", ["--import", "tsx", GENERATOR], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000,
  });
}

// ────────────────────────────────────────────────────────────────
// 1) CRON_HEALTH : 7 entrées exactes, dérivées du registre
// ────────────────────────────────────────────────────────────────

describe("cron-registry: CRON_HEALTH (garde-fou dédup dashboard)", () => {
  const EXPECTED_KEYS = [
    "cron_relance",
    "cron_email_alerts",
    "cron_admin_alerts",
    "cron_collect_metrics",
    "cron_event_reminders",
    "admin_announce_dashboard",
    "admin_invite_relance",
    "admin_import_invite",
  ];
  const EXPECTED_LABELS = [
    "Relance profils (J+7)",
    "Alertes délivrabilité",
    "Alertes admin (Discord)",
    "Collecte métriques",
    "Relances événements (J-3/J-1/H-1)",
    "Annonce espace (manuel)",
    "Relance invitations (manuel)",
    "Import invitations (manuel)",
  ];
  const EXPECTED_EVERY_H = [24, 24, 25, 24, 1, null, null, null];

  test("les 5 premières lignes sont dérivées de CRON_JOBS via eventKey, dans l'ordre", () => {
    const src = readRegistry();
    const jobs = parseCronJobs(src);
    const derived = jobs.filter((j) => j.eventKey !== null);
    assert.equal(derived.length, 5, "5 jobs HTTP doivent porter un eventKey (keepalive et health-alert exclus)");
    assert.deepEqual(
      derived.map((j) => j.eventKey),
      EXPECTED_KEYS.slice(0, 5),
    );
    assert.deepEqual(
      derived.map((j) => j.expectedEveryH),
      EXPECTED_EVERY_H.slice(0, 5),
    );
  });

  test("les 3 dernières lignes viennent de CRON_MANUAL (jamais écrites en dur ailleurs)", () => {
    const src = readRegistry();
    const manual = parseManual(src);
    assert.equal(manual.length, 3);
    assert.deepEqual(manual.map((m) => m.key), EXPECTED_KEYS.slice(5));
    assert.deepEqual(manual.map((m) => m.label), EXPECTED_LABELS.slice(5));
    for (const m of manual) {
      assert.equal(m.expectedEveryH, null, `${m.key} : action manuelle, expectedEveryH doit être null`);
    }
  });

  test("CRON_HEALTH = dérivées + CRON_MANUAL : 8 entrées exactes, labels et seuils inchangés", () => {
    const src = readRegistry();
    // Le câblage doit rester une concaténation (pas une liste recopiée).
    const healthDecl = src.slice(src.indexOf("export const CRON_HEALTH"));
    assert.ok(healthDecl.includes("CRON_MANUAL"), "CRON_HEALTH doit concaténer CRON_MANUAL");
    assert.ok(healthDecl.includes("eventKey"), "CRON_HEALTH doit dériver de CRON_JOBS via eventKey");

    const jobs = parseCronJobs(src);
    const manual = parseManual(src);
    const health = [
      ...jobs
        .filter((j) => j.eventKey !== null)
        .map((j) => ({ key: j.eventKey, label: j.label, expectedEveryH: j.expectedEveryH })),
      ...manual,
    ];
    assert.equal(health.length, 8, "le dashboard attend exactement 8 lignes");
    assert.deepEqual(health.map((h) => h.key), EXPECTED_KEYS);
    assert.deepEqual(health.map((h) => h.label), EXPECTED_LABELS);
    assert.deepEqual(health.map((h) => h.expectedEveryH), EXPECTED_EVERY_H);
  });

  test("aucune route admin ne définit encore son propre tableau CRONS", () => {
    for (const f of ["src/app/api/admin/dashboard/route.ts", "src/app/api/admin/cron-health/route.ts"]) {
      const content = fs.readFileSync(path.join(ROOT, f), "utf8");
      assert.ok(!/const CRONS\s*=/.test(content), `${f} : tableau local CRONS encore présent (duplication)`);
      assert.ok(content.includes("CRON_HEALTH"), `${f} : doit importer CRON_HEALTH du registre`);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 2) CRON_JOBS : schedules valides, eventKey uniques
// ────────────────────────────────────────────────────────────────

describe("cron-registry: CRON_JOBS valides", () => {
  test("chaque job a un slug, un label, un cron 5 champs et un eventKey unique ou null", () => {
    const jobs = parseCronJobs(readRegistry());
    assert.ok(jobs.length >= 5, "au moins relance, email-alerts, collect-metrics, event-reminders, keepalive");
    const slugs = new Set();
    const keys = new Set();
    for (const j of jobs) {
      assert.ok(j.slug && /^[a-z0-9-]+$/.test(j.slug), `slug invalide : ${j.slug}`);
      assert.ok(!slugs.has(j.slug), `slug dupliqué : ${j.slug}`);
      slugs.add(j.slug);
      assert.ok(j.label && j.label.length > 0, `${j.slug} : label manquant`);
      assertValidCron(j.schedule, j.slug);
      assert.ok(
        j.expectedEveryH === null || (Number.isInteger(j.expectedEveryH) && j.expectedEveryH > 0),
        `${j.slug} : expectedEveryH doit être un entier > 0 ou null`,
      );
      assert.ok(j.eventKey === null || typeof j.eventKey === "string", `${j.slug} : eventKey invalide`);
      if (j.eventKey !== null) {
        assert.ok(!keys.has(j.eventKey), `eventKey dupliqué : ${j.eventKey}`);
        keys.add(j.eventKey);
      }
    }
  });

  test("chaque commande a un cron 5 champs et une commande non vide", () => {
    const commands = parseCommands(readRegistry());
    assert.ok(commands.length >= 1, "au moins la commande backup (pg_dump)");
    const slugs = new Set();
    for (const c of commands) {
      assert.ok(c.slug && !slugs.has(c.slug), `slug commande dupliqué/manquant : ${c.slug}`);
      slugs.add(c.slug);
      assertValidCron(c.schedule, c.slug);
      assert.ok(c.command && c.command.length > 0, `${c.slug} : commande vide`);
    }
  });

  test("aucun slug partagé entre jobs HTTP et commandes (pas de doublon planifié)", () => {
    const src = readRegistry();
    const jobSlugs = parseCronJobs(src).map((j) => j.slug);
    const cmdSlugs = parseCommands(src).map((c) => c.slug);
    const all = [...jobSlugs, ...cmdSlugs];
    assert.equal(new Set(all).size, all.length, "slug présent à la fois en job et en commande");
  });

  test("collect-metrics est strictement AVANT email-alerts (les alertes lisent les métriques)", () => {
    const jobs = parseCronJobs(readRegistry());
    const bySlug = new Map(jobs.map((j) => [j.slug, j]));
    const collect = bySlug.get("collect-metrics");
    const alerts = bySlug.get("email-alerts");
    assert.ok(collect && alerts, "jobs collect-metrics et email-alerts requis");
    const tCollect = fixedTimeToMinutes(collect.schedule, "collect-metrics");
    const tAlerts = fixedTimeToMinutes(alerts.schedule, "email-alerts");
    assert.ok(
      tCollect < tAlerts,
      `collect-metrics (${collect.schedule}) doit être strictement avant email-alerts (${alerts.schedule})`,
    );
  });

  test("backup (pg_dump) tourne dans la nuit, avant collect-metrics", () => {
    const src = readRegistry();
    const jobs = parseCronJobs(src);
    const commands = parseCommands(src);
    const backup = commands.find((c) => c.slug === "backup");
    assert.ok(backup, "commande backup (pg_dump) requise");
    const collect = jobs.find((j) => j.slug === "collect-metrics");
    assert.ok(collect);
    assert.ok(
      fixedTimeToMinutes(backup.schedule, "backup") < fixedTimeToMinutes(collect.schedule, "collect-metrics"),
      `backup (${backup.schedule}) doit précéder collect-metrics (${collect.schedule})`,
    );
    assert.ok(/pg_dump/.test(backup.command), "la commande backup doit utiliser pg_dump");
  });

  test("event-reminders tourne toutes les 15 min avec expectedEveryH: 1 (seuil anti fausse alerte)", () => {
    const jobs = parseCronJobs(readRegistry());
    const reminders = jobs.find((j) => j.slug === "event-reminders");
    assert.ok(reminders, "job event-reminders requis");
    assert.equal(reminders.schedule, "*/15 * * * *");
    assert.equal(reminders.expectedEveryH, 1);
    assert.equal(reminders.eventKey, "cron_event_reminders");
  });

  test("CRON_SECRET n'apparaît jamais dans le registre (hors commentaires)", () => {
    const src = readRegistry();
    // Les commentaires documentent l'interdiction : on les retire avant de chercher une vraie fuite.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    assert.ok(!code.includes("CRON_SECRET"), "le secret ne doit jamais figurer dans le registre");
    assert.ok(!code.includes("Bearer"), "aucun en-tête Authorization dans le registre");
    assert.ok(!/process\.env/.test(code), "le registre ne doit lire aucune variable d'environnement");
  });
});

// ────────────────────────────────────────────────────────────────
// 3) Rendu crontab : contrat CLI, secrets, déterminisme
// ────────────────────────────────────────────────────────────────

describe("generate-crontab: rendu", () => {
  test("stdout contient une ligne call-cron par job HTTP + la commande backup", () => {
    const out = renderStdout();
    const jobs = parseCronJobs(readRegistry());
    for (const j of jobs) {
      assert.ok(
        out.includes(`call-cron ${j.slug}`),
        `ligne "call-cron ${j.slug}" manquante dans le crontab`,
      );
    }
    assert.ok(out.includes("pg_dump"), "ligne backup (pg_dump) manquante");
    assert.ok(out.includes("TZ=Africa/Porto-Novo"), "fuseau TZ=Africa/Porto-Novo manquant");
    assert.ok(out.includes("NE PAS ÉDITER") || out.includes("pas éditer"), "en-tête GÉNÉRÉ manquant");
  });

  test("chaque ligne planifiée commence par un cron 5 champs valide", () => {
    const out = renderStdout();
    const scheduled = out.split("\n").filter((l) => l && !l.startsWith("#") && !/^[A-Z_]+=/.test(l));
    assert.ok(scheduled.length >= 6, "au moins 5 jobs HTTP + 1 commande attendus");
    for (const line of scheduled) {
      const parts = line.split(/\s+/);
      assert.ok(parts.length >= 6, `ligne malformée : ${line}`);
      assertValidCron(parts.slice(0, 5).join(" "), `ligne "${line}"`);
    }
  });

  test("le rendu ne contient jamais CRON_SECRET ni Bearer", () => {
    const out = renderStdout();
    assert.ok(!out.includes("CRON_SECRET"), "le secret fuit dans le crontab généré");
    assert.ok(!out.includes("Bearer"), "un en-tête Authorization fuit dans le crontab généré");
  });

  test("le rendu est déterministe (deux appels identiques)", () => {
    assert.equal(renderStdout(), renderStdout(), "deux runs doivent produire octet pour octet le même crontab");
  });

  test("--out écrit le fichier (avec répertoires) puis --check passe (exit 0)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crontab-test-"));
    const target = path.join(dir, "sub", "dir", "crontab");
    const r1 = spawnSync("node", ["--import", "tsx", GENERATOR, "--out", target], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
    assert.equal(r1.status, 0, `--out a échoué : ${r1.stderr}`);
    assert.ok(fs.existsSync(target), "--out n'a pas créé le fichier");
    assert.equal(fs.readFileSync(target, "utf8"), renderStdout(), "--out diffère du stdout");

    const r2 = spawnSync("node", ["--import", "tsx", GENERATOR, "--check", target], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
    assert.equal(r2.status, 0, `--check devrait passer : ${r2.stderr}`);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("--check échoue (exit 1) si le fichier diffère du registre", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crontab-test-"));
    const target = path.join(dir, "crontab");
    fs.writeFileSync(target, "# crontab périmé\n0 0 * * * echo vieux\n", "utf8");
    const r = spawnSync("node", ["--import", "tsx", GENERATOR, "--check", target], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
    assert.equal(r.status, 1, "--check devrait sortir en exit 1 sur fichier obsolète");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
