/**
 * HASHCODE REBOOT — validation partagée du domaine ATELIERS.
 *
 * Même philosophie que events-validation.ts : fonctions pures, unions
 * fermées en union TS, retours { ok, data } | { ok, error }, utilisées
 * par les routes API membre et admin pour garantir les mêmes règles
 * des deux côtés. Testée en miroir CJS (tests/workshop-validation.test.cjs).
 *
 * Couvert :
 * - Workshop : status draft|published|archived (filtres des listes admin)
 * - Submission : contenu requis, URL http(s) OBLIGATOIRE pour les types
 *   url/github_repo/pull_request/project/deployed_url/screenshot
 * - Review : decision APPROVED|REVISION|REJECTED (union z.enum côté admin)
 * - Question : type single|multiple|true_false
 * - Stats : statuts de soumission et d'inscription (compteurs admin)
 * - parseAnswers : forme des réponses de quiz (array de number|number[])
 *
 * Ce qui n'est PAS ici, volontairement : aucun validateur de création ni
 * de mise à jour pour workshop, semaine, séance, activité, livrable, quiz
 * ou question. La structure pédagogique est produite par le seed
 * idempotent (scripts/seed-workshops.ts) et aucune route admin de CRUD de
 * structure n'existe en v1 (docs/ateliers/adr-001-decisions.md, décision
 * D2). Écrire ces validateurs ici reviendrait à faire semblant qu'une
 * route d'écriture existe.
 *
 * NOTE : le scoring et la progression sont dans workshop-quiz.ts et
 * workshop-progression.ts (issues #82/#83), pas ici.
 */

// ── Unions fermées ──────────────────────────────────────────────────────────

export const WORKSHOP_STATUSES = ["draft", "published", "archived"] as const;

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

export const QUESTION_TYPES = ["single", "multiple", "true_false"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ENROLLMENT_STATUSES = ["active", "completed", "dropped"] as const;

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

/** Map helpers dupliqués côté miroir CJS — à synchroniser. */

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