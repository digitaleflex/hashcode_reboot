/**
 * HASHCODE REBOOT — Profiling label maps.
 * Shared between MemberTable, AdminStats, and any other consumer.
 * INVITATION_LABEL stays local in MemberTable (per instruction).
 */

export const DOMAIN_LABEL: Record<string, string> = {
  web: "Web",
  cybersecurity: "Cyber",
  ai: "AI",
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratique",
  autonomous: "Autonome",
  advanced: "Avancé",
};

export const BUDGET_LABEL: Record<string, string> = {
  "<2500": "< 2.5k",
  "2500-5000": "2.5–5k",
  "5000-10000": "5–10k",
  "10000-20000": "10–20k",
  "20000-30000": "20–30k",
  ">30000": "> 30k",
  unknown: "NSP",
};

export const GOAL_LABEL: Record<string, string> = {
  project: "Projet",
  employment: "Emploi",
  freelance: "Freelance",
  upskill: "Compétences",
  business: "Activité",
  career: "Carrière",
  other: "Autre",
};

/**
 * HASHCODE REBOOT — Glossaire FR des raisons de qualification acquisition
 * (#211 P3, lisibilité seule : aucune UI / route ne le consomme encore).
 *
 * Les 6 SIGNAUX (1 raison positive chacun, poids entre parenthèses —
 * cf. RULE_WEIGHTS dans src/lib/qualification/acquisition.ts, max 100) :
 *  1. CORE_COMPLETE (+30) — noyau de contact complet
 *  2. EMAIL_QUALITY (+20) — canal de contact fiable
 *  3. GOAL_RICHNESS (+20) — objectif 3 mois exprimé
 *  4. AVAILABILITY (+10) — disponibilité renseignée
 *  5. MENTORING_INTENT (+10) — intention mentorat / budget
 *  6. SOURCE_ATTRIBUTED (+10) — provenance tracée
 *
 * Chaque signal émet UNE raison parmi ses variantes (positive + cas
 * dégradés) ; seules les 6 positives portent le poids plein. Codes stables
 * (persistés en Qualification.reasons) — ne jamais renommer, ajouter
 * seulement. Modèle : mêmes maps plates que ci-dessus, côté orientation
 * non touchée (frontière acquisition/orientation).
 */
export const ACQUISITION_REASON_LABEL: Record<string, string> = {
  // 1. Complétude noyau.
  "core-complete": "Profil complet",
  "missing-core": "Profil incomplet",
  // 2. Qualité email.
  "email-verified": "Email vérifié",
  "disposable-email": "Email jetable",
  "invalid-email": "Email invalide",
  // 3. Richesse de l'objectif 3 mois.
  "goal-rich": "Objectif détaillé",
  "goal-present": "Objectif présent",
  "low-signal-goal": "Objectif trop vague",
  // 4. Disponibilité.
  "availability-given": "Disponibilité renseignée",
  "low-availability": "Faible disponibilité",
  "missing-availability": "Disponibilité manquante",
  // 5. Intention mentorat / budget.
  "mentoring-budget-ready": "Mentorat avec budget",
  "mentoring-interest-no-budget": "Mentorat sans budget",
  "mentoring-maybe": "Mentorat envisagé",
  "no-mentoring-signal": "Sans signal mentorat",
  // 6. Source normalisée.
  "source-attributed": "Source identifiée",
  "source-direct": "Accès direct",
};
