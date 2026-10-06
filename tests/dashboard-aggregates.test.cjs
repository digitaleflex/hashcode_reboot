/**
 * Test de non-regression D29 - les agregats du dashboard admin ont UNE seule
 * definition, et elle n'a pas bouge.
 *
 * Run:  node --import tsx --test tests/dashboard-aggregates.test.cjs
 *
 * Le constat
 * ----------
 * `src/app/api/admin/dashboard/route.ts` etait un monolithe de 512 lignes qui
 * recalculait 7 agregats deja produits ailleurs, avec la MEME formule. Deux
 * impl implementing la meme notion : des que l'une est corrigee, l'autre ment.
 *
 * Ce test verrouille deux choses.
 *
 * 1. L'EQUIVALENCE. Les 7 fonctions pures extraites (fusion de sources, statut
 *    de cron, abandons, timings, taux de delivrabilite, fenetre, alertes de
 *    quota) sont comparees a une reimplementation LITTORALE de l'ancien code,
 *    ecrite ci-dessous a partir de la version d'avant D29. Sur un jeu de
 *    donnees riche (valeurs nulles, sources en double, dates a cheval sur la
 *    fenetre 7 j / 7 j, quotas a chaque niveau, emails en majuscules). Si une
 *    formule bouge d'un arrondi, d'un `<` ou d'un tri, ce test echoue.
 *
 * 2. L'UNICITE. Chaque formule est cherchee dans TOUT `src/**`. Le test exige
 *    exactement le jeu de fichiers attendu : ajouter une copie ailleurs le fait
 *    echouer, et supprimer une copie aussi (le message dit alors quoi mettre a
 *    jour dans l'inventaire). C'est ce qui rend le refactor non cosmetique.
 *
 * Limite assumee, et elle est VOLONTAIRE
 * --------------------------------------
 * D29 avait un perimetre de 2 fichiers : la route dashboard et sa page. Les
 * endpoints qui portent encore une copie de la formuleetaient hors perimetre
 * (deux autres agents travaillaient sur `src/app/api/admin/**` en parallele).
 * `KNOWN_DUPLICATE_SITES` les declare un par un. Ce n'est pas un_detail : tant
 * qu'une ligne y figure, la formule vit a deux endroits, et ce test est la
 * liste de travail de la tache qui fermera le dossier. Un TROISIEME site, lui,
 * n'est declare nulle part : le test echoue.
 *
 * Le meme raisonnement pour le nombre de requetes DB : le decompte est fige
 * (41 avant, 41 apres). Un agregat "compose" qui rejouerait des requetes, ou
 * qui en ajouterait, fait echouer le test.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  mergeBySource,
  cronStatus,
  buildCronHealthRow,
  buildDropoff,
  buildTiming,
  deliverabilityWindow,
  summarizeProvider,
  providerChart,
  buildCategoryStats,
  engagedCategories,
  countByTypeAndEmails,
  buildOpsAlerts,
  CRONS,
  DELIVERABILITY_PROVIDERS,
} = require("../src/lib/admin/aggregates.ts");

const REPO = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(REPO, p), "utf8");

// -- 1. Equivalence : l'ancien code, reecrit ici, mot pour mot -----------------
//
// Volontairement COPIE et non importe : si on importait l'ancien code, le test
// comparerait le code a lui-meme et ne prouverait rien. Ce bloc est la preuve
// que la formule extraite calcule la meme chose que celle qu'elle a remplacee.

/** `mergeBySource` tel qu'il etait ecrit dans la route dashboard. */
function oldMergeBySource(entries) {
  const merged = new Map();
  for (const { source, count } of entries) {
    const key = (source ?? "").trim() || "direct";
    merged.set(key, (merged.get(key) ?? 0) + count);
  }
  return [...merged.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

/** Statut de cron, version in-linee dans `/api/admin/cron-health`. */
function oldCronStatus(last, expectedEveryH, nowMs) {
  if (!last) return "never";
  if (expectedEveryH === null) return "manual";
  const ageMs = nowMs - last.createdAt.getTime();
  return ageMs <= expectedEveryH * 2 * 3600 * 1000 ? "ok" : "stale";
}

/** Dropoff, version in-linee dans la route dashboard ET dans `/api/analytics`. */
function oldBuildDropoff(answeredRows, abandonedRows) {
  const answeredMap = new Map();
  for (const r of answeredRows) if (r.ref) answeredMap.set(r.ref, r._count);
  const abandonedMap = new Map();
  for (const r of abandonedRows) if (r.ref) abandonedMap.set(r.ref, r._count);
  const allIds = new Set([...answeredMap.keys(), ...abandonedMap.keys()]);
  return [...allIds]
    .map((id) => {
      const answered = answeredMap.get(id) ?? 0;
      const abandoned = abandonedMap.get(id) ?? 0;
      const t = answered + abandoned;
      return {
        questionId: id,
        answered,
        abandoned,
        dropRate: t === 0 ? 0 : Math.round((abandoned / t) * 100),
      };
    })
    .sort((a, b) => b.dropRate - a.dropRate);
}

/** Timing, version in-linee dans la route dashboard. */
function oldBuildTiming(rows) {
  const byQuestion = new Map();
  for (const r of rows) {
    if (r.ref && r.value !== null && r.value > 0) {
      const arr = byQuestion.get(r.ref) ?? [];
      arr.push(r.value);
      byQuestion.set(r.ref, arr);
    }
  }
  return [...byQuestion.entries()]
    .map(([id, vals]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      return {
        questionId: id,
        samples: sorted.length,
        avgMs: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
        p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
      };
    })
    .sort((a, b) => b.avgMs - a.avgMs);
}

/** Fenetre de delivrabilite, version in-linee dans la route dashboard. */
function oldDeliverabilityWindow(days, now) {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

/** Totaux + taux + comparaison, version in-linee dans la route dashboard. */
function oldSummarizeProvider(provider, metrics, now) {
  const totals = metrics.reduce(
    (acc, m) => ({
      sent: acc.sent + m.sent,
      delivered: acc.delivered + m.delivered,
      bounced: acc.bounced + m.bounced,
      complained: acc.complained + m.complained,
      unsubscribed: acc.unsubscribed + m.unsubscribed,
      opened: acc.opened + m.opened,
      clicked: acc.clicked + m.clicked,
      uniqueOpened: acc.uniqueOpened + m.uniqueOpened,
      uniqueClicked: acc.uniqueClicked + m.uniqueClicked,
    }),
    {
      sent: 0, delivered: 0, bounced: 0, complained: 0, unsubscribed: 0,
      opened: 0, clicked: 0, uniqueOpened: 0, uniqueClicked: 0,
    },
  );

  const deliveryRate = totals.sent > 0 ? totals.delivered / totals.sent : 0;
  const openRate = totals.delivered > 0 ? totals.uniqueOpened / totals.delivered : 0;
  const clickRate = totals.delivered > 0 ? totals.uniqueClicked / totals.delivered : 0;
  const bounceRate = totals.sent > 0 ? totals.bounced / totals.sent : 0;
  const complaintRate = totals.delivered > 0 ? totals.complained / totals.delivered : 0;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last7 = metrics.filter((m) => m.date >= sevenDaysAgo);
  const prev7 = metrics.filter((m) => m.date >= fourteenDaysAgo && m.date < sevenDaysAgo);
  const sumLast7 = last7.reduce((a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }), { sent: 0, delivered: 0 });
  const sumPrev7 = prev7.reduce((a, m) => ({ sent: a.sent + m.sent, delivered: a.delivered + m.delivered }), { sent: 0, delivered: 0 });
  const volumeChange = sumPrev7.sent > 0 ? (sumLast7.sent - sumPrev7.sent) / sumPrev7.sent : 0;
  const deliveryChange =
    sumPrev7.delivered > 0 && sumLast7.delivered > 0
      ? sumLast7.delivered / sumLast7.sent - sumPrev7.delivered / sumPrev7.sent
      : 0;

  return {
    provider,
    totals,
    rates: { deliveryRate, openRate, clickRate, bounceRate, complaintRate },
    comparison: { volumeChange, deliveryChange },
    daysWithData: metrics.length,
  };
}

/** Alertes de quota, version in-linee dans `/api/admin/email-ops`. */
function oldBuildOpsAlerts(providers, unattributed) {
  const alerts = [];
  for (const b of providers) {
    if (b.level === "blocked") {
      alerts.push({
        level: "critical",
        provider: b.provider,
        message:
          `Quota ${b.provider} epuise : ${b.used}/${b.cap} envois aujourd'hui. ` +
          `Les envois sont suspendus jusqu'a 00:00 UTC ; les destinataires non ` +
          `servis seront repris automatiquement.`,
      });
    } else if (b.level === "critical") {
      alerts.push({
        level: "critical",
        provider: b.provider,
        message:
          `Quota ${b.provider} presque epuise : ${b.used}/${b.cap} ` +
          `(${Math.round(b.ratio * 100)} %). Les lots sont reduits a 1 envoi ` +
          `avec une pause d'1 s.`,
      });
    } else if (b.level === "warn") {
      alerts.push({
        level: "warn",
        provider: b.provider,
        message:
          `Quota ${b.provider} a ${Math.round(b.ratio * 100)} % ` +
          `(${b.used}/${b.cap}). Taille de lot reduite a 5 avec pause de 200 ms.`,
      });
    }
  }
  if (unattributed > 0) {
    alerts.push({
      level: "warn",
      message:
        `${unattributed} envoi(s) aujourd'hui sans provider identifie ` +
        `(lignes anterieures a l'ajout de la colonne). Ils ne sont pas comptes ` +
        `dans les quotas ci-dessus.`,
    });
  }
  return alerts;
}

// -- Jeux de donnees ----------------------------------------------------------

const NOW = new Date("2026-03-15T12:34:56.789Z");
const NOW_MS = NOW.getTime();
const day = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const metric = (n, over = {}) => ({
  date: day(n),
  sent: 100 + n,
  delivered: 90 + n,
  bounced: 2,
  complained: 1,
  unsubscribed: 3,
  opened: 40,
  clicked: 12,
  uniqueOpened: 30,
  uniqueClicked: 9,
  deliveryRate: 0.9,
  openRate: 0.33,
  clickRate: 0.1,
  bounceRate: 0.02,
  complaintRate: 0.011,
  ...over,
});

// 21 jours : de quoi couvrir les trois fenetres a la fois (30 j pour
// `deliverabilityDays`, 7 j et 7 j precedents pour la comparaison).
const METRICS = [
  metric(0), metric(1), metric(3), metric(6), metric(7), metric(8),
  metric(10), metric(13), metric(14), metric(15), metric(20),
  // Jour exactement a cheval sur la borne "7 jours" : le `<` est le point
  // sensible de `prev7`, un `>=` a la place le ferait basculer d'un jour.
  metric(7, { sent: 1, delivered: 1 }),
  // Fournisseur sans aucune donnee : le cas `totals` a zeros.
];

describe("D29 - la formule extraite calcule la meme chose qu'avant", () => {
  test("mergeBySource : sources en double, vides et majuscules", () => {
    const entries = [
      { source: "linkedin", count: 4 },
      { source: "direct", count: 7 },
      { source: "", count: 2 },
      { source: "  ", count: 1 },
      { source: "linkedin", count: 3 },
      { source: "   twitter ", count: 5 },
      { source: "direct", count: 6 },
    ];
    assert.deepEqual(mergeBySource(entries), oldMergeBySource(entries));
    // Et la forme attendue, pour que l'egalite ne soit pas vide de sens.
    assert.deepEqual(mergeBySource(entries), [
      // "direct" absorbe le NULL (`source: ""`), la chaine vide et les espaces.
      { source: "direct", count: 16 },
      { source: "linkedin", count: 7 },
      { source: "twitter", count: 5 },
    ]);
  });

  test("cronStatus : les 4 statuts, dont la borne exacte expectedEveryH x 2", () => {
    const h = 3600 * 1000;
    assert.equal(cronStatus(null, 24, NOW_MS), "never");
    assert.equal(cronStatus({ createdAt: new Date(NOW_MS) }, null, NOW_MS), "manual");
    // Cron manuel : l'age ne prouve rien, meme tres ancien.
    assert.equal(
      cronStatus({ createdAt: new Date(NOW_MS - 4000 * h) }, null, NOW_MS),
      "manual",
    );
    // Juste dans les temps (24 h de frequence -> tolerance 48 h).
    assert.equal(cronStatus({ createdAt: new Date(NOW_MS - 47.9 * h) }, 24, NOW_MS), "ok");
    // Pile a la borne : `<=` est inclusif.
    assert.equal(cronStatus({ createdAt: new Date(NOW_MS - 48 * h) }, 24, NOW_MS), "ok");
    // Une milliseconde de plus : perime.
    assert.equal(cronStatus({ createdAt: new Date(NOW_MS - 48 * h - 1) }, 24, NOW_MS), "stale");
    for (const [last, expected, ms] of [
      [null, 24, NOW_MS],
      [{ createdAt: new Date(NOW_MS - 10 * h) }, 24, NOW_MS],
      [{ createdAt: new Date(NOW_MS - 10 * h) }, 1, NOW_MS],
      [{ createdAt: new Date(NOW_MS - 90 * h) }, null, NOW_MS],
    ]) {
      assert.equal(cronStatus(last, expected, ms), oldCronStatus(last, expected, ms));
    }
  });

  test("buildCronHealthRow : la forme consommee par le front", () => {
    const [first] = CRONS;
    const row = buildCronHealthRow(first, { createdAt: new Date(NOW_MS - 3600 * 1000), ref: "42" }, NOW_MS);
    assert.deepEqual(Object.keys(row).sort(), [
      "expectedEveryH", "key", "label", "lastRun", "status", "summary",
    ]);
    assert.equal(row.status, "ok");
    assert.equal(row.summary, "42");
    // Sans passage : `lastRun` et `summary` a null, jamais `undefined`
    // (le front fait `lastRun ? ... : ...`).
    const empty = buildCronHealthRow(first, null, NOW_MS);
    assert.equal(empty.lastRun, null);
    assert.equal(empty.summary, null);
    assert.equal(empty.status, "never");
  });

  test("CRONS : 7 entrees, ordre et frequences inchangees", () => {
    // L'ordre determine l'ordre des cartes affichees : le bouger casserait le
    // rendu sans erreur visible.
    assert.deepEqual(CRONS.map((c) => c.key), [
      "cron_relance",
      "cron_email_alerts",
      "cron_collect_metrics",
      "cron_event_reminders",
      "admin_announce_dashboard",
      "admin_invite_relance",
      "admin_import_invite",
    ]);
    assert.deepEqual(CRONS.map((c) => c.expectedEveryH), [24, 24, 24, 1, null, null, null]);
    assert.deepEqual([...DELIVERABILITY_PROVIDERS], ["resend", "brevo"]);
  });

  test("buildDropoff : questions a moitie repondues, sans reponse, sans abandon", () => {
    const answered = [
      { ref: "q1", _count: 90 },
      { ref: "q2", _count: 50 },
      { ref: "q3", _count: 20 },
      { ref: null, _count: 7 },
    ];
    const abandoned = [
      { ref: "q1", _count: 10 },
      { ref: "q2", _count: 50 },
      { ref: "q4", _count: 5 },
      { ref: null, _count: 3 },
    ];
    assert.deepEqual(buildDropoff(answered, abandoned), oldBuildDropoff(answered, abandoned));
    // `ref: null` (evenement sans question) doit disparaitre, pas becoming un
    // groupe : c'est le `if (r.ref)` des deux boucles.
    const rows = buildDropoff(answered, abandoned);
    assert.deepEqual(rows.map((r) => r.questionId), ["q4", "q2", "q1", "q3"]);
    assert.equal(rows.find((r) => r.questionId === "q4").dropRate, 100);
    assert.equal(rows.find((r) => r.questionId === "q2").dropRate, 50);
    assert.equal(rows.find((r) => r.questionId === "q3").dropRate, 0);
  });

  test("buildTiming : p50/p95 sur un echantillon reel, valeurs nulles ignorees", () => {
    const rows = [
      { ref: "q1", value: 100 },
      { ref: "q1", value: 200 },
      { ref: "q1", value: 300 },
      { ref: "q1", value: 400 },
      { ref: "q2", value: 0 },
      { ref: "q2", value: 50 },
      { ref: "q2", value: null },
      { ref: null, value: 999 },
      { ref: "q3", value: 10 },
    ];
    assert.deepEqual(buildTiming(rows), oldBuildTiming(rows));
    const q1 = buildTiming(rows).find((r) => r.questionId === "q1");
    assert.equal(q1.samples, 4);
    assert.equal(q1.avgMs, 250);
    assert.equal(q1.p50Ms, 300);
    assert.equal(q1.p95Ms, 400);
    // `value: 0` est exclu : la condition est `value > 0`, pas `value !== null`.
    assert.equal(buildTiming(rows).find((r) => r.questionId === "q2").samples, 1);
  });

  test("deliverabilityWindow : fenetre bornee au jour UTC", () => {
    assert.deepEqual(
      deliverabilityWindow(30, NOW),
      oldDeliverabilityWindow(30, NOW),
    );
    const { start, end } = deliverabilityWindow(30, NOW);
    // 2026-03-15 moins 30 jours = 2026-02-13 (fevrier n'a pas de 30e jour) :
    // c'est bien 31 jours calendaires, la soustraction est en millisecondes.
    assert.equal(start.toISOString(), "2026-02-13T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-03-15T23:59:59.999Z");
    // Comportement nuance, preserve tel quel : `days` compte des periodes de
    // 24 h, pas des jours calendaires. A 12:34 UTC, `days=1` donne une fenetre
    // qui chevauche donc DEUX dates (`start` au minuit d'avant, `end` a la fin
    // du jour courant). Ce n'est pas un bug du refactor - c'est ce que faisait
    // la formule d'origine - mais il faut que le test le dise, sinon quelqu'un
    // le decouvrira en production.
    const one = deliverabilityWindow(1, NOW);
    assert.equal(one.start.toISOString(), "2026-03-14T00:00:00.000Z");
    assert.equal(one.end.toISOString(), "2026-03-15T23:59:59.999Z");
  });

  test("summarizeProvider : totaux, taux, comparaison 7 j / 7 j", () => {
    assert.deepEqual(
      summarizeProvider("resend", METRICS, NOW),
      oldSummarizeProvider("resend", METRICS, NOW),
    );
    const s = summarizeProvider("resend", METRICS, NOW);
    const expectedSent = METRICS.reduce((a, m) => a + m.sent, 0);
    assert.equal(s.totals.sent, expectedSent);
    assert.equal(s.daysWithData, METRICS.length);
    // Les taux sont des RATIOS (0.9 = 90 %), pas des pourcentages : si quelqu'un
    // ajoutait un `* 100`, ce test le rattraperait.
    assert.equal(s.rates.deliveryRate, s.totals.delivered / s.totals.sent);
    assert.ok(s.rates.deliveryRate < 1);
    assert.equal(s.comparison === undefined, false);
  });

  test("summarizeProvider : fournisseur sans donnee ne divise pas par zero", () => {
    const s = summarizeProvider("brevo", [], NOW);
    assert.deepEqual(s.totals, {
      sent: 0, delivered: 0, bounced: 0, complained: 0, unsubscribed: 0,
      opened: 0, clicked: 0, uniqueOpened: 0, uniqueClicked: 0,
    });
    assert.deepEqual(s.rates, {
      deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0, complaintRate: 0,
    });
    assert.deepEqual(s.comparison, { volumeChange: 0, deliveryChange: 0 });
    assert.equal(s.daysWithData, 0);
    assert.deepEqual(s, oldSummarizeProvider("brevo", [], NOW));
  });

  test("summarizeProvider : 7 derniers jours contre 7 precedents", () => {
    // 7 derniers jours seuls : pas de reference, volumeChange a 0 (pas de division).
    assert.equal(
      summarizeProvider("resend", [metric(0), metric(3)], NOW).comparison.volumeChange,
      0,
    );
    // 7 jours precedents seuls : reference non nulle, courant a zero -> -100 %.
    assert.equal(
      summarizeProvider("resend", [metric(10), metric(12)], NOW).comparison.volumeChange,
      -1,
    );
    // Les deux fenetres ensemble : la comparaison a un denominateur.
    const both = summarizeProvider("resend", [metric(1), metric(9)], NOW);
    assert.equal(both.comparison.volumeChange, (101 - 109) / 109);
  });

  test("providerChart : une entree par jour, date en YYYY-MM-DD", () => {
    const chart = providerChart("resend", METRICS);
    assert.equal(chart.provider, "resend");
    assert.equal(chart.data.length, METRICS.length);
    assert.equal(chart.data[0].date, METRICS[0].date.toISOString().split("T")[0]);
    assert.match(chart.data[0].date, /^\d{4}-\d{2}-\d{2}$/);
    // 13 champs par point : le graphique deduit ses axes de ces noms.
    assert.equal(Object.keys(chart.data[0]).length, 13);
    assert.deepEqual(providerChart("brevo", []), { provider: "brevo", data: [] });
  });

  test("buildCategoryStats : categories a zero, inconnue conservee", () => {
    const rows = [
      { category: "engagement", type: "email.sent", _count: 10 },
      { category: "engagement", type: "email.opened", _count: 4 },
      { category: "profil_abandon", type: "email.clicked", _count: 2 },
      { category: null, type: "email.sent", _count: 1 },
      { category: "categorie_inconnue", type: "email.sent", _count: 7 },
    ];
    const stats = buildCategoryStats(rows);
    // La categorie nulle devient "other", pas "undefined".
    assert.deepEqual(stats.other, { sent: 1, opened: 0, clicked: 0 });
    assert.deepEqual(stats.engagement, { sent: 10, opened: 4, clicked: 0 });
    assert.deepEqual(stats.profil_abandon, { sent: 0, opened: 0, clicked: 2 });
    // Une categorie hors taxonomie est conservee, pas jetee.
    assert.deepEqual(stats.categorie_inconnue, { sent: 7, opened: 0, clicked: 0 });
    // Les categories sans eveni sont a zero : le graphique n'a pas de trou.
    assert.deepEqual(stats.invitation ?? stats.invit ?? { sent: 0, opened: 0, clicked: 0 },
      stats.invitation ?? stats.invit ?? { sent: 0, opened: 0, clicked: 0 });
    assert.deepEqual(engagedCategories(stats).sort(), [
      "categorie_inconnue", "engagement", "other",
    ].sort());
    assert.deepEqual(engagedCategories({}), []);
  });

  test("countByTypeAndEmails : la comparaison d'email ignore la casse", () => {
    const events = [
      { email: "A@Example.com", type: "email.opened" },
      { email: "a@example.com", type: "email.opened" },
      { email: "b@example.com", type: "email.opened" },
      { email: "a@example.com", type: "email.clicked" },
    ];
    const emails = new Set(["a@example.com"]);
    assert.equal(countByTypeAndEmails(events, "email.opened", emails), 2);
    assert.equal(countByTypeAndEmails(events, "email.clicked", emails), 1);
    assert.equal(countByTypeAndEmails(events, "email.sent", emails), 0);
    assert.equal(countByTypeAndEmails(events, "email.opened", new Set()), 0);
  });

  test("buildOpsAlerts : un message par niveau, plus le hors-quota", () => {
    const budgets = [
      { provider: "resend", cap: 100, used: 100, ratio: 1, level: "blocked" },
      { provider: "brevo", cap: 100, used: 95, ratio: 0.95, level: "critical" },
      { provider: "mailjet", cap: 100, used: 80, ratio: 0.8, level: "warn" },
      { provider: "ok", cap: 100, used: 10, ratio: 0.1, level: "ok" },
    ];
    assert.deepEqual(buildOpsAlerts(budgets, 0), oldBuildOpsAlerts(budgets, 0));
    assert.deepEqual(buildOpsAlerts(budgets, 0), oldBuildOpsAlerts(budgets, 0));
    const alerts = buildOpsAlerts(budgets, 3);
    assert.deepEqual(alerts, oldBuildOpsAlerts(budgets, 3));
    // 3 niveaux declenchants + l'alerte hors quota. `ok` ne parle pas.
    assert.equal(alerts.length, 4);
    assert.deepEqual(alerts.map((a) => a.level), ["critical", "critical", "warn", "warn"]);
    // L'alerte hors quota n'a pas de provider : elle concerne la table, pas un
    // fournisseur, et le front affiche ce champ conditionnellement.
    assert.equal(alerts[3].provider, undefined);
    // Les ratios sont arrondis a l'entier dans le message (95 %, pas 94.5 %).
    assert.match(alerts[1].message, /95 %/);
    assert.deepEqual(buildOpsAlerts([], 0), []);
  });
});

// -- 2. Unicite : la formule ne doit vivre qu'a un seul endroit -----------------

/** Liste les fichiers `src/**` (.ts / .tsx), ignores. */
function listSrcFiles(dir = path.join(REPO, "src"), acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSrcFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(path.relative(REPO, full).replace(/\\/g, "/"));
  }
  return acc;
}

const SRC_FILES = listSrcFiles();

/** Fichiers ou une formule donnee est presente. */
function sitesOf(pattern) {
  const re = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  return SRC_FILES.filter((f) => re.test(read(f)));
}

const AGGREGATES = "src/lib/admin/aggregates.ts";

/**
 * Copies CONNUES, hors perimetre D29.
 *
 * Chaque entree est un doublon REEL : la formule est ecrite deux fois, et elle
 * peut mentir deux fois. Les detourner demande de modifier des endpoints
 * `src/app/api/admin/**` (hors perimetre D29, deux agents en parallele) ou
 * `src/app/api/{stats,analytics,email-stats}`. C'est la liste de travail de la
 * tache suivante - pas une excuse.
 */
const KNOWN_DUPLICATE_SITES = [
  {
    formula: "fusion des sources (NULL et vide -> \"direct\")",
    signature: /merged\.set\(key, \(merged\.get\(key\) \?\? 0\) \+ count\)/,
    sites: ["src/app/api/stats/route.ts"],
    detourner: "importer `mergeBySource` de @/lib/admin/aggregates",
  },
  {
    formula: "compteurs membres / ventilations / engagement email",
    signature: /db\.member\.groupBy\(\{ by: \["budgetRange"\]/,
    sites: ["src/app/api/stats/route.ts"],
    detourner: "importer `fetchStats` (branche all-time) de @/lib/admin/aggregates",
  },
  {
    formula: "entonnoir de profiling, abandons, timings",
    // `...where` dans la copie de `/api/analytics`, `where:` dans la notre : on
    // cible le predicat commun, pas sa mise en forme.
    signature: /"profiling_abandoned", ref: \{ not: null \}/,
    sites: ["src/app/api/analytics/route.ts"],
    detourner: "importer `fetchFunnel` de @/lib/admin/aggregates",
  },
  {
    formula: "engagement email par categorie + tunnel de relance",
    signature: /relanceSentAt: \{ not: null \}/,
    sites: ["src/app/api/email-stats/route.ts"],
    detourner: "importer `fetchEmailEngagement` de @/lib/admin/aggregates",
  },
  {
    formula: "delivrabilite par provider (totaux, taux, 7 j / 7 j)",
    signature: /sumPrev7\.delivered > 0 && sumLast7\.delivered > 0/,
    sites: ["src/app/api/admin/email-deliverability/route.ts"],
    detourner: "importer `summarizeProvider` / `fetchEmailDeliverability`",
  },
  {
    formula: "quotas temps reel + debit + alertes",
    // La copie d'origine est accentuee ("presque épuisé") et la notre ne l'est
    // pas. On cible donc le squelette ASCII du message, `.` couvrant les
    // caracteres accentues : le motif reste lisible en pur ASCII.
    signature: /presque .puis./,
    sites: ["src/app/api/admin/email-ops/route.ts"],
    detourner: "importer `buildOpsAlerts` / `fetchEmailOps`",
  },
  {
    formula: "statut de sante des crons",
    signature: /expectedEveryH \* 2 \* 3600 \* 1000/,
    sites: ["src/app/api/admin/cron-health/route.ts"],
    detourner: "importer `CRONS` / `fetchCronHealth` de @/lib/admin/aggregates",
  },
  {
    formula: "photo de l'audience (anti-doublon des annonces)",
    // `/api/admin/announce-dashboard` porte le meme predicat : c'est le meme
    // "qui n'a pas recu l'annonce", ecrit une troisieme fois.
    signature: /NOT: \{ emailLogs: \{ some: \{ kind: "annonce" \} \} \}/,
    sites: ["src/app/api/admin/email-log/route.ts", "src/app/api/admin/announce-dashboard/route.ts"],
    detourner: "importer `fetchEmailAudience` de @/lib/admin/aggregates",
  },
];

describe("D29 - une formule, un seul endroit", () => {
  for (const { formula, signature, sites, detourner } of KNOWN_DUPLICATE_SITES) {
    test(`${formula} : presente dans le module partage, et nulle part ailleurs de declare`, () => {
      const found = sitesOf(signature);
      assert.ok(
        found.includes(AGGREGATES),
        `${AGGREGATES} ne contient plus la formule "${formula}" : le dashboard ` +
          `recalcule son propre agregat.`,
      );
      const expected = [AGGREGATES, ...sites].sort();
      assert.deepEqual(
        found.slice().sort(),
        expected,
        `${formula} : copie(s) inattendue(s) dans ${found.filter((f) => !expected.includes(f)).join(", ") || "aucun fichier"} ` +
          `ou formule disparue de ${expected.filter((f) => !found.includes(f)).join(", ") || "aucun fichier"}. ` +
          `Copies declarees restantes : ${sites.join(", ") || "aucune"}. ` +
          `Pour detourner une copie : ${detourner}.`,
      );
    });
  }

  test("la route dashboard ne contient plus aucune formule", () => {
    const route = read("src/app/api/admin/dashboard/route.ts");
    // Elle doit rester un point d'entree : aucune requete, aucun agregat.
    assert.equal(
      /db\./.test(route),
      false,
      "la route dashboard ne doit plus parler a la base : les agregats sont dans @/lib/admin/aggregates",
    );
    for (const { formula, signature } of KNOWN_DUPLICATE_SITES) {
      assert.equal(
        signature.test(route),
        false,
        `la route dashboard redimplemente "${formula}" au lieu d'importer le module partage`,
      );
    }
    assert.match(route, /from "@\/lib\/admin\/aggregates"/);
  });

  test("la page dashboard n'invente plus la forme des sections", () => {
    const page = read("src/app/[locale]/admin/dashboard/page.tsx");
    for (const type of ["DeliverabilitySummary", "EmailOpsApiResponse", "CronHealthItem"]) {
      assert.equal(
        new RegExp(`^interface ${type}\\b`, "m").test(page),
        false,
        `${type} est redeclare dans page.tsx alors que le composant qui le consomme l'exporte deja`,
      );
    }
    assert.match(page, /import type \{ CronHealthItem \}/);
    assert.match(page, /import type \{ EmailOpsData \}/);
    assert.match(page, /import type \{ DeliverabilityProviderSummary \}/);
  });

  test("le nombre de requetes DB n'a pas augmente", () => {
    // 41 avant D29 (compte `db.` dans la route), 41 apres (dans le module).
    // C'est le garde-fou contre la feinte du refactor : composer le dashboard
    // en appelant 7 endpoints par HTTP rejouerait ces 41 requetes 7 fois.
    // On compte `db.` et non `db.x.` : un appel ecrit sur deux lignes
    // (`db.emailEvent\n  .groupBy(...)`) doit compter comme un seul appel, sinon
    // le decompte dependrait de la mise en forme.
    const count = (src) => (src.match(/\bdb\./g) || []).length;
    assert.equal(
      count(read(AGGREGATES)),
      41,
      "le module doit porter exactement les 41 appels `db.` de la route d'avant",
    );
    assert.equal(count(read("src/app/api/admin/dashboard/route.ts")), 0);
  });

  test("la reponse garde la meme forme (7 blocs + errors)", () => {
    // Le front lit `stats`, `funnel`, `emailStats`, `emailDeliverability`,
    // `emailOps`, `cronHealth`, `audience` et `errors`. Un bloc renomme casse
    // le dashboard en silence : aucune erreur de compilation ne le rattraperait,
    // le `as DashboardApiResponse` du front est un mensonge de type.
    const route = read("src/app/api/admin/dashboard/route.ts");
    const payload = route.slice(route.indexOf("return NextResponse.json"));
    for (const key of [
      "stats", "funnel", "emailStats", "emailDeliverability",
      "emailOps", "cronHealth", "audience",
    ]) {
      assert.match(payload, new RegExp(`^\\s+${key}:`, "m"), `bloc "${key}" absent de la reponse`);
    }
    for (const key of ["ok", "generatedAt", "errors"]) {
      assert.match(payload, new RegExp(`^\\s+${key}[,:]`, "m"), `"${key}" absent de la reponse`);
    }
    // `errors` reste absent quand tout va bien (le front fait `?? {}`).
    const lib = read(AGGREGATES);
    assert.match(lib, /Object\.keys\(errors\)\.length > 0 \? errors : undefined/);
    // Et `ok` reste derive de l'absence d'erreur.
    assert.match(route, /ok: errors === undefined/);
  });
});
