#!/usr/bin/env node
/**
 * Seed du programme « Maîtrise GitHub — Bases » (12 séances sur 4 semaines).
 *
 * Crée les événements de l'agenda SANS envoyer de notification email :
 * la création via POST /api/events déclenche un envoi de masse aux membres
 * APPROVED, ce qui ferait 12 envois à toute la base. Les séances sont donc
 * insérées directement, et l'annonce aux membres reste un geste admin
 * explicite et unique (onglet Marketing → Annonce).
 *
 * Idempotent : une séance déjà présente (même titre, même début) n'est pas
 * recréée. Relancer le script ne produit donc jamais de doublon.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/seed-github-program.ts --dry-run
 *   node --env-file=.env --import tsx scripts/seed-github-program.ts
 *   node --env-file=.env --import tsx scripts/seed-github-program.ts --force
 *
 *   --dry-run : affiche le planning sans rien écrire.
 *   --force   : met à jour les séances existantes (titre, description, lieu,
 *               lien, horaires) au lieu de les laisser telles quelles.
 *
 * Fuseau de référence : UTC+1. La communauté est majoritairement béninoise
 * (34/48 membres), avec une minorité en UTC+0 (Côte d'Ivoire, Burkina, Guinée).
 * Aucun de ces fuseaux n'observe l'heure d'été : l'offset est donc constant
 * sur tout le programme, sans piège de changement d'heure.
 *
 * L'offset est écrit en clair dans la chaîne de date : une conversion implicite
 * (via la locale de la machine qui exécute le script) décalerait silencieusement
 * les 12 séances. Un script doit produire le même instant partout.
 */

import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

/** Salle Google Meet commune à tous les ateliers. */
const MEET_URL =
  process.env.NEXT_PUBLIC_MEET_URL ?? "https://meet.google.com/pdr-qjei-zkk";
const LOCATION = "Google Meet";
const RECURRENCE = "weekly";

/**
 * Fuseau de référence du programme (UTC+1, sans heure d'été).
 * `Africa/Porto-Novo` (Bénin) représente la majorité des membres ; utilisée
 * uniquement pour l'affichage lisible de l'aperçu, jamais pour le calcul.
 */
const REFERENCE_TZ = "Africa/Porto-Novo";

/** Prérequis identique pour toutes les séances. */
const PREREQUISITE = "Prérequis : un ordinateur et une connexion internet.";

interface Serie {
  /** Groupe de récurrence stocké dans Event.recurrenceId. */
  id: string;
  /** Début en heure de Paris, offset explicite. */
  heure: string;
  /** Durée en minutes. */
  duree: number;
}

interface Seance {
  numero: number;
  semaine: number;
  sujet: string;
  objectif: string;
  programme: string;
  serie: keyof typeof SERIES;
  /** Jour de la séance, au format AAAA-MM-JJ. */
  jour: string;
}

const SERIES = {
  samedi: { id: "github-bases-samedi", heure: "20:00:00", duree: 120 },
  dimanche: { id: "github-bases-dimanche", heure: "19:00:00", duree: 120 },
  mercredi: { id: "github-bases-mercredi", heure: "20:30:00", duree: 120 },
} as const satisfies Record<string, Serie>;

/**
 * Offset UTC+1, porté explicitement dans la chaîne de date.
 * Constant : les fuseaux de la communauté (UTC+1 et UTC+0) n'ont pas d'heure
 * d'été, contrairement à l'Europe.
 */
const OFFSET = "+01:00";

const SEANCES: Seance[] = [
  {
    numero: 1,
    semaine: 1,
    jour: "2026-09-19",
    serie: "samedi",
    sujet: "Découverte de Git & GitHub",
    objectif: "Comprendre à quoi servent Git et GitHub, et publier son premier commit.",
    programme:
      "C'est quoi Git, c'est quoi GitHub (et pourquoi ce n'est pas la même chose) · créer son compte · installer Git · créer son premier dépôt · publier son premier commit.",
  },
  {
    numero: 2,
    semaine: 1,
    jour: "2026-09-20",
    serie: "dimanche",
    sujet: "Pratique : brancher, committer, pousser, tirer",
    objectif: "Maîtriser le cycle de travail quotidien : branch, commit, push, pull.",
    programme:
      "Le cycle branch → commit → push → pull · écrire un bon message de commit · exercice guidé : mettre son CV en ligne sur GitHub.",
  },
  {
    numero: 3,
    semaine: 1,
    jour: "2026-09-23",
    serie: "mercredi",
    sujet: "Q/R + mini-projet : un README pro",
    objectif: "Lever les blocages de la semaine et soigner la vitrine de son dépôt.",
    programme:
      "Questions/réponses sur les séances 1 et 2 · corriger les blocages individuels · écrire un README professionnel.",
  },
  {
    numero: 4,
    semaine: 2,
    jour: "2026-09-26",
    serie: "samedi",
    sujet: "Les branches : créer, merger, résoudre les conflits",
    objectif: "Travailler sur plusieurs versions d'un projet sans écraser le travail des autres.",
    programme:
      "Créer et changer de branche · fusionner (merge) · comprendre et résoudre un conflit pas à pas · bonnes pratiques de nommage.",
  },
  {
    numero: 5,
    semaine: 2,
    jour: "2026-09-27",
    serie: "dimanche",
    sujet: "Pull Request : demander une review",
    objectif: "Proposer ses changements proprement et faire relire son code.",
    programme:
      "Ouvrir une pull request · décrire son changement · reviewer et commenter le code d'un pair · exercice en binôme.",
  },
  {
    numero: 6,
    semaine: 2,
    jour: "2026-09-30",
    serie: "mercredi",
    sujet: "Issues & Projets : piloter un projet",
    objectif: "Organiser un projet de bout en bout avec les outils GitHub.",
    programme:
      "Créer et découper des issues · labels et assignation · tableau de projet (Kanban) · relier une issue à une pull request.",
  },
  {
    numero: 7,
    semaine: 3,
    jour: "2026-10-03",
    serie: "samedi",
    sujet: ".gitignore & Markdown : bien documenter",
    objectif: "Ne jamais committer ce qui ne doit pas l'être, et écrire une doc lisible.",
    programme:
      "À quoi sert .gitignore · ignorer fichiers et dossiers · syntaxe Markdown · structure d'un README efficace · licences.",
  },
  {
    numero: 8,
    semaine: 3,
    jour: "2026-10-04",
    serie: "dimanche",
    sujet: "GitHub Pages : déployer son portfolio",
    objectif: "Mettre un site en ligne gratuitement, sans serveur à gérer.",
    programme:
      "Activer GitHub Pages · branche et dossier de publication · mettre en ligne un portfolio · nom de domaine personnalisé.",
  },
  {
    numero: 9,
    semaine: 3,
    jour: "2026-10-07",
    serie: "mercredi",
    sujet: "GitHub Actions : première automatisation",
    objectif: "Faire faire par GitHub ce qu'on faisait à la main.",
    programme:
      "Anatomie d'un workflow · déclencheurs (push, pull request) · premier job : lint et tests automatiques · lire les logs d'exécution.",
  },
  {
    numero: 10,
    semaine: 4,
    jour: "2026-10-10",
    serie: "samedi",
    sujet: "Projet en groupe : construire à plusieurs",
    objectif: "Appliquer tout le programme sur un projet mené en équipe.",
    programme:
      "Répartition en équipes · définition du périmètre · branches, pull requests et reviews en conditions réelles.",
  },
  {
    numero: 11,
    semaine: 4,
    jour: "2026-10-11",
    serie: "dimanche",
    sujet: "Revue & déploiement : finaliser et mettre en ligne",
    objectif: "Livrer un projet présentable et en ligne.",
    programme:
      "Revue collective des projets · corriger les derniers blocages · déployer · soigner la présentation du dépôt.",
  },
  {
    numero: 12,
    semaine: 4,
    jour: "2026-10-14",
    serie: "mercredi",
    sujet: "Prochaines étapes : continuer seul",
    objectif: "Savoir quoi faire ensuite, sans accompagnement.",
    programme:
      "Bonnes pratiques qui durent · conventions de commit · ressources pour progresser seul · questions/réponses finale.",
  },
];

/** Titre affiché dans l'agenda et dans la page publique /evenements. */
function titre(s: Seance): string {
  return `Maîtrise GitHub #${s.numero} — ${s.sujet}`;
}

/** Description complète, identique en structure pour les 12 séances. */
function description(s: Seance): string {
  return [
    `Programme « Maîtrise GitHub — Bases » · Semaine ${s.semaine}/4 · Séance ${s.numero}/12`,
    "",
    `Objectif : ${s.objectif}`,
    `Au programme : ${s.programme}`,
    "",
    PREREQUISITE,
  ].join("\n");
}

/** Début de séance, offset de Paris porté explicitement. */
function debut(s: Seance): Date {
  const serie = SERIES[s.serie];
  return new Date(`${s.jour}T${serie.heure}${OFFSET}`);
}

function fin(s: Seance): Date {
  return new Date(debut(s).getTime() + SERIES[s.serie].duree * 60_000);
}

/** Rendu lisible dans le fuseau de référence, pour l'aperçu du --dry-run. */
function enHeureDeReference(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: REFERENCE_TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Heure seule (HH:MM) dans le fuseau de référence. */
function heureDeReference(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: REFERENCE_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function main() {
  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  let kept = 0;

  console.info(
    `\nProgramme « Maîtrise GitHub — Bases » — ${SEANCES.length} séances` +
      `${DRY_RUN ? " (DRY RUN, aucune écriture)" : ""}\n` +
      `Heures de référence : UTC+1 (${REFERENCE_TZ})\n` +
      `Salle : ${LOCATION} · ${MEET_URL}\n`,
  );

  for (const s of SEANCES) {
    const data = {
      title: titre(s),
      description: description(s),
      startsAt: debut(s),
      endsAt: fin(s),
      location: LOCATION,
      url: MEET_URL,
      type: "workshop",
      // Transversal et ouvert à tous : pas de restriction de domaine
      // (null = visible par l'ensemble des membres).
      domain: null,
      level: "beginner",
      recurrence: RECURRENCE,
      recurrenceId: SERIES[s.serie].id,
      maxAttendees: null,
    };

    // Identité d'une séance : son titre (il porte le numéro) + sa série.
    // Volontairement PAS startsAt : corriger un horaire ne doit pas créer un
    // doublon, mais mettre à jour la séance existante (--force).
    const existing = await prisma.event.findFirst({
      where: { title: data.title, recurrenceId: data.recurrenceId },
      select: { id: true },
    });

    const creneau = `${enHeureDeReference(data.startsAt)} → ${heureDeReference(data.endsAt)}`;

    if (!existing) {
      if (!DRY_RUN) await prisma.event.create({ data });
      created++;
      console.info(`  + [${creneau}] ${data.title}`);
    } else if (FORCE) {
      if (!DRY_RUN) {
        await prisma.event.update({ where: { id: existing.id }, data });
      }
      updated++;
      console.info(`  ~ [${creneau}] ${data.title} (mis à jour)`);
    } else {
      kept++;
      console.info(`  = [${creneau}] ${data.title} (déjà présent, conservé)`);
    }
  }

  await prisma.$disconnect();

  console.info(
    `\n${DRY_RUN ? "Aperçu" : "Seed"} terminé : ${created} créées, ` +
      `${updated} mises à jour, ${kept} conservées. ` +
      `Aucune notification email envoyée (annonce manuelle depuis l'admin).`,
  );
}

main().catch((err) => {
  console.error("\nSEED ÉCHOUÉ :", err instanceof Error ? err.message : err);
  process.exit(1);
});
