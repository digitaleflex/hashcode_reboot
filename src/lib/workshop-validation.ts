/**
 * HASHCODE REBOOT — validation partagée du domaine ATELIERS.
 *
 * Même philosophie que events-validation.ts : fonctions pures, enums
 * fermées en union TS, retours { ok, data } | { ok, error }, utilisées
 * par les routes API membre et admin pour garantir les mêmes règles
 * des deux côtés. Testée en miroir CJS (tests/workshop-validation.test.cjs).
 *
 * Couvert :
 * - Workshop : slug kebab-case unique (3-80), titre 3-200, description
 *   ≤5000, status draft|published|archived, domain/level comme les Events
 * - Week / Session : numéros entiers, longueurs bornées, skills JSON
 *   (max 8 tags), flags de validation effective
 * - Activity : kind practice|resource, url http(s) optionnelle
 * - Deliverable : 7 types, isRequired
 * - Submission : contenu requis, URL http(s) OBLIGATOIRE pour les types
 *   url/github_repo/pull_request/project/deployed_url/screenshot
 * - Review : decision APPROVED|REVISION|REJECTED, feedback obligatoire
 *   pour REVISION et REJECTED
 * - Quiz / Question : seuil 0-100, tentatives 1-99 ou illimitées,
 *   options ≥2, réponses correctes bornées aux options
 * - parseAnswers : forme des réponses de quiz (array de number|number[])
 *
 * NOTE : le scoring et la progression sont dans workshop-quiz.ts et
 * workshop-progression.ts (issues #82/#83), pas ici.
 */

import { EVENT_DOMAINS, EVENT_LEVELS } from "./events-validation";

// ── Unions fermées ──────────────────────────────────────────────────────────

export const WORKSHOP_STATUSES = ["draft", "published", "archived"] as const;
export type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];

export const WORKSHOP_DOMAINS = EVENT_DOMAINS;
export const WORKSHOP_LEVELS = EVENT_LEVELS;

export const ACTIVITY_KINDS = ["practice", "resource"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const DELIVERABLE_TYPES = [
  "url",
  "github_repo",
  "pull_request",
  "project",
  "deployed_url",
  "screenshot",
  "text",
] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

/** Types de livrable dont la preuve est une URL http(s). */
export const DELIVERABLE_URL_TYPES = [
  "url",
  "github_repo",
  "pull_request",
  "project",
  "deployed_url",
  "screenshot",
] as const;

export const SUBMISSION_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REVISION",
  "REJECTED",
] as const;

export const REVIEW_DECISIONS = ["APPROVED", "REVISION", "REJECTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const QUESTION_TYPES = ["single", "multiple", "true_false"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ENROLLMENT_STATUSES = ["active", "completed", "dropped"] as const;

/** Slug kebab-case : lettres minuscules, chiffres, tirets simples. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Fail = { ok: false; error: string };
type Pass<T> = { ok: true; data: T };

// ── Helpers ─────────────────────────────────────────────────────────────────

function optStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

/** Retourne l'URL normalisée, null si vide, false si invalide. */
function parseHttpUrl(v: unknown): string | null | false {
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

function intIn(v: unknown, min: number, max: number): number | false {
  if (v === null || v === undefined || v === "") return false;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return false;
  return n;
}

/**
 * Booléen optionnel : valeur par défaut si absent, `null` si non
 * booléen (le `false` explicite est une valeur valide, pas une erreur).
 */
function boolOpt(v: unknown, fallback: boolean): { ok: true; value: boolean } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, value: fallback };
  if (typeof v === "boolean") return { ok: true, value: v };
  return { ok: false };
}

/** Map helpers dupliqués côté miroir CJS — à synchroniser. */

// ── Workshop ────────────────────────────────────────────────────────────────

export interface WorkshopCreateData {
  slug: string;
  title: string;
  description: string | null;
  status: WorkshopStatus;
  domain: string | null;
  level: string | null;
}

export function validateWorkshopCreate(
  body: Record<string, unknown>,
): Pass<WorkshopCreateData> | Fail {
  const slug = optStr(body.slug);
  if (!slug || slug.length < 3 || slug.length > 80 || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: "Slug requis : 3-80 caractères, minuscules/chiffres/tirets (kebab-case).",
    };
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
  if (!(WORKSHOP_STATUSES as readonly string[]).includes(String(status))) {
    return { ok: false, error: "Statut invalide. Use: draft | published | archived." };
  }
  const domain = optStr(body.domain);
  if (domain && !(WORKSHOP_DOMAINS as readonly string[]).includes(domain)) {
    return { ok: false, error: "Domaine invalide." };
  }
  const level = optStr(body.level);
  if (level && !(WORKSHOP_LEVELS as readonly string[]).includes(level)) {
    return { ok: false, error: "Niveau invalide." };
  }
  return {
    ok: true,
    data: {
      slug,
      title,
      description,
      status: String(status) as WorkshopStatus,
      domain,
      level,
    },
  };
}

export interface WorkshopUpdateData {
  title?: string;
  description?: string | null;
  status?: WorkshopStatus;
  domain?: string | null;
  level?: string | null;
}

/**
 * Mise à jour partielle du workshop. Le slug est IMMUABLE (identité des
 * liens /dashboard/ateliers/[slug] et clé de seed).
 */
export function validateWorkshopUpdate(
  body: Record<string, unknown>,
): Pass<WorkshopUpdateData> | Fail {
  const data: WorkshopUpdateData = {};
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
    if (!(WORKSHOP_STATUSES as readonly string[]).includes(String(body.status))) {
      return { ok: false, error: "Statut invalide. Use: draft | published | archived." };
    }
    data.status = String(body.status) as WorkshopStatus;
  }
  if (body.domain !== undefined) {
    const domain = optStr(body.domain);
    if (domain && !(WORKSHOP_DOMAINS as readonly string[]).includes(domain)) {
      return { ok: false, error: "Domaine invalide." };
    }
    data.domain = domain;
  }
  if (body.level !== undefined) {
    const level = optStr(body.level);
    if (level && !(WORKSHOP_LEVELS as readonly string[]).includes(level)) {
      return { ok: false, error: "Niveau invalide." };
    }
    data.level = level;
  }
  if (body.slug !== undefined && body.slug !== null) {
    return { ok: false, error: "Le slug n'est pas modifiable." };
  }
  return { ok: true, data };
}

// ── Week / Session ──────────────────────────────────────────────────────────

export interface WeekCreateData {
  number: number;
  title: string;
  objective: string | null;
}

export function validateWeekCreate(body: Record<string, unknown>): Pass<WeekCreateData> | Fail {
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

export interface SessionCreateData {
  number: number;
  title: string;
  objective: string | null;
  program: string | null;
  skills: string; // JSON string
  deliverableRequired: boolean;
  quizRequired: boolean;
  eventId: string | null;
}

export function validateSessionCreate(
  body: Record<string, unknown>,
): Pass<SessionCreateData> | Fail {
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

  // skills : tableau JSON de 0..8 tags de 40 caractères max.
  let skills = "[]";
  if (body.skills !== undefined && body.skills !== null) {
    if (!Array.isArray(body.skills)) {
      return { ok: false, error: "skills doit être un tableau de chaînes." };
    }
    const tags = (body.skills as unknown[]).map((t) => String(t).trim()).filter(Boolean);
    if (tags.length > 8) return { ok: false, error: "skills : 8 tags maximum." };
    if (tags.some((t) => t.length > 40)) {
      return { ok: false, error: "skills : chaque tag est limité à 40 caractères." };
    }
    skills_check: {
      break skills_check;
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

// ── Activity ────────────────────────────────────────────────────────────────

export interface ActivityCreateData {
  order: number;
  kind: ActivityKind;
  title: string;
  description: string | null;
  url: string | null;
}

export function validateActivityCreate(
  body: Record<string, unknown>,
): Pass<ActivityCreateData> | Fail {
  const order = intIn(body.order, 0, 999);
  if (order === false) return { ok: false, error: "Ordre requis (entier 0-999)." };
  const kind = (body.kind === undefined || body.kind === "" ? "practice" : body.kind);
  if (!(ACTIVITY_KINDS as readonly string[]).includes(String(kind))) {
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
  return {
    ok: true,
    data: { order, kind: String(kind) as ActivityKind, title, description, url },
  };
}

// ── Deliverable ─────────────────────────────────────────────────────────────

export interface DeliverableUpsertData {
  type: DeliverableType;
  title: string;
  description: string | null;
  isRequired: boolean;
}

export function validateDeliverableUpsert(
  body: Record<string, unknown>,
): Pass<DeliverableUpsertData> | Fail {
  const type = optStr(body.type) ?? "url";
  if (!(DELIVERABLE_TYPES as readonly string[]).includes(type)) {
    return {
      ok: false,
      error:
        "Type de livrable invalide. Use: url | github_repo | pull_request | project | deployed_url | screenshot | text.",
    };
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
    data: {
      type: String(type) as DeliverableType,
      title,
      description,
      isRequired: isRequired.value,
    },
  };
}

// ── Submission ──────────────────────────────────────────────────────────────

/**
 * Valide le contenu d'une soumission selon le type de livrable.
 * Types URL (url, github_repo, pull_request, project, deployed_url,
 * screenshot) : le contenu DOIT être une URL http(s). Le type text
 * accepte un texte libre borné.
 */
export function validateSubmission(
  body: Record<string, unknown>,
  deliverableType: string,
): Pass<{ content: string }> | Fail {
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return { ok: false, error: "Le contenu du livrable est requis." };
  if ((DELIVERABLE_URL_TYPES as readonly string[]).includes(deliverableType)) {
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

// ── Review ──────────────────────────────────────────────────────────────────

export interface ReviewCreateData {
  decision: ReviewDecision;
  feedback: string | null;
}

/**
 * Review d'une soumission. Un feedback est OBLIGATOIRE pour demander
 * une correction (REVISION) ou rejeter (REJECTED) : le participant doit
 * savoir quoi changer. Un feedback est optionnel pour APPROVED.
 */
export function validateReviewCreate(
  body: Record<string, unknown>,
): Pass<ReviewCreateData> | Fail {
  const decision = optStr(body.decision);
  if (!decision || !(REVIEW_DECISIONS as readonly string[]).includes(decision)) {
    return {
      ok: false,
      error: "Décision invalide. Use: APPROVED | REVISION | REJECTED.",
    };
  }
  const feedback = optStr(body.feedback);
  if (feedback && feedback.length > 2000) {
    return { ok: false, error: "Feedback trop long (max 2000 caractères)." };
  }
  if (!feedback && (decision === "REVISION" || decision === "REJECTED")) {
    return {
      ok: false,
      error: "Un feedback est requis pour demander une correction ou rejeter.",
    };
  }
  return { ok: true, data: { decision: decision as ReviewDecision, feedback } };
}

// ── Quiz ────────────────────────────────────────────────────────────────────

export interface QuizUpsertData {
  title: string;
  passThreshold: number;
  maxAttempts: number | null;
  isRequired: boolean;
}

export function validateQuizUpsert(
  body: Record<string, unknown>,
): Pass<QuizUpsertData> | Fail {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 3) return { ok: false, error: "Titre requis (min 3 caractères)." };
  if (title.length > 200) return { ok: false, error: "Titre trop long (max 200 caractères)." };
  const passThreshold = intIn(
    body.passThreshold === undefined ? 70 : body.passThreshold,
    0,
    100,
  );
  if (passThreshold === false) {
    return { ok: false, error: "passThreshold doit être un entier 0-100 (%)." };
  }
  let maxAttempts: number | null = null;
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

// ── Question ────────────────────────────────────────────────────────────────

export interface QuestionUpsertData {
  order: number;
  type: QuestionType;
  prompt: string;
  optionsJson: string;
  correctJson: string;
  points: number;
}

export function validateQuestionUpsert(
  body: Record<string, unknown>,
): Pass<QuestionUpsertData> | Fail {
  const order = intIn(body.order, 0, 999);
  if (order === false) return { ok: false, error: "Ordre requis (entier 0-999)." };
  const type = optStr(body.type);
  if (!type || !(QUESTION_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Type invalide. Use: single | multiple | true_false." };
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 3) return { ok: false, error: "Énoncé requis (min 3 caractères)." };
  if (prompt.length > 1000) return { ok: false, error: "Énoncé trop long (max 1000 caractères)." };

  // Options : single/multiple exigent 2..10 options non vides ; true_false
  // les ignore (défaut ["Vrai","Faux"]).
  let options: string[];
  if (type === "true_false") {
    options = ["Vrai", "Faux"];
  } else {
    if (!Array.isArray(body.options)) {
      return { ok: false, error: "options doit être un tableau (2 à 10 choix)." };
    }
    options = (body.options as unknown[]).map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2 || options.length > 10) {
      return { ok: false, error: "options doit contenir entre 2 et 10 choix non vides." };
    }
    if (options.some((o) => o.length > 200)) {
      return { ok: false, error: "options : chaque choix est limité à 200 caractères." };
    }
  }

  // Réponse(s) correcte(s) : index (0-based) dans les options.
  let correct: number | number[];
  if (type === "multiple") {
    if (!Array.isArray(body.correct)) {
      return { ok: false, error: "correct doit être un tableau d'indices (multiple)." };
    }
    const idx = (body.correct as unknown[]).map((c) => Number(c));
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
      type: type as QuestionType,
      prompt,
      optionsJson: JSON.stringify(options),
      correctJson: JSON.stringify(correct),
      points,
    },
  };
}

// ── Réponses de quiz (forme seulement — le scoring est dans workshop-quiz.ts) ─

/**
 * Forme attendue de `answers` : tableau aligné sur les questions, chaque
 * entrée étant un indice (number) pour single/true_false ou un tableau
 * d'indices (number[]) pour multiple. Vérifie la FORME ici ; la correction
 * point par point est du ressort du scoring.
 */
export function parseAnswers(v: unknown): { ok: true; answers: (number | number[])[] } | Fail {
  if (!Array.isArray(v)) return { ok: false, error: "answers doit être un tableau." };
  const answers: (number | number[])[] = [];
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
