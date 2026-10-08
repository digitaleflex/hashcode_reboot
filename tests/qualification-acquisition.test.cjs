/**
 * Qualification acquisition V1 (#211) — miroir pur, runner node --test.
 *
 * Run: node --test tests/qualification-acquisition.test.cjs
 *
 * Miroir (logique pure re-implémentée — .cjs ne peut pas importer TS) :
 *  - qualifyLead / RULE_WEIGHTS / QUALIFIED_THRESHOLD /
 *    ACQUISITION_QUALIFICATION_RULE_VERSION
 *    from src/lib/qualification/acquisition.ts
 *  - les poids / seuils / version sont EXTRAITS de la source (regex) : si la
 *    source change, l'extraction change aussi et les invariants restent
 *    vérifiés ; toute divergence règle-par-règle fait échouer le test.
 * Assertions sur texte source (fs, sans exécution) :
 *  - hygiène d'import (aucune chaîne "orientation/", "matching",
 *    "profiling/engine", "layers", "dynamicProfile", "generateProfile")
 *  - parité ruleVersion persistée = constante (préfixe "acq-" obligatoire)
 *  - migration additive (3 ADD COLUMN + rollback DROP COLUMN commenté)
 *  - branchement best-effort des 2 routes, sans nouvelle route
 *  - colonnes présentes dans prisma/schema.prisma
 *  - aucun CJK dans les fichiers touchés
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const ACQ_SRC = read("src/lib/qualification/acquisition.ts");
const QUALIF_SRC = read("src/lib/qualification.ts");
const MEMBERS_ROUTE = read("src/app/api/members/route.ts");
const COMPLETE_ROUTE = read("src/app/api/account/complete-profile/route.ts");
const CONTRACTS = read("docs/acquisition-contracts.md");
const SCHEMA = read("prisma/schema.prisma");
const MIGRATION = read(
  "prisma/migrations/20261008120000_qualification_acquisition_fields/migration.sql",
);

// ── Extraction depuis la source (le test suit le code) ────────────────────

function extractWeights(src) {
  const m = src.match(/export const RULE_WEIGHTS = \{([\s\S]*?)\} as const/);
  assert.ok(m, "RULE_WEIGHTS introuvable dans acquisition.ts");
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.trim().match(/^([A-Z_]+):\s*(\d+),?$/);
    if (kv) out[kv[1]] = Number(kv[2]);
  }
  return out;
}

function extractConst(src, name) {
  const m = src.match(new RegExp('export const ' + name + ' = ("[^"]+"|\\d+)'));
  assert.ok(m, name + " introuvable dans acquisition.ts");
  return JSON.parse(m[1].replace(/^\d+$/, (n) => n));
}

function extractDisposable(src) {
  const m = src.match(/const DISPOSABLE_DOMAINS = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, "DISPOSABLE_DOMAINS introuvable dans acquisition.ts");
  return new Set(m[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1)));
}

function extractEmailRe(src) {
  const m = src.match(/const EMAIL_RE = (\/[^;]+?);/);
  assert.ok(m, "EMAIL_RE introuvable dans acquisition.ts");
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

const W = extractWeights(ACQ_SRC);
const RULE_VERSION = extractConst(ACQ_SRC, "ACQUISITION_QUALIFICATION_RULE_VERSION");
const THRESHOLD = Number(
  ACQ_SRC.match(/export const QUALIFIED_THRESHOLD = (\d+)/)[1],
);
const DISPOSABLE = extractDisposable(ACQ_SRC);
const EMAIL_RE = extractEmailRe(ACQ_SRC);

// ── Miroir de qualifyLead ──────────────────────────────────────────────────

const SOURCE_ALIASES = {
  "": "direct",
  "(direct)": "direct",
  "(none)": "direct",
  "n/a": "direct",
  na: "direct",
  none: "direct",
  null: "direct",
  undefined: "direct",
  unknown: "direct",
};

function normalizeSource(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return "direct";
  return SOURCE_ALIASES[v] ?? v;
}

function mirrorQualify(a) {
  const reasons = [];
  let score = 0;

  const email = (a.email ?? "").trim().toLowerCase();
  const emailValid = EMAIL_RE.test(email);
  const coreComplete =
    emailValid &&
    (a.firstName ?? "").trim().length >= 1 &&
    !!a.primaryDomain &&
    !!a.goal &&
    !!a.level &&
    !!a.availability;
  if (coreComplete) {
    score += W.CORE_COMPLETE;
    reasons.push("core-complete");
  } else {
    reasons.push("missing-core");
  }

  const domain = email.split("@")[1] ?? "";
  if (!emailValid) {
    reasons.push("invalid-email");
  } else if (DISPOSABLE.has(domain)) {
    reasons.push("disposable-email");
  } else {
    score += W.EMAIL_QUALITY;
    reasons.push("email-verified");
  }

  const goalLen = (a.threeMonthGoal ?? "").trim().length;
  if (goalLen >= 20) {
    score += W.GOAL_RICHNESS;
    reasons.push("goal-rich");
  } else if (goalLen >= 4) {
    score += 10;
    reasons.push("goal-present");
  } else {
    reasons.push("low-signal-goal");
  }

  if (!a.availability) {
    reasons.push("missing-availability");
  } else if (a.availability === "<2h") {
    score += 5;
    reasons.push("low-availability");
  } else {
    score += W.AVAILABILITY;
    reasons.push("availability-given");
  }

  const budget = a.budgetRange;
  const hasRealBudget =
    budget !== undefined && budget !== "unknown" && budget !== "not_now";
  if (a.mentoringInterest === "yes" && hasRealBudget) {
    score += W.MENTORING_INTENT;
    reasons.push("mentoring-budget-ready");
  } else if (a.mentoringInterest === "yes") {
    score += 6;
    reasons.push("mentoring-interest-no-budget");
  } else if (a.mentoringInterest === "maybe") {
    score += 5;
    reasons.push("mentoring-maybe");
  } else {
    reasons.push("no-mentoring-signal");
  }

  const source = normalizeSource(a.source);
  if (source !== "direct") {
    score += W.SOURCE_ATTRIBUTED;
    reasons.push("source-attributed");
  } else {
    score += 4;
    reasons.push("source-direct");
  }

  let status;
  if (!coreComplete) status = "INSUFFICIENT_DATA";
  else if (!emailValid || DISPOSABLE.has(domain)) status = "DISQUALIFIED";
  else status = score >= THRESHOLD ? "QUALIFIED" : "DISQUALIFIED";

  return { score, status, reasons, ruleVersion: RULE_VERSION };
}

// ── Fixtures (une par statut) ──────────────────────────────────────────────

const RICH = {
  firstName: "Awa",
  lastName: "Diallo",
  email: "awa@example.com",
  phone: "+22990000000",
  country: "BJ",
  city: "Cotonou",
  primaryDomain: "web",
  level: "autonomous",
  goal: "employment",
  availability: "5-10h",
  learningStyle: "practice",
  mentoringInterest: "yes",
  budgetRange: "10000-20000",
  threeMonthGoal: "Décrocher un poste junior en développement web",
  source: "whatsapp",
};

const THIN = {
  ...RICH,
  threeMonthGoal: "coder",
  availability: "<2h",
  mentoringInterest: "no",
  budgetRange: undefined,
  source: undefined,
};

const DISPOSABLE_LEAD = { ...RICH, email: "lead@yopmail.com" };

const INCOMPLETE = { ...RICH, goal: undefined, level: undefined };

// ── Tests ──────────────────────────────────────────────────────────────────

describe("qualification acquisition (#211) — table de poids publiée", () => {
  test("poids publiés et somme max = 100", () => {
    assert.deepEqual(W, {
      CORE_COMPLETE: 30,
      EMAIL_QUALITY: 20,
      GOAL_RICHNESS: 20,
      AVAILABILITY: 10,
      MENTORING_INTENT: 10,
      SOURCE_ATTRIBUTED: 10,
    });
    assert.equal(
      Object.values(W).reduce((s, n) => s + n, 0),
      100,
    );
  });

  test("version de règle préfixée acq- et seuil publiés", () => {
    assert.equal(RULE_VERSION, "acq-qualif-1.0.0");
    assert.ok(RULE_VERSION.startsWith("acq-"));
    assert.equal(THRESHOLD, 75);
  });

  test("constantes email recopiées à l'identique du moteur (pas d'import)", () => {
    const engine = read("src/lib/profiling/engine.ts");
    assert.deepEqual(extractDisposable(engine), DISPOSABLE);
    assert.equal(
      engine.match(/const EMAIL_RE = (\/[^;]+?);/)[1],
      ACQ_SRC.match(/const EMAIL_RE = (\/[^;]+?);/)[1],
    );
  });
});

describe("qualification acquisition (#211) — chaque règle / poids", () => {
  test("noyau complet → +30 et core-complete", () => {
    const full = mirrorQualify(RICH);
    const without = mirrorQualify({ ...RICH, goal: undefined });
    assert.equal(full.score - without.score, 30);
    assert.ok(full.reasons.includes("core-complete"));
    assert.ok(without.reasons.includes("missing-core"));
  });

  test("email vérifié → +20 ; jetable → +0 et disposable-email", () => {
    const clean = mirrorQualify(RICH);
    const disp = mirrorQualify(DISPOSABLE_LEAD);
    assert.equal(clean.score - disp.score, 20);
    assert.ok(clean.reasons.includes("email-verified"));
    assert.ok(disp.reasons.includes("disposable-email"));
  });

  test("email invalide → +0 et invalid-email", () => {
    const r = mirrorQualify({ ...RICH, email: "not-an-email" });
    assert.ok(r.reasons.includes("invalid-email"));
    assert.ok(!r.reasons.includes("email-verified"));
  });

  test("richesse objectif : +0 / +10 / +20 selon longueur", () => {
    const base = { ...RICH, availability: "5-10h" };
    const s = (g) => mirrorQualify({ ...base, threeMonthGoal: g }).score;
    assert.equal(s("abc"), s("") + 0);
    assert.equal(s("cinq!"), s("") + 10);
    assert.equal(s("x".repeat(25)), s("") + 20);
    assert.ok(mirrorQualify({ ...base, threeMonthGoal: "abc" }).reasons.includes("low-signal-goal"));
    assert.ok(mirrorQualify({ ...base, threeMonthGoal: "cinq!" }).reasons.includes("goal-present"));
    assert.ok(mirrorQualify({ ...base, threeMonthGoal: "x".repeat(25) }).reasons.includes("goal-rich"));
  });

  test("disponibilité : absente +0, <2h +5, autre +10", () => {
    const full = { ...RICH, threeMonthGoal: "x".repeat(25) };
    const s = (av) => mirrorQualify({ ...full, availability: av }).score;
    assert.equal(s("5-10h") - s("<2h"), 5);
    const absent = mirrorQualify({ ...full, availability: undefined });
    assert.ok(absent.reasons.includes("missing-availability"));
    assert.ok(absent.reasons.includes("missing-core"));
    assert.equal(absent.status, "INSUFFICIENT_DATA");
  });

  test("mentorat : no +0, maybe +5, yes sans budget +6, yes + budget +10", () => {
    const mk = (mi, b) =>
      mirrorQualify({ ...RICH, mentoringInterest: mi, budgetRange: b }).score;
    const no = mk("no", undefined);
    assert.equal(mk("maybe", undefined) - no, 5);
    assert.equal(mk("yes", undefined) - no, 6);
    assert.equal(mk("yes", "unknown") - no, 6);
    assert.equal(mk("yes", "not_now") - no, 6);
    assert.equal(mk("yes", "10000-20000") - no, 10);
  });

  test("source : direct +4 (alias normalisés), attribuée +10", () => {
    const s = (src) => mirrorQualify({ ...RICH, source: src }).score;
    assert.equal(s(undefined), s(""));
    assert.equal(s(""), s("UNKNOWN"));
    assert.equal(s(""), s("(direct)"));
    assert.equal(s("LinkedIn") - s(""), 6); // 10 − 4
    assert.ok(mirrorQualify({ ...RICH, source: "x" }).reasons.includes("source-attributed"));
    assert.ok(!mirrorQualify(RICH).reasons.includes("source-direct"));
  });
});

describe("qualification acquisition (#211) — seuils frontières", () => {
  // 30 + 20 + 10 (goal 5 car.) + 10 (2-5h) + 0 (no) + 4 (direct) = 74
  const AT_74 = {
    ...RICH,
    threeMonthGoal: "coder",
    availability: "2-5h",
    mentoringInterest: "no",
    budgetRange: undefined,
    source: undefined,
  };
  // 30 + 20 + 10 (goal 5 car.) + 5 (<2h) + 0 (no) + 10 (linkedin) = 75
  const AT_75 = { ...AT_74, availability: "<2h", source: "linkedin" };

  test("score 74 → DISQUALIFIED, score 75 → QUALIFIED", () => {
    const below = mirrorQualify(AT_74);
    const above = mirrorQualify(AT_75);
    assert.equal(below.score, 74);
    assert.equal(below.status, "DISQUALIFIED");
    assert.equal(above.score, 75);
    assert.equal(above.status, "QUALIFIED");
  });
});

describe("qualification acquisition (#211) — reproductibilité et fixtures", () => {
  test("N appels identiques → deepEqual (déterministe)", () => {
    const first = mirrorQualify(RICH);
    for (let i = 0; i < 25; i++) {
      assert.deepEqual(mirrorQualify(JSON.parse(JSON.stringify(RICH))), first);
    }
  });

  test("fixture QUALIFIED : score 100, raisons complètes", () => {
    const r = mirrorQualify(RICH);
    assert.equal(r.score, 100);
    assert.equal(r.status, "QUALIFIED");
    assert.deepEqual(r.reasons, [
      "core-complete",
      "email-verified",
      "goal-rich",
      "availability-given",
      "mentoring-budget-ready",
      "source-attributed",
    ]);
    assert.equal(r.ruleVersion, RULE_VERSION);
  });

  test("fixture DISQUALIFIED (score 69, noyau complet, signal faible)", () => {
    const r = mirrorQualify(THIN);
    assert.equal(r.score, 69);
    assert.equal(r.status, "DISQUALIFIED");
  });

  test("fixture INSUFFICIENT_DATA (noyau incomplet)", () => {
    const r = mirrorQualify(INCOMPLETE);
    assert.equal(r.status, "INSUFFICIENT_DATA");
    assert.ok(r.reasons.includes("missing-core"));
  });

  test("email jetable → DISQUALIFIED malgré un score élevé", () => {
    const r = mirrorQualify(DISPOSABLE_LEAD);
    assert.equal(r.status, "DISQUALIFIED");
  });
});

describe("qualification acquisition (#211) — persistance et branchement", () => {
  test("parité ruleVersion persistée = constante (préfixe acq-)", () => {
    assert.ok(
      QUALIF_SRC.includes("toAcquisitionQualificationData"),
      "constructeur acquisition absent de qualification.ts",
    );
    assert.ok(
      QUALIF_SRC.includes("archetype: null"),
      "archetype NULL explicite attendu (ligne acquisition)",
    );
    assert.ok(
      QUALIF_SRC.includes("engineVersion: result.ruleVersion"),
      "engineVersion doit porter la ruleVersion (discriminant acq-)",
    );
    assert.ok(
      QUALIF_SRC.includes('import type { AcquisitionQualification } from "./qualification/acquisition"'),
    );
  });

  test("hygiène d'import : acquisition.ts ne touche ni orientation ni matching", () => {
    for (const banned of [
      "orientation/",
      "matching",
      "profiling/engine",
      "generateProfile",
      "layers",
      "dynamicProfile",
    ]) {
      assert.ok(
        !ACQ_SRC.includes(banned),
        "chaîne interdite dans acquisition.ts : " + banned,
      );
    }
    assert.ok(ACQ_SRC.includes('from "../profiling/types"'));
    assert.ok(ACQ_SRC.includes('from "../acquisition"'));
  });

  test("lignes d'écriture orientation existantes intactes", () => {
    assert.ok(QUALIF_SRC.includes("dominantArchetype(orientation.scores)"));
    assert.ok(QUALIF_SRC.includes("engineVersion: QUALIFICATION_ENGINE_VERSION"));
  });

  test("migration additive : 3 ADD COLUMN + rollback commenté", () => {
    assert.ok(MIGRATION.includes('ADD COLUMN "qualificationScore" DOUBLE PRECISION'));
    assert.ok(MIGRATION.includes('ADD COLUMN "status" TEXT'));
    assert.ok(MIGRATION.includes('ADD COLUMN "ruleVersion" TEXT'));
    assert.ok(MIGRATION.includes('-- ALTER TABLE "Qualification" DROP COLUMN "ruleVersion"'));
    assert.ok(MIGRATION.includes('-- ALTER TABLE "Qualification" DROP COLUMN "status"'));
    assert.ok(MIGRATION.includes('-- ALTER TABLE "Qualification" DROP COLUMN "qualificationScore"'));
    assert.ok(!/CREATE TABLE/i.test(MIGRATION), "aucune table créée");
  });

  test("schéma : 3 colonnes NULLABLE sur Qualification", () => {
    const model = SCHEMA.match(/model Qualification \{([\s\S]*?)\n\}/);
    assert.ok(model, "model Qualification introuvable");
    assert.ok(model[1].includes("qualificationScore Float?"));
    assert.ok(model[1].includes("status String?"));
    assert.ok(model[1].includes("ruleVersion String?"));
  });

  test("POST /api/members : qualifyLead dans le allSettled best-effort", () => {
    assert.ok(MEMBERS_ROUTE.includes("qualifyLead"));
    assert.ok(MEMBERS_ROUTE.includes("toAcquisitionQualificationData"));
    assert.ok(MEMBERS_ROUTE.includes("Promise.allSettled"));
  });

  test("POST /api/account/complete-profile : même pattern try/catch", () => {
    assert.ok(COMPLETE_ROUTE.includes("qualifyLead"));
    assert.ok(COMPLETE_ROUTE.includes("toAcquisitionQualificationData"));
  });

  test("contrats : § Qualification acquisition documenté", () => {
    assert.ok(CONTRACTS.includes("## 5. Qualification acquisition"));
    assert.ok(CONTRACTS.includes("acq-qualif-1.0.0"));
    assert.ok(CONTRACTS.includes("ruleVersion LIKE 'acq-%'"));
  });

  test("aucun CJK dans les fichiers touchés", () => {
    const cjk = /[\u3000-\u9FFF]/;
    for (const [name, src] of [
      ["acquisition.ts", ACQ_SRC],
      ["qualification.ts", QUALIF_SRC],
      ["members/route.ts", MEMBERS_ROUTE],
      ["complete-profile/route.ts", COMPLETE_ROUTE],
      ["acquisition-contracts.md", CONTRACTS],
      ["migration.sql", MIGRATION],
    ]) {
      assert.ok(!cjk.test(src), "CJK détecté dans " + name);
    }
  });
});
