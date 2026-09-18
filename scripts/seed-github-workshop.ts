#!/usr/bin/env node
/**
 * Seed du Workshop « Maîtrise GitHub — Bases » (4 semaines, 12 séances).
 *
 * Crée le Workshop, les semaines, les séances, les activités, les livrables
 * et les quiz. Chaque séance est liée à son Event correspondant via `eventId`.
 *
 * Idempotent :
 *   - Sans --force : les séances existantes (même titre) sont conservées.
 *   - Avec --force : les séances existantes sont mises à jour.
 *   - Les quiz et livrables sont recréés seulement s'ils n'existent pas.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/seed-github-workshop.ts --dry-run
 *   node --env-file=.env --import tsx scripts/seed-github-workshop.ts
 *   node --env-file=.env --import tsx scripts/seed-github-workshop.ts --force
 */

import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

const prisma = new PrismaClient();

// ─── Données du programme ───────────────────────────────────────────

const WORKSHOP_DATA = {
  slug: "maitrise-github-bases",
  title: "Maîtrise GitHub — Bases",
  description:
    "Programme de 4 semaines pour maîtriser Git, GitHub, les pull requests, " +
    "les branches, GitHub Pages et les automatisations. 12 séances encadrées " +
    "avec livrables et quiz.",
  status: "published",
  domain: null, // transversal
  level: "beginner",
};

interface WeekDef {
  number: number;
  title: string;
  objective: string;
}

interface ActivityDef {
  order: number;
  kind: "practice" | "resource";
  title: string;
  description?: string;
  url?: string;
}

interface QuizQuestion {
  order: number;
  type: "single" | "multiple" | "true_false";
  prompt: string;
  options: string[];
  correct: number | number[];
  points: number;
}

interface SessionDef {
  /** Numéro global S01..S12. */
  number: number;
  /** Titre court de la séance (même que dans le seed Events). */
  sujet: string;
  objective: string;
  program: string;
  skills: string[];
  /** Clé de liaison vers Event : "samedi" | "dimanche" | "mercredi". */
  eventDay: "samedi" | "dimanche" | "mercredi";
  /** Titre exact de l'Event dans le seed Events existant. */
  eventTitle: string;
  /** `recurrenceId` de l'Event (série). */
  recurrenceId: string;
  activities: ActivityDef[];
  deliverable: {
    type: string;
    title: string;
    description: string;
    isRequired: boolean;
  };
  quiz: {
    title: string;
    passThreshold: number;
    questions: QuizQuestion[];
  };
}

const WEEKS: WeekDef[] = [
  { number: 1, title: "Les bases", objective: "Découvrir Git & GitHub, créer son premier dépôt et publier son premier commit." },
  { number: 2, title: "Collaboration", objective: "Maîtriser les branches, les pull requests et les reviews entre pairs." },
  { number: 3, title: "Documentation & Déploiement", objective: "Documenter, déployer et automatiser avec GitHub Pages et Actions." },
  { number: 4, title: "Projet en équipe", objective: "Construire un projet à plusieurs et finaliser le livrable." },
];

const SERIES: Record<string, { recurrenceId: string }> = {
  samedi:   { recurrenceId: "github-bases-samedi" },
  dimanche: { recurrenceId: "github-bases-dimanche" },
  mercredi: { recurrenceId: "github-bases-mercredi" },
};

const SESSIONS: SessionDef[] = [
  // ── Semaine 1 ─────────────────────────────────────────────────────
  {
    number: 1,
    sujet: "Découverte de Git & GitHub",
    objective: "Comprendre à quoi servent Git et GitHub, et publier son premier commit.",
    program:
      "C'est quoi Git, c'est quoi GitHub (et pourquoi ce n'est pas la même chose) · " +
      "créer son compte · installer Git · créer son premier dépôt · publier son premier commit.",
    skills: ["git-init", "git-add", "git-commit", "github"],
    eventDay: "samedi",
    eventTitle: "Maîtrise GitHub #1 — Découverte de Git & GitHub",
    recurrenceId: "github-bases-samedi",
    activities: [
      { order: 1, kind: "resource", title: "Vidéo : Git vs GitHub", description: "Comprendre la différence entre Git (outil local) et GitHub (plateforme)." },
      { order: 2, kind: "practice", title: "Installer Git et configurer son identité", description: "git config --global user.name / user.email" },
      { order: 3, kind: "practice", title: "Créer un dépôt et pousser le premier commit", description: "git init, git add, git commit, git push" },
    ],
    deliverable: { type: "github_repo", title: "Dépôt GitHub avec un commit", description: "Crée un dépôt public sur GitHub et pousses au moins un commit.", isRequired: true },
    quiz: {
      title: "Quiz S01 — Git vs GitHub",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Git est un outil qui fonctionne…", options: ["En ligne sur GitHub", "En local sur ton ordinateur", "Uniquement sur Vercel"], correct: 1, points: 1 },
        { order: 2, type: "true_false", prompt: "GitHub est un fork de Git.", options: ["Vrai", "Faux"], correct: 1, points: 1 },
        { order: 3, type: "single", prompt: "Quelle commande crée un nouveau dépôt Git ?", options: ["git start", "git init", "git create", "git new"], correct: 1, points: 1 },
        { order: 4, type: "multiple", prompt: "Lesquels de ces éléments sont stockés localement par Git ?", options: ["Les commits", "Les branches", "Les pull requests", "L'historique complet"], correct: [0, 1, 3], points: 2 },
        { order: 5, type: "single", prompt: "Après `git add .`, que faut-il faire pour enregistrer les changements ?", options: ["git save", "git push", "git commit", "git store"], correct: 2, points: 1 },
      ],
    },
  },
  {
    number: 2,
    sujet: "Pratique : brancher, committer, pousser, tirer",
    objective: "Maîtriser le cycle de travail quotidien : branch, commit, push, pull.",
    program:
      "Le cycle branch → commit → push → pull · écrire un bon message de commit · " +
      "exercice guidé : mettre son CV en ligne sur GitHub.",
    skills: ["git-branch", "git-push", "git-pull", "commit-conventions"],
    eventDay: "dimanche",
    eventTitle: "Maîtrise GitHub #2 — Pratique : brancher, committer, pousser, tirer",
    recurrenceId: "github-bases-dimanche",
    activities: [
      { order: 1, kind: "resource", title: "Guide : écrire de bons messages de commit", description: "Conventions Conventional Commits et pourquoi c'est important." },
      { order: 2, kind: "practice", title: "Exercice : cycle branch-commit-push", description: "Créer une branche, modifier un fichier, committer et pousser." },
      { order: 3, kind: "practice", title: "Mettre son CV en ligne sur GitHub", description: "Créer un dépôt, ajouter un fichier CV.md, activer GitHub Pages." },
    ],
    deliverable: { type: "github_repo", title: "Dépôt avec CV en ligne", description: "Un dépôt GitHub contenant un fichier CV.md, commit minimal.", isRequired: true },
    quiz: {
      title: "Quiz S02 — Cycle de travail",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Quelle commande crée et bascule sur une nouvelle branche ?", options: ["git switch new", "git checkout -b ma-branche", "git branch --create", "git new-branch"], correct: 1, points: 1 },
        { order: 2, type: "single", prompt: "Que fait `git pull` ?", options: ["Pousse tes commits vers GitHub", "Tire les changements distants en local", "Supprime une branche", "Fusionne deux branches"], correct: 1, points: 1 },
        { order: 3, type: "true_false", prompt: "Un bon message de commit commence par un verbe à l'infinitif.", options: ["Vrai", "Faux"], correct: 0, points: 1 },
        { order: 4, type: "multiple", prompt: "Quelles sont les étapes du cycle de travail Git ?", options: ["pull", "branch", "commit", "push", "deploy"], correct: [0, 1, 2, 3], points: 2 },
      ],
    },
  },
  {
    number: 3,
    sujet: "Q/R + mini-projet : un README pro",
    objective: "Lever les blocages de la semaine et soigner la vitrine de son dépôt.",
    program:
      "Questions/réponses sur les séances 1 et 2 · corriger les blocages individuels · " +
      "écrire un README professionnel.",
    skills: ["markdown", "readme", "github-profile"],
    eventDay: "mercredi",
    eventTitle: "Maîtrise GitHub #3 — Q/R + mini-projet : un README pro",
    recurrenceId: "github-bases-mercredi",
    activities: [
      { order: 1, kind: "practice", title: "Session Q/R interactive", description: "Poser ses questions sur les séances 1 et 2." },
      { order: 2, kind: "resource", title: "Guide : syntaxe Markdown", description: "Titres, listes, liens, images, code blocks." },
      { order: 3, kind: "practice", title: "Écrire un README professionnel", description: "Structure, badges, description, licence, contact." },
    ],
    deliverable: { type: "github_repo", title: "README.md professionnel", description: "Un README complet avec titre, description, badges et licence.", isRequired: true },
    quiz: {
      title: "Quiz S03 — Markdown & README",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Comment écrire un titre de niveau 2 en Markdown ?", options: ["== Titre ==", "## Titre", "**Titre**", "// Titre"], correct: 1, points: 1 },
        { order: 2, type: "single", prompt: "Quel élément est obligatoire dans un README professionnel ?", options: ["Un GIF", "Une description du projet", "Un badge CI", "Une photo"], correct: 1, points: 1 },
        { order: 3, type: "true_false", prompt: "Le Markdown est compatible avec GitHub.", options: ["Vrai", "Faux"], correct: 0, points: 1 },
      ],
    },
  },
  // ── Semaine 2 ─────────────────────────────────────────────────────
  {
    number: 4,
    sujet: "Les branches : créer, merger, résoudre les conflits",
    objective: "Travailler sur plusieurs versions d'un projet sans écraser le travail des autres.",
    program:
      "Créer et changer de branche · fusionner (merge) · comprendre et résoudre " +
      "un conflit pas à pas · bonnes pratiques de nommage.",
    skills: ["git-branch", "git-merge", "merge-conflicts"],
    eventDay: "samedi",
    eventTitle: "Maîtrise GitHub #4 — Les branches : créer, merger, résoudre les conflits",
    recurrenceId: "github-bases-samedi",
    activities: [
      { order: 1, kind: "resource", title: "Vidéo : comprendre les branches Git", description: "Modèle de branches et flux de travail." },
      { order: 2, kind: "practice", title: "Créer, fusionner, résoudre un conflit", description: "Exercice pas à pas avec deux branches qui modifient le même fichier." },
      { order: 3, kind: "practice", title: "Bonnes pratiques de nommage", description: "Convention : feat/, fix/, docs/, etc." },
    ],
    deliverable: { type: "github_repo", title: "Dépôt avec merge de branches", description: "Un dépôt contenant au moins un merge réussi entre deux branches.", isRequired: true },
    quiz: {
      title: "Quiz S04 — Branches & merges",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Quelle commande fusionne une branche dans la branche courante ?", options: ["git combine", "git merge ma-branche", "git join", "git fuse"], correct: 1, points: 1 },
        { order: 2, type: "single", prompt: "Un conflit de merge signifie que Git…", options: ["A supprimé le fichier", "Ne sait pas quel changement garder", "N'a plus d'espace disque", "A perdu tes commits"], correct: 1, points: 1 },
        { order: 3, type: "multiple", prompt: "Bonnes pratiques pour les branches :", options: ["Noms courts et descriptifs", "Une branche par feature", "Ne jamais supprimer de branche", "Utiliser des préfixes (feat/, fix/)"], correct: [0, 1, 3], points: 2 },
      ],
    },
  },
  {
    number: 5,
    sujet: "Pull Request : demander une review",
    objective: "Proposer ses changements proprement et faire relire son code.",
    program:
      "Ouvrir une pull request · décrire son changement · reviewer et commenter " +
      "le code d'un pair · exercice en binôme.",
    skills: ["pull-request", "code-review", "github"],
    eventDay: "dimanche",
    eventTitle: "Maîtrise GitHub #5 — Pull Request : demander une review",
    recurrenceId: "github-bases-dimanche",
    activities: [
      { order: 1, kind: "resource", title: "Guide : rédiger une bonne PR", description: "Titre, description, checklist, screenshots." },
      { order: 2, kind: "practice", title: "Ouvrir une PR et la décrire", description: "Exercice : pousser une feature, ouvrir une PR, remplir le template." },
      { order: 3, kind: "practice", title: "Reviewer le code d'un pair", description: "Lire un diff, commenter, suggérer des améliorations." },
    ],
    deliverable: { type: "pull_request", title: "PR ouverte avec description", description: "Une pull request ouverte sur ton dépôt avec titre et description complètes.", isRequired: true },
    quiz: {
      title: "Quiz S05 — Pull Requests",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Une pull request sert à…", options: ["Supprimer du code", "Demander la fusion de sa branche", "Créer un dépôt", "Installer des dépendances"], correct: 1, points: 1 },
        { order: 2, type: "true_false", prompt: "On peut reviewer sa propre pull request.", options: ["Vrai", "Faux"], correct: 1, points: 1 },
        { order: 3, type: "multiple", prompt: "Ce qu'une bonne PR contient :", options: ["Un titre clair", "Une description des changements", "Des screenshots si UI", "Le code complet du projet"], correct: [0, 1, 2], points: 2 },
      ],
    },
  },
  {
    number: 6,
    sujet: "Issues & Projets : piloter un projet",
    objective: "Organiser un projet de bout en bout avec les outils GitHub.",
    program:
      "Créer et découper des issues · labels et assignation · tableau de projet (Kanban) · " +
      "relier une issue à une pull request.",
    skills: ["github-issues", "github-projects", "kanban"],
    eventDay: "mercredi",
    eventTitle: "Maîtrise GitHub #6 — Issues & Projets : piloter un projet",
    recurrenceId: "github-bases-mercredi",
    activities: [
      { order: 1, kind: "resource", title: "Guide : GitHub Issues", description: "Créer, labelliser, assigner, refermer automatiquement." },
      { order: 2, kind: "practice", title: "Créer un tableau Kanban", description: "Projet GitHub avec colonnes To do / In progress / Done." },
      { order: 3, kind: "practice", title: "Relier une issue à une PR", description: "Fermer automatiquement une issue via une PR." },
    ],
    deliverable: { type: "github_repo", title: "Projet GitHub avec issues", description: "Un dépôt avec au moins 3 issues et un tableau de projet Kanban.", isRequired: true },
    quiz: {
      title: "Quiz S06 — Issues & Projets",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Un label GitHub sert à…", options: ["Exécuter du code", "Catégoriser une issue", "Créer une branche", "Déployer"], correct: 1, points: 1 },
        { order: 2, type: "single", prompt: "Pour fermer automatiquement une issue via une PR, on écrit…", options: ["closes #12", "fixes #12", "resolves #12", "Toutes les réponses ci-dessus"], correct: 3, points: 1 },
        { order: 3, type: "true_false", prompt: "GitHub Projects permet de créer un tableau Kanban.", options: ["Vrai", "Faux"], correct: 0, points: 1 },
      ],
    },
  },
  // ── Semaine 3 ─────────────────────────────────────────────────────
  {
    number: 7,
    sujet: ".gitignore & Markdown : bien documenter",
    objective: "Ne jamais committer ce qui ne doit pas l'être, et écrire une doc lisible.",
    program:
      "À quoi sert .gitignore · ignorer fichiers et dossiers · syntaxe Markdown · " +
      "structure d'un README efficace · licences.",
    skills: ["gitignore", "markdown", "licences"],
    eventDay: "samedi",
    eventTitle: "Maîtrise GitHub #7 — .gitignore & Markdown : bien documenter",
    recurrenceId: "github-bases-samedi",
    activities: [
      { order: 1, kind: "resource", title: "Liste des .gitignore courants", description: "Node, Python, Java, etc." },
      { order: 2, kind: "practice", title: "Configurer .gitignore", description: "Ajouter node_modules/, .env, etc." },
      { order: 3, kind: "practice", title: "Rédiger la doc du projet", description: "README, CONTRIBUTING, LICENSE." },
    ],
    deliverable: { type: "github_repo", title: "Dépôt avec .gitignore et doc", description: "Dépôt contenant un .gitignore configuré et une documentation complète.", isRequired: true },
    quiz: {
      title: "Quiz S07 — .gitignore & Documentation",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Le fichier .gitignore sert à…", options: ["Supprimer des fichiers", "Ignorer des fichiers dans les commits", "Protéger un dépôt", "Créer des branches"], correct: 1, points: 1 },
        { order: 2, type: "true_false", prompt: "Un fichier dans .gitignore peut toujours être ajouté avec `git add -f`.", options: ["Vrai", "Faux"], correct: 0, points: 1 },
        { order: 3, type: "single", prompt: "Quelle licence est la plus permissive ?", options: ["GPL", "MIT", "Apache 2.0", "Propriétaire"], correct: 1, points: 1 },
      ],
    },
  },
  {
    number: 8,
    sujet: "GitHub Pages : déployer son portfolio",
    objective: "Mettre un site en ligne gratuitement, sans serveur à gérer.",
    program:
      "Activer GitHub Pages · branche et dossier de publication · mettre en ligne " +
      "un portfolio · nom de domaine personnalisé.",
    skills: ["github-pages", "html", "css", "deployment"],
    eventDay: "dimanche",
    eventTitle: "Maîtrise GitHub #8 — GitHub Pages : déployer son portfolio",
    recurrenceId: "github-bases-dimanche",
    activities: [
      { order: 1, kind: "resource", title: "Guide GitHub Pages", description: "Activation, configuration, custom domain." },
      { order: 2, kind: "practice", title: "Déployer un site statique", description: "Créer un index.html et activer Pages." },
      { order: 3, kind: "practice", title: "Personnaliser le domaine", description: "Configurer un nom de domaine personnalisé." },
    ],
    deliverable: { type: "deployed_url", title: "Portfolio en ligne via GitHub Pages", description: "Un site accessible via <user>.github.io/<depot>.", isRequired: true },
    quiz: {
      title: "Quiz S08 — GitHub Pages",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "GitHub Pages héberge des sites…", options: ["Dynamiques (Node.js)", "Statiques (HTML/CSS/JS)", "Avec base de données", "Avec PHP"], correct: 1, points: 1 },
        { order: 2, type: "single", prompt: "L'URL par défaut d'un site Pages est…", options: ["github.com/<user>", "<user>.github.io/<repo>", "<repo>.github.com", "pages.github.com/<user>"], correct: 1, points: 1 },
        { order: 3, type: "true_false", prompt: "GitHub Pages est gratuit pour les dépôts publics.", options: ["Vrai", "Faux"], correct: 0, points: 1 },
      ],
    },
  },
  {
    number: 9,
    sujet: "GitHub Actions : première automatisation",
    objective: "Faire faire par GitHub ce qu'on faisait à la main.",
    program:
      "Anatomie d'un workflow · déclencheurs (push, pull request) · premier job : " +
      "lint et tests automatiques · lire les logs d'exécution.",
    skills: ["github-actions", "ci-cd", "yaml"],
    eventDay: "mercredi",
    eventTitle: "Maîtrise GitHub #9 — GitHub Actions : première automatisation",
    recurrenceId: "github-bases-mercredi",
    activities: [
      { order: 1, kind: "resource", title: "Anatomie d'un workflow GitHub Actions", description: "Triggers, jobs, steps, action marketplace." },
      { order: 2, kind: "practice", title: "Créer un workflow CI", description: "Lint automatique à chaque push." },
      { order: 3, kind: "practice", title: "Lire les logs d'exécution", description: "Comprendre les logs et débugger un workflow." },
    ],
    deliverable: { type: "github_repo", title: "Workflow GitHub Actions fonctionnel", description: "Un fichier .github/workflows/ci.yml qui s'exécute avec succès.", isRequired: true },
    quiz: {
      title: "Quiz S09 — GitHub Actions",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Un workflow GitHub Actions est écrit en…", options: ["JavaScript", "Python", "YAML", "JSON"], correct: 2, points: 1 },
        { order: 2, type: "single", prompt: "Le déclencheur `on: push` s'active quand…", options: ["Tu crées un dépôt", "Tu pousses du code", "Tu crées une issue", "Tu merges une PR"], correct: 1, points: 1 },
        { order: 3, type: "true_false", prompt: "GitHub Actions est gratuit pour les dépôts publics.", options: ["Vrai", "Faux"], correct: 0, points: 1 },
      ],
    },
  },
  // ── Semaine 4 ─────────────────────────────────────────────────────
  {
    number: 10,
    sujet: "Projet en groupe : construire à plusieurs",
    objective: "Appliquer tout le programme sur un projet mené en équipe.",
    program:
      "Répartition en équipes · définition du périmètre · branches, pull requests " +
      "et reviews en conditions réelles.",
    skills: ["teamwork", "git-flow", "pull-request"],
    eventDay: "samedi",
    eventTitle: "Maîtrise GitHub #10 — Projet en groupe : construire à plusieurs",
    recurrenceId: "github-bases-samedi",
    activities: [
      { order: 1, kind: "practice", title: "Formation des équipes", description: "Choisir un projet, répartir les rôles." },
      { order: 2, kind: "practice", title: "Développement en binôme", description: "Branches, commits, PRs et reviews en conditions réelles." },
    ],
    deliverable: { type: "project", title: "Projet groupe en cours", description: "Un dépôt partagé avec au moins 2 PRs mergées.", isRequired: true },
    quiz: {
      title: "Quiz S10 — Travail en équipe",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "En travail en équipe, la branche principale doit toujours être…", options: ["Stable et à jour", "Vide", "Privée", "Supprimée après chaque release"], correct: 0, points: 1 },
        { order: 2, type: "multiple", prompt: "Bonnes pratiques du travail en équipe :", options: ["Petites PRs", "Messages de commit clairs", "Ne jamais commenter le code des autres", "Reviewer avant de merger"], correct: [0, 1, 3], points: 2 },
      ],
    },
  },
  {
    number: 11,
    sujet: "Revue & déploiement : finaliser et mettre en ligne",
    objective: "Livrer un projet présentable et en ligne.",
    program:
      "Revue collective des projets · corriger les derniers blocages · déployer · " +
      "soigner la présentation du dépôt.",
    skills: ["code-review", "deployment", "presentation"],
    eventDay: "dimanche",
    eventTitle: "Maîtrise GitHub #11 — Revue & déploiement : finaliser et mettre en ligne",
    recurrenceId: "github-bases-dimanche",
    activities: [
      { order: 1, kind: "practice", title: "Revue collective des projets", description: "Présentation et feedback croisés." },
      { order: 2, kind: "practice", title: "Déploiement final", description: "Mettre le projet en ligne (Pages, Vercel, etc.)." },
    ],
    deliverable: { type: "deployed_url", title: "Projet déployé et accessible", description: "URL fonctionnelle du projet déployé.", isRequired: true },
    quiz: {
      title: "Quiz S11 — Finalisation",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Avant de déployer en production, il faut…", options: ["Supprimer les tests", "Relire et tester localement", "Envoyer par email", "Push directement sur main"], correct: 1, points: 1 },
        { order: 2, type: "true_false", prompt: "Un README soigné améliore la perception du projet.", options: ["Vrai", "Faux"], correct: 0, points: 1 },
      ],
    },
  },
  {
    number: 12,
    sujet: "Prochaines étapes : continuer seul",
    objective: "Savoir quoi faire ensuite, sans accompagnement.",
    program:
      "Bonnes pratiques qui durent · conventions de commit · ressources pour " +
      "progresser seul · questions/réponses finale.",
    skills: ["open-source", "community", "next-steps"],
    eventDay: "mercredi",
    eventTitle: "Maîtrise GitHub #12 — Prochaines étapes : continuer seul",
    recurrenceId: "github-bases-mercredi",
    activities: [
      { order: 1, kind: "resource", title: "Ressources pour progresser seul", description: "Contributions open source, blogs, newsletters." },
      { order: 2, kind: "practice", title: "Q/R finale et bilan du programme", description: "Questions ouvertes et bilan personnel." },
    ],
    deliverable: { type: "text", title: "Bilan personnel du programme", description: "Écris un court texte sur ce que tu as appris et ce que tu veux faire ensuite.", isRequired: true },
    quiz: {
      title: "Quiz S12 — Bilan",
      passThreshold: 70,
      questions: [
        { order: 1, type: "single", prompt: "Pour progresser en code, la meilleure chose à faire est…", options: ["Lire uniquement des livres", "Pratiquer et contribuer à des projets", "Copier-coller du code", "Attendre qu'on te forme"], correct: 1, points: 1 },
        { order: 2, type: "multiple", prompt: "Où trouver de l'aide pour coder ?", options: ["GitHub Discussions", "Stack Overflow", "Twitter uniquement", "Communautés Discord/Slack"], correct: [0, 1, 3], points: 2 },
      ],
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

function weekTitle(n: number): string {
  return WEEKS[n - 1]?.title ?? `Semaine ${n}`;
}
function weekObjective(n: number): string {
  return WEEKS[n - 1]?.objective ?? "";
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  let createdWorkshop = 0;
  let updatedWorkshop = 0;
  let createdWeeks = 0;
  let createdSessions = 0;
  let updatedSessions = 0;
  let keptSessions = 0;
  let createdActivities = 0;
  let createdDeliverables = 0;
  let createdQuizzes = 0;
  let createdQuestions = 0;
  let linkedEvents = 0;
  let skippedEvents = 0;

  console.info(
    `\nSeed Workshop « ${WORKSHOP_DATA.title} »` +
      `${DRY_RUN ? " (DRY RUN, aucune écriture)" : ""}\n`,
  );

  // ── 1. Workshop ─────────────────────────────────────────────────

  const existingWs = await prisma.workshop.findUnique({
    where: { slug: WORKSHOP_DATA.slug },
    select: { id: true },
  });

  let workshopId: string;

  if (!existingWs) {
    if (!DRY_RUN) {
      const ws = await prisma.workshop.create({ data: WORKSHOP_DATA });
      workshopId = ws.id;
    } else {
      workshopId = "__dry_run__";
    }
    createdWorkshop++;
    console.info(`  + Workshop : ${WORKSHOP_DATA.title}`);
  } else if (FORCE) {
    workshopId = existingWs.id;
    if (!DRY_RUN) {
      await prisma.workshop.update({ where: { id: workshopId }, data: WORKSHOP_DATA });
    }
    updatedWorkshop++;
    console.info(`  ~ Workshop : ${WORKSHOP_DATA.title} (mis à jour)`);
  } else {
    workshopId = existingWs.id;
    console.info(`  = Workshop : ${WORKSHOP_DATA.title} (déjà présent)`);
  }

  // ── 2. Semaines ─────────────────────────────────────────────────

  const weekIds = new Map<number, string>(); // numéro → id

  for (const week of WEEKS) {
    const existingWeek = await prisma.workshopWeek.findFirst({
      where: { workshopId, number: week.number },
      select: { id: true },
    });

    if (!existingWeek) {
      if (!DRY_RUN) {
        const created = await prisma.workshopWeek.create({
          data: {
            workshopId,
            number: week.number,
            title: week.title,
            objective: week.objective,
          },
        });
        weekIds.set(week.number, created.id);
      } else {
        weekIds.set(week.number, `__dry_run_week_${week.number}__`);
      }
      createdWeeks++;
      console.info(`    + Semaine ${week.number} : ${week.title}`);
    } else {
      weekIds.set(week.number, existingWeek.id);
      console.info(`    = Semaine ${week.number} : ${week.title} (existe)`);
    }
  }

  // ── 3. Séances ──────────────────────────────────────────────────

  for (const s of SESSIONS) {
    const weekNum = Math.ceil(s.number / 3);
    const weekId = weekIds.get(weekNum);

    if (!weekId || weekId.startsWith("__dry_run")) {
      // En dry-run, on ne peut pas vérifier l'existence — on continue
      if (DRY_RUN) {
        // Pas de semaine DB en dry-run, on passe directement aux données
      } else {
        console.error(`    ✗ Semaine ${weekNum} introuvable pour S${String(s.number).padStart(2, "0")}`);
        continue;
      }
    }

    const existingSession = !DRY_RUN
      ? await prisma.workshopSession.findFirst({
          where: { weekId: weekId!, number: s.number },
          select: { id: true },
        })
      : null;

    // Liaison Event : on cherche par titre + recurrenceId
    const event = await prisma.event.findFirst({
      where: { title: s.eventTitle, recurrenceId: s.recurrenceId },
      select: { id: true },
    });

    if (event) {
      linkedEvents++;
    } else {
      skippedEvents++;
      console.info(`    ⚠ Event introuvable : "${s.eventTitle}" (recurrenceId=${s.recurrenceId})`);
    }

    const sessionData = {
      number: s.number,
      title: `S${String(s.number).padStart(2, "0")} — ${s.sujet}`,
      objective: s.objective,
      program: s.program,
      skills: JSON.stringify(s.skills),
      deliverableRequired: true,
      quizRequired: true,
      eventId: event?.id ?? null,
    };

    let sessionId: string;

    if (!existingSession) {
      if (!DRY_RUN) {
        const sess = await prisma.workshopSession.create({
          data: { weekId: weekId!, ...sessionData },
        });
        sessionId = sess.id;
      } else {
        sessionId = `__dry_run_s${s.number}__`;
      }
      createdSessions++;
      console.info(`    + S${String(s.number).padStart(2, "0")} : ${s.sujet}`);
    } else if (FORCE) {
      sessionId = existingSession.id;
      if (!DRY_RUN) {
        await prisma.workshopSession.update({
          where: { id: sessionId },
          data: sessionData,
        });
      }
      updatedSessions++;
      console.info(`    ~ S${String(s.number).padStart(2, "0")} : ${s.sujet} (mis à jour)`);
    } else {
      sessionId = existingSession.id;
      keptSessions++;
      console.info(`    = S${String(s.number).padStart(2, "0")} : ${s.sujet} (existe)`);
    }

    // ── 4. Activités ──────────────────────────────────────────────

    const existingActivities = DRY_RUN
      ? 0
      : await prisma.workshopActivity.count({ where: { sessionId } });

    if (existingActivities === 0) {
      for (const act of s.activities) {
        if (!DRY_RUN) {
          await prisma.workshopActivity.create({
            data: {
              sessionId,
              order: act.order,
              kind: act.kind,
              title: act.title,
              description: act.description ?? null,
              url: act.url ?? null,
            },
          });
        }
        createdActivities++; // compte aussi en dry-run pour l'aperçu
      }
    }

    // ── 5. Livrable ───────────────────────────────────────────────

    const existingDeliverable = DRY_RUN
      ? null
      : await prisma.workshopDeliverable.findUnique({ where: { sessionId } });

    if (!existingDeliverable) {
      if (!DRY_RUN) {
        await prisma.workshopDeliverable.create({
          data: {
            sessionId,
            type: s.deliverable.type,
            title: s.deliverable.title,
            description: s.deliverable.description,
            isRequired: s.deliverable.isRequired,
          },
        });
      }
      createdDeliverables++;
    }

    // ── 6. Quiz + Questions ───────────────────────────────────────

    const existingQuiz = DRY_RUN
      ? null
      : await prisma.workshopQuiz.findUnique({
          where: { sessionId },
          select: { id: true },
        });

    let quizId: string | null = null;

    if (!existingQuiz) {
      if (!DRY_RUN) {
        const quiz = await prisma.workshopQuiz.create({
          data: {
            sessionId,
            title: s.quiz.title,
            passThreshold: s.quiz.passThreshold,
            maxAttempts: null, // tentatives illimitées
            isRequired: true,
          },
        });
        quizId = quiz.id;
      } else {
        quizId = `__dry_run_quiz_${s.number}__`;
      }
      createdQuizzes++;

      for (const q of s.quiz.questions) {
        if (!DRY_RUN && quizId && !quizId.startsWith("__dry_run")) {
          await prisma.workshopQuestion.create({
            data: {
              quizId,
              order: q.order,
              type: q.type,
              prompt: q.prompt,
              optionsJson: JSON.stringify(q.options),
              correctJson: JSON.stringify(q.correct),
              points: q.points,
            },
          });
        }
        createdQuestions++;
      }
    }
  }

  // ── Résumé ────────────────────────────────────────────────────────

  await prisma.$disconnect();

  console.info(
    `\n${DRY_RUN ? "Aperçu" : "Seed"} terminé :\n` +
      `  Workshop : ${createdWorkshop} créé, ${updatedWorkshop} mis à jour\n` +
      `  Semaines : ${createdWeeks} créées\n` +
      `  Séances  : ${createdSessions} créées, ${updatedSessions} mises à jour, ${keptSessions} conservées\n` +
      `  Activités : ${createdActivities} créées\n` +
      `  Livrables : ${createdDeliverables} créés\n` +
      `  Quizzes   : ${createdQuizzes} créés (${createdQuestions} questions)\n` +
      `  Events liés : ${linkedEvents} trouvés, ${skippedEvents} introuvables\n` +
      `\nAucune notification email envoyée.`,
  );
}

main().catch((err) => {
  console.error("\nSEED ÉCHOUÉ :", err instanceof Error ? err.message : err);
  process.exit(1);
});
