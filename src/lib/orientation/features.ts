/**
 * HASHCODE REBOOT — Catalogue d'activités HashCode.
 *
 * Représente ce que l'écosystème peut réellement proposer : challenges,
 * workshops, projets, communauté, mentorat, parcours, événements, contenu.
 *
 * V1 : catalogue statique (fonctions pures). Il sera progressivement alimenté
 * par la base (Workshop, Event) sans changer l'interface consommée par
 * le moteur d'orientation.
 *
 * RÈGLE : on ne recommande JAMAIS une ressource inexistante. Le matching ne
 * travaille que sur des entrées `status === "published"`.
 */

import type { Domain, Goal, Level, LearningStyle } from "@/lib/profiling/types";
import type { ActivityType } from "./types";

/** Une activité réellement disponible, avec ses critères de ciblage. */
export interface AvailableActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;

  /** Domaines compatibles (vide = tous). */
  domains?: Domain[];
  /** Niveaux compatibles (vide = tous). */
  levels?: Level[];
  /** Objectifs compatibles (vide = tous). */
  goals?: Goal[];
  /** Styles d'apprentissage compatibles (vide = tous). */
  learningStyles?: LearningStyle[];

  /** Charge hebdomadaire indicative. */
  timeCommitment?: string;
  /** Charge estimée totale, en heures. */
  totalHours?: number;

  status: "draft" | "published" | "archived";
  url?: string;
  tags?: string[];
}

/**
 * Catalogue V1 — seed statique.
 * Chaque entrée est explicitement publiée : rien d'inventé n'est recommandable.
 */
export const AVAILABLE_ACTIVITIES: AvailableActivity[] = [
  {
    id: "challenge-03-first-interface",
    type: "challenge",
    title: "Challenge #03 — Construire ta première interface",
    description:
      "Construis une interface web simple (2-3 pages) de bout en bout.",
    domains: ["web"],
    levels: ["beginner"],
    goals: ["project"],
    learningStyles: ["practice"],
    timeCommitment: "2-5h",
    totalHours: 8,
    status: "published",
    url: "/evenements",
    tags: ["frontend", "practice", "first-time"],
  },
  {
    id: "challenge-git-essentials",
    type: "challenge",
    title: "Challenge Git Essentials",
    description:
      "Maîtrise les commandes Git essentielles et contribue à un dépôt.",
    domains: ["web", "cybersecurity", "ai"],
    levels: ["beginner"],
    goals: ["project", "upskill"],
    learningStyles: ["practice", "mentor"],
    timeCommitment: "2-5h",
    totalHours: 5,
    status: "published",
    url: "/evenements",
    tags: ["git", "github", "open-source"],
  },
  {
    id: "workshop-git-foundations",
    type: "workshop",
    title: "Atelier Git & GitHub",
    description:
      "Branches, pull requests et workflow collaboratif pas à pas.",
    domains: ["web", "cybersecurity"],
    levels: ["beginner", "practicing"],
    goals: ["project", "upskill"],
    learningStyles: ["path", "group"],
    timeCommitment: "2-5h",
    totalHours: 4,
    status: "published",
    url: "/evenements",
    tags: ["git", "github", "collaboration"],
  },
  {
    id: "workshop-web-accessibility",
    type: "workshop",
    title: "Atelier Accessibilité Web",
    description: "Rendre une interface accessible (WCAG 2.1 AA) avec React.",
    domains: ["web"],
    levels: ["beginner", "practicing"],
    goals: ["project", "upskill"],
    learningStyles: ["path", "mentor"],
    timeCommitment: "5-10h",
    totalHours: 5,
    status: "published",
    url: "/evenements",
    tags: ["accessibility", "wcag", "react"],
  },
  {
    id: "project-personal-portfolio",
    type: "project",
    title: "Projet — Portfolio personnel",
    description:
      "Site portfolio responsive présentant tes projets et ton parcours.",
    domains: ["web"],
    levels: ["beginner", "practicing"],
    goals: ["project", "employment"],
    learningStyles: ["project", "mentor"],
    timeCommitment: "10-15h",
    totalHours: 25,
    status: "published",
    url: "/evenements",
    tags: ["react", "nextjs", "portfolio"],
  },
  {
    id: "community-hashcode-devs",
    type: "community",
    title: "Communauté HashCode Developers",
    description:
      "Rejoins la communauté des développeurs HashCode : entraide et veille.",
    domains: ["web", "cybersecurity", "ai"],
    levels: ["beginner", "practicing", "autonomous"],
    goals: ["project", "employment", "freelance"],
    learningStyles: ["group", "mentor"],
    timeCommitment: "<2h",
    status: "published",
    url: "/evenements",
    tags: ["communauté", "réseau", "entraide"],
  },
  {
    id: "mentoring-pair-ai",
    type: "mentoring",
    title: "Mentorat — binôme IA",
    description:
      "Séances régulières avec un mentor pour progresser sur le code et la carrière.",
    domains: ["ai", "web"],
    levels: ["beginner", "practicing"],
    goals: ["upskill", "employment"],
    learningStyles: ["mentor", "path"],
    timeCommitment: "2-5h",
    status: "published",
    url: "/evenements",
    tags: ["mentorat", "ia", "accompagnement"],
  },
  {
    id: "learning-path-full-stack",
    type: "learning_path",
    title: "Parcours Full Stack Junior",
    description:
      "Parcours guidé HTML/CSS → JavaScript → React → API.",
    domains: ["web"],
    levels: ["beginner", "practicing"],
    goals: ["employment", "project"],
    learningStyles: ["path", "project"],
    timeCommitment: "10-15h",
    totalHours: 250,
    status: "published",
    url: "/evenements",
    tags: ["parcours", "full-stack", "structuré"],
  },
  {
    id: "content-web-performance",
    type: "content",
    title: "Contenu — Performance Web",
    description: "Articles et tutoriels sur les Web Vitals et le chargement.",
    domains: ["web"],
    levels: ["practicing", "autonomous"],
    goals: ["upskill", "project"],
    learningStyles: ["path"],
    timeCommitment: "2-5h",
    status: "published",
    url: "/evenements",
    tags: ["performance", "web-vitals"],
  },
];

/** Index par id pour les résolutions O(1). */
export const ACTIVITY_BY_ID: ReadonlyMap<string, AvailableActivity> = new Map(
  AVAILABLE_ACTIVITIES.map((a) => [a.id, a]),
);

/** Uniquement les activités publiées — contrat du matching. */
export function publishedActivities(): AvailableActivity[] {
  return AVAILABLE_ACTIVITIES.filter((a) => a.status === "published");
}
