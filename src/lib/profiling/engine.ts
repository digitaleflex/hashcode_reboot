import type {
  ProfileAnswers,
  Question,
  GeneratedProfile,
  Domain,
  Level,
  Goal,
  Availability,
  LearningStyle,
  MentoringInterest,
  Gender,
} from "./types";
import { QUESTIONS } from "./questions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Common disposable / temp email domains → routed to manual review.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "sharklasers.com",
  "dispostable.com",
]);

/** Ordered list of questions visible given the current answers. */
export function getVisibleQuestions(answers: ProfileAnswers): Question[] {
  return QUESTIONS.filter((q) => !q.condition || q.condition(answers));
}

/** Progress 0..1 across the visible question set. */
export function getProgress(
  answers: ProfileAnswers,
  answeredIds: Set<string>,
): number {
  const visible = getVisibleQuestions(answers);
  if (visible.length === 0) return 0;
  const answered = visible.filter((q) => answeredIds.has(q.id)).length;
  // Never reach 100% until truly done — cap at 0.96 mid-flow.
  const ratio = answered / visible.length;
  return Math.min(ratio, 0.96);
}

/** Validate an answer for a given question. Returns error message or null. */
export function validateAnswer(
  question: Question,
  raw: unknown,
): string | null {
  if (!question.required && (raw === undefined || raw === "" || raw === null)) {
    return null;
  }
  switch (question.type) {
    case "single_choice": {
      if (!raw || typeof raw !== "string") return "Choisis une option.";
      const options = getOptionsFor(question);
      if (options.length && !options.some((o) => o.value === raw))
        return "Option invalide.";
      return null;
    }
    case "multi_choice": {
      if (!Array.isArray(raw)) return "Sélection invalide.";
      return null;
    }
    case "text": {
      const v = typeof raw === "string" ? raw.trim() : "";
      if (question.required && !v) return "Ce champ est requis.";
      if (question.minChars && v.length < question.minChars)
        return `Minimum ${question.minChars} caractères.`;
      if (question.maxChars && v.length > question.maxChars)
        return `Maximum ${question.maxChars} caractères.`;
      return null;
    }
    case "longtext": {
      const v = typeof raw === "string" ? raw.trim() : "";
      if (question.required && !v) return "Écris au moins une phrase.";
      if (question.minChars && v.length < question.minChars)
        return `Sois un peu plus précis (min. ${question.minChars} caractères).`;
      if (question.maxChars && v.length > question.maxChars)
        return `Trop long (max. ${question.maxChars} caractères).`;
      return null;
    }
    case "email": {
      const v = typeof raw === "string" ? raw.trim() : "";
      if (!v) return "Ton adresse email est requise.";
      if (!EMAIL_RE.test(v)) return "Format d'email invalide.";
      return null;
    }
    case "country": {
      const v = typeof raw === "string" ? raw.trim() : "";
      if (!v) return "Choisis ton pays.";
      return null;
    }
  }
  return null;
}

/** Internal helper used by validateAnswer. Kept here to avoid import cycle. */
function getOptionsFor(_q: Question) {
  return _q.options ?? [];
}

// ============================================================
// Profile generation (the "reward" — HASHCODE understood me)
// ============================================================

const DOMAIN_LABELS: Record<Domain, string> = {
  web: "Web Development",
  cybersecurity: "Cybersecurity",
  ai: "Applied AI",
};

const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Débutant",
  practicing: "Pratique",
  autonomous: "Autonome",
  advanced: "Avancé",
};

const GOAL_LABELS: Record<Goal, string> = {
  project: "Construire un projet",
  employment: "Trouver un emploi",
  freelance: "Devenir freelance",
  upskill: "Monter en compétences",
  business: "Développer une activité",
  career: "Préparer une carrière",
  other: "Progresser",
};

const AVAIL_LABELS: Record<Availability, string> = {
  "<2h": "Moins de 2 h / semaine",
  "2-5h": "2 – 5 h / semaine",
  "5-10h": "5 – 10 h / semaine",
  "10-15h": "10 – 15 h / semaine",
  "15h+": "15 h+ / semaine",
};

const STYLE_LABELS: Record<LearningStyle, string> = {
  practice: "Pratique & projets",
  path: "Parcours structuré",
  group: "Groupe & pairs",
  mentor: "Accompagné par un mentor",
  project: "Construction de projet",
};


const MENTORING_LABELS: Record<MentoringInterest, string> = {
  no: "Pas pour le moment",
  maybe: "Curieux",
  yes: "Intéressé",
};

const GENDER_LABELS: Record<Gender, string> = {
  male: "Homme",
  female: "Femme",
  other: "Autre",
  prefer_not_say: "Préfère ne pas dire",
};

/** Deterministic archetype from domain + level + goal. */
function archetypeFor(a: ProfileAnswers): { label: string; emoji: string } {
  const d = a.primaryDomain;
  const lvl = a.level;
  if (d === "cybersecurity")
    return { label: "CYBER BUILDER", emoji: "🛡️" };
  if (d === "ai") return { label: "AI EXPLORER", emoji: "🤖" };
  if (d === "web") {
    if (lvl === "advanced" || lvl === "autonomous")
      return { label: "WEB ARCHITECT", emoji: "🏛️" };
    return { label: "WEB BUILDER", emoji: "🌐" };
  }
  return { label: "HASHCODE BUILDER", emoji: "✦" };
}

/** Deterministic tags — no LLM, pure rules. */
function tagsFor(a: ProfileAnswers): string[] {
  const t = new Set<string>();
  if (a.primaryDomain === "cybersecurity") t.add("CYBER");
  if (a.primaryDomain === "web") t.add("WEB");
  if (a.primaryDomain === "ai") t.add("AI");
  if (a.level === "beginner") t.add("BEGINNER");
  if (a.level === "advanced") t.add("ADVANCED");
  if (a.goal === "employment") t.add("EMPLOYMENT-FOCUSED");
  if (a.goal === "project" || a.goal === "business") t.add("PROJECT-FOCUSED");
  if (a.goal === "freelance") t.add("FREELANCE-FOCUSED");
  if (a.availability === "15h+" || a.availability === "10-15h")
    t.add("HIGH-AVAILABILITY");
  if (a.availability === "<2h") t.add("LIGHT-RHYTHM");
  if (a.mentoringInterest === "yes") t.add("MENTORING-INTERESTED");
  if (a.mentoringInterest === "maybe") t.add("MENTORING-CURIOUS");
  if (a.learningStyle === "project") t.add("PROJECT-LEARNER");
  if (a.budgetRange && ["20000-30000", ">30000"].includes(a.budgetRange))
    t.add("HIGH-BUDGET");
  if (a.country) t.add(`COUNTRY:${a.country}`);
  if (a.gender) t.add(`GENDER:${a.gender}`);
  return Array.from(t);
}

export function generateProfile(a: ProfileAnswers): GeneratedProfile {
  const arch = archetypeFor(a);
  return {
    archetype: arch.label,
    archetypeEmoji: arch.emoji,
    domainLabel: a.primaryDomain ? DOMAIN_LABELS[a.primaryDomain] : "—",
    levelLabel: a.level ? LEVEL_LABELS[a.level] : "—",
    goalLabel: a.goal ? GOAL_LABELS[a.goal] : "—",
    availabilityLabel: a.availability ? AVAIL_LABELS[a.availability] : "—",
    styleLabel: a.learningStyle ? STYLE_LABELS[a.learningStyle] : "—",
    mentoringLabel: a.mentoringInterest
      ? MENTORING_LABELS[a.mentoringInterest]
      : "—",
    genderLabel: a.gender ? GENDER_LABELS[a.gender] : undefined,
    tags: tagsFor(a),
  };
}

export { EMAIL_RE, DISPOSABLE_DOMAINS };
