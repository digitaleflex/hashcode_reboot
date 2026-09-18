/**
 * Unit tests — validation pure du domaine ATELIERS.
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/workshop-validation.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - ALL of src/lib/workshop-validation.ts (validateWorkshopCreate/Update,
 *    validateWeekCreate, validateSessionCreate, validateActivityCreate,
 *    validateDeliverableUpsert, validateSubmission, validateReviewCreate,
 *    validateQuizUpsert, validateQuestionUpsert, parseAnswers)
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - workshop: slug kebab-case, title bounds, status enum, description cap
 *  - update: partial fields, slug immutable, invalid status
 *  - week/session: number ranges, skills tags cap, boolean flags strict
 *  - activity: kind enum, url http(s)
 *  - deliverable: 7 types
 *  - submission: URL required for URL types, text bounds, empty content
 *  - review: feedback mandatory for REVISION/REJECTED, optional APPROVED
 *  - quiz: passThreshold 0-100, maxAttempts 1-99 or null
 *  - question: options 2-10, correct indices bounded, multiple dedup
 *  - answers: shape only (number | number[]), negative index rejected
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirrors of src/lib/workshop-validation.ts ──

const WORKSHOP_STATUSES = ["draft", "published", "archived"];
const WORKSHOP_DOMAINS = ["web", "cybersecurity", "ai"];
const WORKSHOP_LEVELS = ["beginner", "practicing", "autonomous", "advanced"];
const ACTIVITY_KINDS = ["practice", "resource"];
const DELIVERABLE_TYPES = ["url", "github_repo", "pull_request", "project", "deployed_url", "screenshot", "text"];
const DELIVERABLE_URL_TYPES = ["url", "github_repo", "pull_request", "project", "deployed_url", "screenshot"];
const REVIEW_DECISIONS = ["APPROVED", "REVISION", "REJECTED"];
const QUESTION_TYPES = ["single", "multiple", "true_false"];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function optStr(v) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function parseHttpUrl(v) {
  const s = optStr(v);
  if (s === null) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.toString();
  } catch {
    return false;
  }
}

function intIn(v, min, max) {
  if (v === null || v === undefined || v === "") return false;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return false;
  return n;
}

function boolOpt(v, fallback) {
  if (v === undefined || v === null) return { ok: true, value: fallback };
  if (typeof v === "boolean") return { ok: true, value: v };
  return { ok: false };
}

function validateWorkshopCreate(body) {
  const slug = optStr(body.slug);
  if (!slug || slug.length < 3 || slug.length > 80 || !SLUG_RE.test(slug)) {
    return { ok: false, error: "Slug requis : 3-80 caractères, minuscules/chiffres/tirets (kebab-case)." };
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const description = optStr(body.description);
  if (description && description.length > 5000) {
    return { ok: false, error: "Description trop longue (max 5000 caractères)." };
  }
  const status = (body.status === undefined || body.status === null || body.status === "")
    ? "draft"
    : body.status;
  if (!WORKSHOP_STATUSES.includes(String(status))) {
    return { ok: false, error: "Statut invalide. Use: draft | published | archived." };
  }
  const domain = optStr(body.domain);
  if (domain && !WORKSHOP_DOMAINS.includes(domain)) {
    return { ok: false, error: "Domaine invalide." };
  }
  const level = optStr(body.level);
  if (level && !WORKSHOP_LEVELS.includes(level)) {
    return { ok: false, error: "Niveau invalide." };
  }
  return {
    ok: true,
    data: { slug, title, description, status: String(status), domain, level },
  };
}

function validateWorkshopUpdate(body) {
  const data = {};
  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
    if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
    data.title = title;
  }
  if (body.description !== undefined) {
    const description = optStr(body.description);
    if (description && description.length > 5000) {
      return { ok: false, error: "Description trop longue (max 5000 caractères)." };
    }
    data.description = description;
  }
  if (body.status !== undefined) {
    if (!WORKSHOP_STATUSES.includes(String(body.status))) {
      return { ok: false, error: "Statut invalide. Use: draft | published | archived." };
    }
    data.status = String(body.status);
  }
  if (body.domain !== undefined) {
    const domain = optStr(body.domain);
    if (domain && !WORKSHOP_DOMAINS.includes(domain)) {
      return { ok: false, error: "Domaine invalide." };
    }
    data.domain = domain;
  }
  if (body.level !== undefined) {
    const level = optStr(body.level);
    if (level && !WORKSHOP_LEVELS.includes(level)) {
      return { ok: false, error: "Niveau invalide." };
    }
    data.level = level;
  }
  if (body.slug !== undefined && body.slug !== null) {
    return { ok: false, error: "Le slug n'est pas modifiable." };
  }
  return { ok: true, data };
}

function validateWeekCreate(body) {
  const number = intIn(body.number, 1, 52);
  if (number === false) return { ok: false, error: "Numéro de semaine requis (entier 1-52)." };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const objective = optStr(body.objective);
  if (objective && objective.length > 1000) {
    return { ok: false, error: "Objectif trop long (max 1000 caractères)." };
  }
  return { ok: true, data: { number, title, objective } };
}

function validateSessionCreate(body) {
  const number = intIn(body.number, 1, 999);
  if (number === false) return { ok: false, error: "Numéro de séance requis (entier 1-999)." };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const objective = optStr(body.objective);
  if (objective && objective.length > 2000) {
    return { ok: false, error: "Objectif trop long (max 2000 caractères)." };
  }
  const program = optStr(body.program);
  if (program && program.length > 10000) {
    return { ok: false, error: "Programme trop long (max 10000 caractères)." };
  }
  let skills = "[]";
  if (body.skills !== undefined && body.skills !== null) {
    if (!Array.isArray(body.skills)) {
      return { ok: false, error: "skills doit être un tableau de chaînes." };
    }
    const tags = body.skills.map((t) => String(t).trim()).filter(Boolean);
    if (tags.length > 8) return { ok: false, error: "skills : 8 tags maximum." };
    if (tags.some((t) => t.length > 40)) {
      return { ok: false, error: "skills : chaque tag est limité à 40 caractères." };
    }
    skills = JSON.stringify(tags);
  }
  const deliverableRequired = boolOpt(body.deliverableRequired, true);
  if (!deliverableRequired.ok) {
    return { ok: false, error: "deliverableRequired doit être un booléen." };
  }
  const quizRequired = boolOpt(body.quizRequired, true);
  if (!quizRequired.ok) {
    return { ok: false, error: "quizRequired doit être un booléen." };
  }
  const eventId = optStr(body.eventId);
  if (eventId && eventId.length > 64) {
    return { ok: false, error: "eventId invalide." };
  }
  return {
    ok: true,
    data: {
      number,
      title,
      objective,
      program,
      skills,
      deliverableRequired: deliverableRequired.value,
      quizRequired: quizRequired.value,
      eventId,
    },
  };
}

function validateActivityCreate(body) {
  const order = intIn(body.order, 0, 999);
  if (order === false) return { ok: false, error: "Ordre requis (entier 0-999)." };
  const kind = body.kind === undefined || body.kind === "" ? "practice" : body.kind;
  if (!ACTIVITY_KINDS.includes(String(kind))) {
    return { ok: false, error: "kind invalide. Use: practice | resource." };
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const description = optStr(body.description);
  if (description && description.length > 2000) {
    return { ok: false, error: "Description trop longue (max 2000 caractères)." };
  }
  const url = parseHttpUrl(body.url);
  if (url === false) {
    return { ok: false, error: "URL invalide (http ou https attendu)." };
  }
  return { ok: true, data: { order, kind: String(kind), title, description, url } };
}

function validateDeliverableUpsert(body) {
  const type = optStr(body.type) ?? "url";
  if (!DELIVERABLE_TYPES.includes(type)) {
    return { ok: false, error: "Type de livrable invalide. Use: url | github_repo | pull_request | project | deployed_url | screenshot | text." };
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const description = optStr(body.description);
  if (description && description.length > 2000) {
    return { ok: false, error: "Description trop longue (max 2000 caractères)." };
  }
  const isRequired = boolOpt(body.isRequired, true);
  if (!isRequired.ok) {
    return { ok: false, error: "isRequired doit être un booléen." };
  }
  return {
    ok: true,
    data: { type: String(type), title, description, isRequired: isRequired.value },
  };
}

function validateSubmission(body, deliverableType) {
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return { ok: false, error: "Le contenu du livrable est requis." };
  if (DELIVERABLE_URL_TYPES.includes(deliverableType)) {
    const url = parseHttpUrl(content);
    if (url === null || url === false) {
      return { ok: false, error: "Une URL http(s) valide est attendue pour ce type de livrable." };
    }
    if (url.length > 2048) return { ok: false, error: "URL trop longue (max 2048 caractères)." };
    return { ok: true, data: { content: url } };
  }
  if (deliverableType === "text") {
    if (content.length > 10000) {
      return { ok: false, error: "Texte trop long (max 10000 caractères)." };
    }
    return { ok: true, data: { content } };
  }
  return { ok: false, error: "Type de livrable inconnu." };
}

function validateReviewCreate(body) {
  const decision = optStr(body.decision);
  if (!decision || !REVIEW_DECISIONS.includes(decision)) {
    return { ok: false, error: "Décision invalide. Use: APPROVED | REVISION | REJECTED." };
  }
  const feedback = optStr(body.feedback);
  if (feedback && feedback.length > 2000) {
    return { ok: false, error: "Feedback trop long (max 2000 caractères)." };
  }
  if (!feedback && (decision === "REVISION" || decision === "REJECTED")) {
    return { ok: false, error: "Un feedback est requis pour demander une correction ou rejeter." };
  }
  return { ok: true, data: { decision, feedback } };
}

function validateQuizUpsert(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const passThreshold = intIn(body.passThreshold === undefined ? 70 : body.passThreshold, 0, 100);
  if (passThreshold === false) {
    return { ok: false, error: "passThreshold doit être un entier 0-100 (%)." };
  }
  let maxAttempts = null;
  if (body.maxAttempts !== undefined && body.maxAttempts !== null && body.maxAttempts !== "") {
    const n = intIn(body.maxAttempts, 1, 99);
    if (n === false) return { ok: false, error: "maxAttempts doit être un entier 1-99." };
    maxAttempts = n;
  }
  const isRequired = boolOpt(body.isRequired, true);
  if (!isRequired.ok) {
    return { ok: false, error: "isRequired doit être un booléen." };
  }
  return { ok: true, data: { title, passThreshold, maxAttempts, isRequired: isRequired.value } };
}

function validateQuestionUpsert(body) {
  const order = intIn(body.order, 0, 999);
  if (order === false) return { ok: false, error: "Ordre requis (entier 0-999)." };
  const type = optStr(body.type);
  if (!type || !QUESTION_TYPES.includes(type)) {
    return { ok: false, error: "Type invalide. Use: single | multiple | true_false." };
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 3) return { ok: false, error: "Énoncé requis (min 3 caractères)." };
  if (prompt.length > 1000) return { ok: false, error: "Énoncé trop long (max 1000 caractères)." };
  let options;
  if (type === "true_false") {
    options = ["Vrai", "Faux"];
  } else {
    if (!Array.isArray(body.options)) {
      return { ok: false, error: "options doit être un tableau (2 à 10 choix)." };
    }
    options = body.options.map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2 || options.length > 10) {
      return { ok: false, error: "options doit contenir entre 2 et 10 choix non vides." };
    }
    if (options.some((o) => o.length > 200)) {
      return { ok: false, error: "options : chaque choix est limité à 200 caractères." };
    }
  }
  let correct;
  if (type === "multiple") {
    if (!Array.isArray(body.correct)) {
      return { ok: false, error: "correct doit être un tableau d'indices (multiple)." };
    }
    const idx = body.correct.map((c) => Number(c));
    if (
      idx.length < 1 ||
      idx.length > options.length ||
      idx.some((c) => !Number.isInteger(c) || c < 0 || c >= options.length) ||
      new Set(idx).size !== idx.length
    ) {
      return { ok: false, error: "correct : indices invalides pour les options fournies." };
    }
    correct = idx.sort((a, b) => a - b);
  } else {
    const idx = Number(body.correct);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return { ok: false, error: "correct : indice invalide pour les options fournies." };
    }
    correct = idx;
  }
  const points = intIn(body.points === undefined ? 1 : body.points, 1, 10);
  if (points === false) return { ok: false, error: "points doit être un entier 1-10." };
  return {
    ok: true,
    data: {
      order,
      type,
      prompt,
      optionsJson: JSON.stringify(options),
      correctJson: JSON.stringify(correct),
      points,
    },
  };
}

function parseAnswers(v) {
  if (!Array.isArray(v)) return { ok: false, error: "answers doit être un tableau." };
  const answers = [];
  for (const entry of v) {
    if (typeof entry === "number") {
      if (!Number.isInteger(entry) || entry < 0) {
        return { ok: false, error: "answers : indices invalides." };
      }
      answers.push(entry);
    } else if (Array.isArray(entry)) {
      const idx = entry.map((c) => Number(c));
      if (idx.some((c) => !Number.isInteger(c) || c < 0)) {
        return { ok: false, error: "answers : indices invalides." };
      }
      answers.push(idx);
    } else {
      return { ok: false, error: "answers : chaque entrée doit être un indice ou un tableau." };
    }
  }
  return { ok: true, answers };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("validateWorkshopCreate", () => {
  test("happy path — status/domain/level par défaut ou valides", () => {
    const r = validateWorkshopCreate({
      slug: "maitrise-github-bases",
      title: "Maîtrise GitHub — Bases",
      status: "published",
      domain: "web",
      level: "beginner",
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.slug, "maitrise-github-bases");
    assert.equal(r.data.status, "published");
  });

  test("rejette un slug non kebab-case", () => {
    assert.equal(validateWorkshopCreate({ slug: "Ma Ceinture", title: "Titre valide" }).ok, false);
    assert.equal(validateWorkshopCreate({ slug: "ab", title: "Titre valide" }).ok, false);
  });

  test("bornes du titre", () => {
    assert.equal(validateWorkshopCreate({ slug: "ok-slug", title: "ab" }).ok, false);
    assert.equal(validateWorkshopCreate({ slug: "ok-slug", title: "x".repeat(201) }).ok, false);
  });

  test("statut hors union rejeté", () => {
    assert.equal(validateWorkshopCreate({ slug: "ok-slug", title: "Titre", status: "live" }).ok, false);
  });
});

describe("validateWorkshopUpdate", () => {
  test("mise à jour partielle", () => {
    const r = validateWorkshopUpdate({ status: "archived" });
    assert.deepEqual(r, { ok: true, data: { status: "archived" } });
  });

  test("slug immuable", () => {
    assert.equal(validateWorkshopUpdate({ slug: "autre" }).ok, false);
  });

  test("statut invalide rejeté", () => {
    assert.equal(validateWorkshopUpdate({ status: "nope" }).ok, false);
  });
});

describe("validateWeekCreate / validateSessionCreate", () => {
  test("semaine valide", () => {
    const r = validateWeekCreate({ number: 1, title: "Découverte", objective: "Comprendre Git" });
    assert.equal(r.ok, true);
    assert.equal(r.data.number, 1);
  });

  test("semaine : numéro 0 rejeté", () => {
    assert.equal(validateWeekCreate({ number: 0, title: "Titre" }).ok, false);
  });

  test("séance valide avec skills", () => {
    const r = validateSessionCreate({ number: 3, title: "Q/R + Mini-projet", skills: ["git", "cli"] });
    assert.equal(r.ok, true);
    assert.equal(r.data.skills, '["git","cli"]');
    assert.equal(r.data.deliverableRequired, true); // défaut
  });

  test("skills : plus de 8 tags rejeté", () => {
    const r = validateSessionCreate({ number: 1, title: "Titre", skills: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] });
    assert.equal(r.ok, false);
  });

  test("flags booléens stricts", () => {
    assert.equal(validateSessionCreate({ number: 1, title: "Titre", quizRequired: "yes" }).ok, false);
  });
});

describe("validateActivityCreate", () => {
  test("resource avec URL valide", () => {
    const r = validateActivityCreate({ order: 0, kind: "resource", title: "Doc Git officielle", url: "https://git-scm.com/doc" });
    assert.equal(r.ok, true);
    assert.equal(r.data.kind, "resource");
  });

  test("kind invalide rejeté", () => {
    assert.equal(validateActivityCreate({ order: 0, kind: "quiz", title: "Titre" }).ok, false);
  });

  test("URL invalide rejetée", () => {
    assert.equal(validateActivityCreate({ order: 0, kind: "resource", title: "Titre", url: "ftp://x" }).ok, false);
  });
});

describe("validateDeliverableUpsert", () => {
  test("type par défaut url", () => {
    const r = validateDeliverableUpsert({ title: "Repo GitHub du mini-projet" });
    assert.equal(r.ok, true);
    assert.equal(r.data.type, "url");
  });

  test("type inconnu rejeté", () => {
    assert.equal(validateDeliverableUpsert({ type: "video", title: "Titre" }).ok, false);
  });
});

describe("validateSubmission", () => {
  test("type url : URL valide normalisée", () => {
    const r = validateSubmission({ content: "https://github.com/user/repo" }, "github_repo");
    assert.equal(r.ok, true);
    assert.equal(r.data.content, "https://github.com/user/repo");
  });

  test("type url : texte brut rejeté", () => {
    assert.equal(validateSubmission({ content: "regardez mon repo" }, "url").ok, false);
  });

  test("type text : contenu libre accepté", () => {
    const r = validateSubmission({ content: "Ma synthèse de la séance…" }, "text");
    assert.equal(r.ok, true);
  });

  test("contenu vide rejeté", () => {
    assert.equal(validateSubmission({ content: "   " }, "text").ok, false);
  });

  test("URL trop longue rejetée", () => {
    assert.equal(validateSubmission({ content: "https://x.com/" + "a".repeat(2048) }, "url").ok, false);
  });
});

describe("validateReviewCreate", () => {
  test("REVISION sans feedback rejetée", () => {
    const r = validateReviewCreate({ decision: "REVISION" });
    assert.equal(r.ok, false);
    assert.match(r.error, /feedback est requis/);
  });

  test("REJECTED sans feedback rejetée", () => {
    assert.equal(validateReviewCreate({ decision: "REJECTED" }).ok, false);
  });

  test("APPROVED sans feedback acceptée", () => {
    assert.deepEqual(validateReviewCreate({ decision: "APPROVED" }), {
      ok: true,
      data: { decision: "APPROVED", feedback: null },
    });
  });

  test("décision inconnue rejetée", () => {
    assert.equal(validateReviewCreate({ decision: "MAYBE" }).ok, false);
  });
});

describe("validateQuizUpsert", () => {
  test("valeurs par défaut (seuil 70, tentatives illimitées)", () => {
    const r = validateQuizUpsert({ title: "Quiz Git basics" });
    assert.equal(r.data.passThreshold, 70);
    assert.equal(r.data.maxAttempts, null);
    assert.equal(r.data.isRequired, true);
  });

  test("seuil hors 0-100 rejeté", () => {
    assert.equal(validateQuizUpsert({ title: "Quiz", passThreshold: 101 }).ok, false);
    assert.equal(validateQuizUpsert({ title: "Quiz", passThreshold: -1 }).ok, false);
  });

  test("maxAttempts 0 rejeté ; 3 accepté", () => {
    assert.equal(validateQuizUpsert({ title: "Quiz", maxAttempts: 0 }).ok, false);
    assert.equal(validateQuizUpsert({ title: "Quiz", maxAttempts: 3 }).data.maxAttempts, 3);
  });
});

describe("validateQuestionUpsert", () => {
  test("single : options + indice normalisés en JSON", () => {
    const r = validateQuestionUpsert({
      order: 0,
      type: "single",
      prompt: "Que fait git commit ?",
      options: ["Enregistre localement", "Pousse vers GitHub"],
      correct: 0,
    });
    assert.equal(r.ok, true);
    assert.deepEqual(JSON.parse(r.data.optionsJson), ["Enregistre localement", "Pousse vers GitHub"]);
    assert.equal(JSON.parse(r.data.correctJson), 0);
  });

  test("true_false : options par défaut", () => {
    const r = validateQuestionUpsert({ order: 1, type: "true_false", prompt: "git push est local ?", correct: 1 });
    assert.deepEqual(JSON.parse(r.data.optionsJson), ["Vrai", "Faux"]);
    assert.equal(JSON.parse(r.data.correctJson), 1);
  });

  test("correct hors bornes rejeté", () => {
    assert.equal(
      validateQuestionUpsert({ order: 0, type: "single", prompt: "Q ?", options: ["a", "b"], correct: 2 }).ok,
      false,
    );
  });

  test("multiple : doublons rejetés, tri appliqué", () => {
    assert.equal(
      validateQuestionUpsert({ order: 0, type: "multiple", prompt: "Choisir", options: ["a", "b", "c"], correct: [0, 0] }).ok,
      false,
    );
    const r = validateQuestionUpsert({ order: 0, type: "multiple", prompt: "Choisir", options: ["a", "b", "c"], correct: [2, 0] });
    assert.equal(r.ok, true);
    assert.deepEqual(JSON.parse(r.data.correctJson), [0, 2]);
  });

  test("moins de 2 options rejeté", () => {
    assert.equal(
      validateQuestionUpsert({ order: 0, type: "single", prompt: "Q ?", options: ["seule"], correct: 0 }).ok,
      false,
    );
  });
});

describe("parseAnswers (forme)", () => {
  test("indices et tableaux d'indices acceptés", () => {
    const r = parseAnswers([0, [1, 2], 1]);
    assert.deepEqual(r, { ok: true, answers: [0, [1, 2], 1] });
  });

  test("non-tableau rejeté", () => {
    assert.equal(parseAnswers({ 0: 1 }).ok, false);
  });

  test("entrée texte rejetée", () => {
    assert.equal(parseAnswers(["a"]).ok, false);
  });

  test("indice négatif rejeté", () => {
    assert.equal(parseAnswers([-1]).ok, false);
    assert.equal(parseAnswers([[0, -1]]).ok, false);
  });
});
