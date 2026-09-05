import type { Question, ProfileAnswers } from "./types";

/**
 * HASHCODE REBOOT — Question configuration.
 *
 * Flow philosophy: front-load fast, click-based, momentum-building questions
 * (name, country, domain, goal, level, availability, learning style), then
 * ask only the conditional questions that are relevant, then one open
 * 3-month goal. Contact info (email required, rest optional) is collected
 * at the end as the delivery channel — never as a friction gate up front.
 */

const DOMAINS = [
  {
    value: "web",
    label: "Web Development",
    emoji: "🌐",
    description: "Créer des applications, produits et expériences numériques.",
  },
  {
    value: "cybersecurity",
    label: "Cybersecurity",
    emoji: "🛡️",
    description: "Comprendre, protéger, analyser et expérimenter.",
  },
  {
    value: "ai",
    label: "Applied AI",
    emoji: "🤖",
    description: "Construire avec l'IA, l'automatisation et les agents.",
  },
];

const GOALS = [
  { value: "project", label: "Construire un projet", emoji: "🚀" },
  { value: "employment", label: "Trouver un emploi", emoji: "💼" },
  { value: "freelance", label: "Devenir freelance", emoji: "🧳" },
  { value: "upskill", label: "Monter en compétences", emoji: "📈" },
  { value: "business", label: "Développer une activité", emoji: "🧩" },
  { value: "career", label: "Préparer une carrière", emoji: "🎯" },
  { value: "other", label: "Autre chose", emoji: "✦" },
];

const LEVELS = [
  { value: "beginner", label: "Je débute", emoji: "🌱" },
  { value: "practicing", label: "Je pratique déjà", emoji: "⚙️" },
  { value: "autonomous", label: "Je suis autonome", emoji: "🧭" },
  { value: "advanced", label: "Je suis avancé", emoji: "🏆" },
];

const AVAILABILITY = [
  { value: "<2h", label: "Moins de 2 h", hint: "Rythme léger" },
  { value: "2-5h", label: "2 – 5 h", hint: "Constant" },
  { value: "5-10h", label: "5 – 10 h", hint: "Engagé" },
  { value: "10-15h", label: "10 – 15 h", hint: "Intensif" },
  { value: "15h+", label: "15 h et plus", hint: "Plein focus" },
];

const LEARNING = [
  { value: "practice", label: "En pratiquant", emoji: "🧩" },
  { value: "path", label: "Avec un parcours", emoji: "🧭" },
  { value: "group", label: "Avec un groupe", emoji: "🤝" },
  { value: "mentor", label: "Avec un mentor", emoji: "🧑‍🏫" },
  { value: "project", label: "En construisant un projet", emoji: "🚧" },
];

const MENTORING = [
  {
    value: "no",
    label: "Non",
    description: "Je préfère avancer seul pour le moment.",
  },
  {
    value: "maybe",
    label: "Peut-être",
    description: "Je veux comprendre ce que ça peut m'apporter.",
  },
  {
    value: "yes",
    label: "Oui",
    description: "Un accompagnement m'aiderait à progresser.",
  },
];

const BUDGET_WILLINGNESS = [
  { value: "yes", label: "Oui", emoji: "✓" },
  { value: "maybe", label: "Peut-être", emoji: "≈" },
  { value: "not_now", label: "Pas pour le moment", emoji: "—" },
];

const BUDGET_RANGES = [
  { value: "<2500", label: "Moins de 2 500 FCFA / mois" },
  { value: "2500-5000", label: "2 500 – 5 000 FCFA / mois" },
  { value: "5000-10000", label: "5 000 – 10 000 FCFA / mois" },
  { value: "10000-20000", label: "10 000 – 20 000 FCFA / mois" },
  { value: "20000-30000", label: "20 000 – 30 000 FCFA / mois" },
  { value: ">30000", label: "Plus de 30 000 FCFA / mois" },
  { value: "unknown", label: "Je ne sais pas encore" },
];

/** Domain-specific specialties (conditional on primaryDomain). */
const DOMAIN_SPECIALTIES: Record<string, QuestionOption[]> = {
  cybersecurity: [
    { value: "soc", label: "SOC / Blue Team", emoji: "🛡️" },
    { value: "pentest", label: "Pentest / Red Team", emoji: "⚔️" },
    { value: "osint", label: "OSINT", emoji: "🔍" },
    { value: "career", label: "Carrière cyber", emoji: "💼" },
    { value: "certification", label: "Certification", emoji: "📜" },
    { value: "project", label: "Projet cyber", emoji: "🚧" },
  ],
  web: [
    { value: "frontend", label: "Frontend", emoji: "🎨" },
    { value: "backend", label: "Backend", emoji: "🔧" },
    { value: "architecture", label: "Architecture", emoji: "🏛️" },
    { value: "project", label: "Projet web", emoji: "🚧" },
    { value: "freelance", label: "Freelance", emoji: "🧳" },
    { value: "career", label: "Carrière web", emoji: "💼" },
  ],
  ai: [
    { value: "llm", label: "LLM", emoji: "🧠" },
    { value: "agents", label: "Agents", emoji: "🤖" },
    { value: "automation", label: "Automation", emoji: "⚙️" },
    { value: "ai_engineering", label: "AI Engineering", emoji: "🛠️" },
    { value: "project", label: "Projet AI", emoji: "🚧" },
    { value: "business", label: "Business AI", emoji: "💼" },
  ],
};

/** Mentoring types per domain (conditional on primaryDomain + mentoring=yes). */
const MENTORING_TYPES: Record<string, QuestionOption[]> = {
  cybersecurity: [
    { value: "soc", label: "SOC / Blue Team" },
    { value: "pentest", label: "Pentest / Red Team" },
    { value: "osint", label: "OSINT" },
    { value: "career", label: "Carrière" },
    { value: "certification", label: "Certification" },
    { value: "project", label: "Projet" },
  ],
  web: [
    { value: "frontend", label: "Frontend" },
    { value: "backend", label: "Backend" },
    { value: "architecture", label: "Architecture" },
    { value: "project", label: "Projet" },
    { value: "freelance", label: "Freelance" },
    { value: "career", label: "Carrière" },
  ],
  ai: [
    { value: "llm", label: "LLM" },
    { value: "agents", label: "Agents" },
    { value: "automation", label: "Automation" },
    { value: "ai_engineering", label: "AI Engineering" },
    { value: "project", label: "Projet" },
    { value: "business", label: "Business" },
  ],
};

const MENTORING_FREQUENCY = [
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Toutes les 2 semaines" },
  { value: "monthly", label: "Mensuel" },
  { value: "on_demand", label: "À la demande" },
];

function hasDomain(a: ProfileAnswers): boolean {
  return a.primaryDomain !== undefined;
}
function mentoringYesOrMaybe(a: ProfileAnswers): boolean {
  return a.mentoringInterest === "yes" || a.mentoringInterest === "maybe";
}
function mentoringYes(a: ProfileAnswers): boolean {
  return a.mentoringInterest === "yes";
}
function budgetOpen(a: ProfileAnswers): boolean {
  return (
    mentoringYesOrMaybe(a) &&
    (a.budgetWillingness === "yes" || a.budgetWillingness === "maybe")
  );
}

export const QUESTIONS: Question[] = [
  // --- Profil (momentum-building quick clicks) ---
  {
    id: "firstName",
    type: "text",
    title: "Comment devons-nous t'appeler ?",
    description: "Ton prénom suffit pour commencer.",
    placeholder: "Ex. Eurin",
    required: true,
    mapsTo: "firstName",
    group: "profil",
    minChars: 1,
    maxChars: 40,
    microcopy: "Parfait. C'est parti.",
  },
  {
    id: "gender",
    type: "single_choice",
    title: "Comment te définis-tu en tant que genre ?",
    description: "C'est optionnel et confidentiel.",
    options: [
      { value: "male", label: "Homme" },
      { value: "female", label: "Femme" },
      { value: "other", label: "Autre" },
      { value: "prefer_not_say", label: "Préfère ne pas dire" },
    ],
    required: false,
    mapsTo: "gender",
    group: "profil",
    microcopy: "C'est optionnel et confidentiel.",
  },
  {
    id: "country",
    type: "country",
    title: "Tu vis dans quel pays ?",
    description: "Pour comprendre la communauté là où tu es.",
    required: true,
    mapsTo: "country",
    group: "profil",
    microcopy: "On commence à cerner ton profil.",
  },
  {
    id: "primaryDomain",
    type: "single_choice",
    title: "Quel domaine t'attire le plus ?",
    description: "Tu pourras en ajouter d'autres plus tard.",
    options: DOMAINS,
    required: true,
    mapsTo: "primaryDomain",
    group: "profil",
    microcopy: "Bien. On sait où tu veux aller.",
  },
  {
    id: "domainSpecialty",
    type: "multi_choice",
    title: "Qu'est-ce qui t'intéresse dans ce domaine ?",
    description: "Choisis ce qui te parle — tu pourras affiner ensuite.",
    required: false,
    mapsTo: "domainSpecialty",
    group: "profil",
    allowMultiple: true,
    condition: (a) => hasDomain(a) && !!DOMAIN_SPECIALTIES[a.primaryDomain!],
    microcopy: "On affine.",
  },
  {
    id: "goal",
    type: "single_choice",
    title: "Qu'aimerais-tu accomplir avec HASHCODE ?",
    description: "Pas de bonne réponse. Sois honnête, on s'occupe du reste.",
    options: GOALS,
    required: true,
    mapsTo: "goal",
    group: "objectifs",
    microcopy: "Ton profil prend forme.",
  },
  {
    id: "goalSituation",
    type: "single_choice",
    title: "Où en es-tu aujourd'hui côté emploi ?",
    description: "Pour orienter au mieux tes prochaines étapes.",
    options: [
      { value: "student", label: "Étudiant·e", emoji: "🎓" },
      { value: "searching", label: "En recherche active", emoji: "🔎" },
      { value: "employed", label: "En poste, je veux pivoter", emoji: "🔄" },
      { value: "between", label: "Entre deux choses", emoji: "🌤️" },
    ],
    required: false,
    mapsTo: "goalSituation",
    group: "objectifs",
    condition: (a) => a.goal === "employment" || a.goal === "career",
  },
  {
    id: "goalProjectStage",
    type: "single_choice",
    title: "Où en est ton projet aujourd'hui ?",
    description: "Pour calibrer le type d'aide le plus utile.",
    options: [
      { value: "idea", label: "Juste une idée", emoji: "💡" },
      { value: "planning", label: "En réflexion / planification", emoji: "🧭" },
      { value: "building", label: "En cours de construction", emoji: "🚧" },
      { value: "launched", label: "Déjà lancé", emoji: "🚀" },
    ],
    required: false,
    mapsTo: "goalProjectStage",
    group: "objectifs",
    condition: (a) => a.goal === "project" || a.goal === "business",
  },
  {
    id: "level",
    type: "single_choice",
    title: "Où te situes-tu aujourd'hui ?",
    description: "Honnête. On part de là où tu es vraiment.",
    options: LEVELS,
    required: true,
    mapsTo: "level",
    group: "objectifs",
    microcopy: "Encore quelques choix.",
  },
  {
    id: "availability",
    type: "single_choice",
    title: "Combien de temps peux-tu réellement consacrer à ta progression chaque semaine ?",
    description: "Le mot « réellement » compte. Sois lucide.",
    options: AVAILABILITY,
    required: true,
    mapsTo: "availability",
    group: "rythme",
  },
  {
    id: "learningStyle",
    type: "single_choice",
    title: "Comment progresses-tu le mieux ?",
    description: "Ça nous aide à te proposer le bon format.",
    options: LEARNING,
    required: true,
    mapsTo: "learningStyle",
    group: "rythme",
    microcopy: "Presque terminé.",
  },
  // --- Mentorat (conditional follow-ups) ---
  {
    id: "mentoringInterest",
    type: "single_choice",
    title: "As-tu besoin d'un accompagnement personnalisé ?",
    description: "Réponds librement — on adapte la suite selon toi.",
    options: MENTORING,
    required: true,
    mapsTo: "mentoringInterest",
    group: "mentorat",
  },
  {
    id: "mentoringMaybeReason",
    type: "longtext",
    title: "Qu'est-ce qui pourrait te faire envisager un mentor ?",
    description: "Une phrase suffit.",
    placeholder: "Ex. Si je me sens bloqué sur un projet concret.",
    required: false,
    mapsTo: "mentoringMaybeReason",
    group: "mentorat",
    minChars: 4,
    maxChars: 240,
    condition: (a) => a.mentoringInterest === "maybe",
  },
  {
    id: "mentoringTypes",
    type: "multi_choice",
    title: "Sur quoi aimerais-tu être accompagné ?",
    description: "Sélectionne ce qui te serait le plus utile.",
    required: false,
    mapsTo: "mentoringTypes",
    group: "mentorat",
    allowMultiple: true,
    condition: (a) =>
      mentoringYes(a) && hasDomain(a) && !!MENTORING_TYPES[a.primaryDomain!],
  },
  {
    id: "mentoringFrequency",
    type: "single_choice",
    title: "À quelle fréquence aimerais-tu un accompagnement ?",
    options: MENTORING_FREQUENCY,
    required: false,
    mapsTo: "mentoringFrequency",
    group: "mentorat",
    condition: (a) => mentoringYes(a),
  },
  {
    id: "budgetWillingness",
    type: "single_choice",
    title:
      "Si HASHCODE proposait un accompagnement personnalisé adapté à tes objectifs, serais-tu prêt à investir dans ton accompagnement ?",
    description:
      "C'est une recherche de besoins, pas une vente. Ça nous aide à comprendre la communauté.",
    options: BUDGET_WILLINGNESS,
    required: false,
    mapsTo: "budgetWillingness",
    group: "mentorat",
    condition: (a) => mentoringYesOrMaybe(a),
  },
  {
    id: "budgetRange",
    type: "single_choice",
    title: "Quel niveau d'investissement mensuel pourrais-tu envisager ?",
    description: "Aucune réponse n'engage à quoi que ce soit.",
    options: BUDGET_RANGES,
    required: false,
    mapsTo: "budgetRange",
    group: "mentorat",
    condition: (a) => budgetOpen(a),
  },
  // --- Vision (open) ---
  {
    id: "threeMonthGoal",
    type: "longtext",
    title: "Dans 3 mois, qu'aimerais-tu avoir accompli ?",
    description:
      "Une phrase suffit. Sois précis — c'est ce qui rend ton profil utile.",
    placeholder:
      "Ex. Décrocher mon premier poste en cybersécurité.",
    required: true,
    mapsTo: "threeMonthGoal",
    group: "vision",
    minChars: 8,
    maxChars: 280,
  },
  // --- Contact (delivery channel — at the very end) ---
  {
    id: "email",
    type: "email",
    title: "Où t'envoyer ton profil et ton accès ?",
    description:
      "Ton adresse email. On l'utilise pour t'envoyer ton profil et t'inviter à la communauté.",
    placeholder: "toi@exemple.com",
    required: true,
    mapsTo: "email",
    group: "contact",
  },
  {
    id: "phone",
    type: "text",
    title: "Ton numéro WhatsApp ?",
    description:
      "Pour t'inviter directement à la communauté officielle.",
    placeholder: "+229 ...",
    required: true,
    mapsTo: "phone",
    group: "contact",
  },
  {
    id: "lastName",
    type: "text",
    title: "Ton nom ?",
    description: "Pour qu'on sache qui tu es.",
    placeholder: "Ex. Dossou",
    required: true,
    mapsTo: "lastName",
    group: "contact",
  },
  {
    id: "city",
    type: "text",
    title: "Ta ville ou région ?",
    description: "Pour les meetups et événements locaux.",
    placeholder: "Ex. Cotonou",
    required: true,
    mapsTo: "city",
    group: "contact",
  },
];

/** Resolve options dynamically for a question (used for conditional option sets). */
export function getQuestionOptions(
  questionId: string,
  answers: ProfileAnswers,
): QuestionOption[] {
  if (questionId === "domainSpecialty") {
    return DOMAIN_SPECIALTIES[answers.primaryDomain ?? ""] ?? [];
  }
  if (questionId === "mentoringTypes") {
    return MENTORING_TYPES[answers.primaryDomain ?? ""] ?? [];
  }
  const q = QUESTIONS.find((q) => q.id === questionId);
  return q?.options ?? [];
}
