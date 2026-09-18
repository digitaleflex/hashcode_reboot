/**
 * HASHCODE REBOOT — scoring des quiz ATELIERS (100 % serveur).
 *
 * GARDE-FOU FONDAMENTAL : les réponses correctes (correctJson) ne quittent
 * JAMAIS le serveur. La seule projection client est publicQuestions(), qui
 * ne retourne que l'énoncé, les options et les points — jamais l'indice
 * correct. Le scoring s'exécute exclusivement côté serveur (protocole §17) :
 * le client envoie ses réponses, le serveur calcule le score et `passed`.
 *
 * Types supportés en v1 : single, multiple, true_false. Le type short_answer
 * est reporté (scoring exact-match non fiable — cf. audit §21, protocole §17
 * « réponse courte si techniquement supportable »).
 *
 * Forme des réponses (cf. workshop-validation.ts parseAnswers) :
 *   - single / true_false : indice unique (number)
 *   - multiple : tableau d'indices (number[]) — match exact de l'ensemble
 *
 * Seuil : passThreshold en pourcentage (0-100), configurable par quiz.
 * Tentatives : répétées tant que maxAttempts ne l'interdit pas (§17) —
 * voir canAttempt().
 */

import type { QuestionType } from "./workshop-validation";

export interface PublicQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  /** Options dé-JSON-ifiées — SANS aucune indication de la réponse. */
  options: string[];
  points: number;
}

export interface ScoredQuestion {
  questionId: string;
  type: QuestionType;
  correct: boolean;
  pointsEarned: number;
}

export interface QuizScore {
  /** Points gagnés. */
  score: number;
  /** Points possibles (somme des points des questions). */
  total: number;
  /** 0..100, arrondi à l'entier inférieur. */
  percent: number;
  /** percent >= passThreshold. */
  passed: boolean;
  perQuestion: ScoredQuestion[];
}

interface QuestionForScoring {
  id: string;
  order: number;
  type: string;
  prompt: string;
  optionsJson: string;
  correctJson: string;
  points: number;
}

/**
 * Projection client d'une question : correctJson est ABSENT de la sortie
 * (testé par des tests de non-fuite). Toute sérialisation d'une question
 * de quiz vers le client doit passer par ici.
 */
export function publicQuestions(
  questions: {
    id: string;
    order: number;
    type: string;
    prompt: string;
    optionsJson: string;
    points: number;
  }[],
): PublicQuestion[] {
  return questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => {
      let options: string[] = [];
      try {
        const parsed = JSON.parse(q.optionsJson);
        if (Array.isArray(parsed)) options = parsed.map((o) => String(o));
      } catch {
        options = [];
      }
      return {
        id: q.id,
        order: q.order,
        type: q.type as QuestionType,
        prompt: q.prompt,
        options,
        points: q.points,
      };
    });
}

/** Parse correctJson en indices 0-based (number | number[]), null si corrompu. */
function parseCorrect(type: string, correctJson: string): number | number[] | null {
  try {
    const parsed: unknown = JSON.parse(correctJson);
    if (type === "multiple") {
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((c) => Number.isInteger(c) && (c as number) >= 0)
      ) {
        return [...(parsed as number[])].sort((a, b) => a - b);
      }
      return null;
    }
    if (Number.isInteger(parsed) && (parsed as number) >= 0) return parsed as number;
    return null;
  } catch {
    return null;
  }
}

/** Normalise une entrée de réponse en ensemble trié d'indices. */
function answerToSet(answer: unknown): number[] | null {
  if (typeof answer === "number") {
    if (!Number.isInteger(answer) || answer < 0) return null;
    return [answer];
  }
  if (Array.isArray(answer)) {
    const idx = answer.map((c) => Number(c));
    if (idx.some((c) => !Number.isInteger(c) || c < 0)) return null;
    return [...idx].sort((a, b) => a - b);
  }
  return null;
}

/** Comparaison d'ensembles d'indices (déjà triés). */
function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Note une tentative contre le seuil du quiz.
 * Retourne null si les réponses ne sont pas alignées sur les questions
 * (longueur différente) ou de forme invalide — la route renverra alors
 * 422, jamais un score arbitraire.
 *
 * Barème : match exact par question (all-or-nothing pour multiple — un
 * choix partiel est faux). Le tri des ensembles rend le scoring insensible
 * à l'ordre des sélections.
 */
export function scoreAttempt(
  questions: QuestionForScoring[],
  answers: unknown[],
  passThreshold: number,
): QuizScore | null {
  if (questions.length === 0) return null;
  if (!Array.isArray(answers) || answers.length !== questions.length) return null;
  if (!Number.isInteger(passThreshold) || passThreshold < 0 || passThreshold > 100) return null;

  const ordered = questions.slice().sort((a, b) => a.order - b.order);

  const perQuestion: ScoredQuestion[] = [];
  let score = 0;
  let total = 0;

  for (let i = 0; i < ordered.length; i++) {
    const q = ordered[i];
    const correctIndices = parseCorrect(q.type, q.correctJson);
    if (correctIndices === null) return null; // donnée de question corrompue → pas de score
    total += q.points;

    const correctSet = answerToSet(correctIndices);
    const userSet = answerToSet(answers[i]);
    if (userSet === null) return null; // forme de réponse invalide → pas de score

    const correct = correctSet !== null && sameSet(correctSet, userSet);

    perQuestion.push({
      questionId: q.id,
      type: q.type as QuestionType,
      correct,
      pointsEarned: correct ? q.points : 0,
    });
    if (correct) score += q.points;
  }

  const percent = total > 0 ? Math.floor((score / total) * 100) : 0;
  return {
    score,
    total,
    percent,
    passed: percent >= passThreshold,
    perQuestion,
  };
}

/**
 * Une nouvelle tentative est-elle autorisée ? maxAttempts null = illimité
 * (défaut du modèle, protocole §17 : « Les tentatives peuvent être répétées
 * tant qu'aucune règle métier ne l'interdit »).
 */
export function canAttempt(maxAttempts: number | null, attemptsCount: number): boolean {
  if (maxAttempts === null) return true;
  return attemptsCount < maxAttempts;
}
