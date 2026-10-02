#!/usr/bin/env node
/**
 * Seed des ateliers démo (structure Workshop complète).
 *
 * Crée 3 ateliers publiés avec semaines, séances, activités, livrables
 * et quiz (questions incluses) — de quoi tester tout le parcours membre :
 * inscription → séances → livrables → quiz → progression.
 *
 * Idempotent : la clé stable est le slug de l'atelier. Relancer le script
 * ne produit jamais de doublon (upsert par slug, recréation du contenu
 * enfant uniquement avec --force).
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/seed-workshops.ts --dry-run
 *   node --env-file=.env --import tsx scripts/seed-workshops.ts
 *   node --env-file=.env --import tsx scripts/seed-workshops.ts --force
 *
 *   --dry-run : affiche la structure sans rien écrire.
 *   --force   : supprime et recrée le contenu enfant (semaines, séances,
 *               quiz, livrables) des ateliers existants.
 */

import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

interface QuizSeed {
  title: string;
  passThreshold?: number;
  questions: {
    order: number;
    type: "single" | "multiple" | "true_false";
    prompt: string;
    options: string[];
    /** single/true_false : indice unique · multiple : indices multiples */
    correct: number | number[];
    points?: number;
  }[];
}

interface SessionSeed {
  number: number;
  title: string;
  objective: string;
  program: string;
  skills: string[];
  activities: { order: number; kind: "practice" | "resource"; title: string; description?: string; url?: string }[];
  deliverable: { type: string; title: string; description?: string };
  quiz: QuizSeed;
}

interface WeekSeed {
  number: number;
  title: string;
  objective?: string;
  sessions: SessionSeed[];
}

interface WorkshopSeed {
  slug: string;
  title: string;
  description: string;
  domain: string;
  level: string;
  weeks: WeekSeed[];
}

const WORKSHOPS: WorkshopSeed[] = [
  {
    slug: "initiation-au-code",
    title: "Initiation au code",
    description:
      "Découvrez les bases du développement web en 4 séances pratiques : HTML, CSS, mise en ligne et mini-projet portfolio.",
    domain: "web",
    level: "beginner",
    weeks: [
      {
        number: 1,
        title: "Les fondations du web",
        objective: "Comprendre la structure d'une page et la mettre en forme.",
        sessions: [
          {
            number: 1,
            title: "Premier contact avec le HTML",
            objective: "Écrire et comprendre sa première page HTML.",
            program:
              "Accueil et présentation · anatomie d'une page HTML · les balises essentielles · exercice guidé : ma première page.",
            skills: ["html", "structure", "editeur"],
            activities: [
              { order: 1, kind: "practice", title: "Écrire sa première page", description: "Créer un fichier index.html avec titre, paragraphes et une image." },
              { order: 2, kind: "resource", title: "MDN — Bases HTML", url: "https://developer.mozilla.org/fr/docs/Learn/Getting_started_with_the_web/HTML_basics" },
            ],
            deliverable: { type: "url", title: "Ma première page", description: "Lien vers votre page HTML (hébergée ou capture)." },
            quiz: {
              title: "Quiz — HTML essentiel",
              questions: [
                { order: 1, type: "single", prompt: "Que signifie HTML ?", options: ["HyperText Markup Language", "HighTech Machine Learning", "Home Tool Modern Language", "Hyperlink Text Mode Logiciel"], correct: 0 },
                { order: 2, type: "true_false", prompt: "La balise <img> a besoin d'une balise fermante </img>.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Lesquelles sont des balises HTML valides ?", options: ["<p>", "<titre>", "<a>", "<lien>"], correct: [0, 2] },
              ],
            },
          },
          {
            number: 2,
            title: "Mettre en forme avec CSS",
            objective: "Styliser une page : couleurs, polices, espacements.",
            program:
              "Lier une feuille CSS · sélecteurs de base · couleurs et typographie · exercice : styliser la page de la séance 1.",
            skills: ["css", "couleurs", "typographie"],
            activities: [
              { order: 1, kind: "practice", title: "Styliser sa page", description: "Ajouter couleurs, marges et une police à votre page HTML." },
              { order: 2, kind: "resource", title: "MDN — Bases CSS", url: "https://developer.mozilla.org/fr/docs/Learn/Getting_started_with_the_web/CSS_basics" },
            ],
            deliverable: { type: "url", title: "Page stylée", description: "Lien vers votre page avec sa feuille de style." },
            quiz: {
              title: "Quiz — CSS essentiel",
              questions: [
                { order: 1, type: "single", prompt: "Comment lier une feuille CSS externe ?", options: ["<link rel=\"stylesheet\" href=\"style.css\">", "<css src=\"style.css\">", "<style href=\"style.css\">", "@import dans le HTML"], correct: 0 },
                { order: 2, type: "true_false", prompt: "En CSS, « margin » gère l'espace intérieur d'un élément.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Lesquelles sont des propriétés CSS valides ?", options: ["color", "font-size", "texte-gras", "margin"], correct: [0, 1, 3] },
              ],
            },
          },
        ],
      },
      {
        number: 2,
        title: "Publier et aller plus loin",
        objective: "Mettre son travail en ligne et construire un mini-projet.",
        sessions: [
          {
            number: 3,
            title: "GitHub Pages : mettre en ligne",
            objective: "Publier sa page gratuitement avec GitHub Pages.",
            program:
              "Créer un compte GitHub · publier son dépôt · activer GitHub Pages · vérifier le site en ligne.",
            skills: ["github", "deploiement", "git"],
            activities: [
              { order: 1, kind: "practice", title: "Publier son dépôt", description: "Pousser vos fichiers sur GitHub et activer Pages." },
              { order: 2, kind: "resource", title: "Docs GitHub Pages", url: "https://docs.github.com/fr/pages" },
            ],
            deliverable: { type: "deployed_url", title: "Site en ligne", description: "URL publique de votre page (https://…). " },
            quiz: {
              title: "Quiz — Mise en ligne",
              questions: [
                { order: 1, type: "single", prompt: "Que fait GitHub Pages ?", options: ["Héberge un site statique gratuitement", "Compile du Python", "Envoie des emails", "Crée des bases de données"], correct: 0 },
                { order: 2, type: "true_false", prompt: "Il faut un serveur payant pour utiliser GitHub Pages.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Que faut-il pour publier avec GitHub Pages ?", options: ["Un compte GitHub", "Un dépôt avec des fichiers", "Une carte bancaire", "Activer Pages dans les réglages"], correct: [0, 1, 3] },
              ],
            },
          },
          {
            number: 4,
            title: "Mini-projet : portfolio",
            objective: "Assembler tout le programme dans un portfolio présentable.",
            program:
              "Définir le contenu du portfolio · structurer en sections · soigner la présentation · revue collective.",
            skills: ["projet", "portfolio", "presentation"],
            activities: [
              { order: 1, kind: "practice", title: "Construire son portfolio", description: "Page d'accueil + 2 sections (à propos, projets) en ligne." },
            ],
            deliverable: { type: "project", title: "Portfolio final", description: "URL du portfolio + description en 3 lignes." },
            quiz: {
              title: "Quiz — Bilan initiation",
              questions: [
                { order: 1, type: "single", prompt: "Quelle balise définit le titre affiché dans l'onglet du navigateur ?", options: ["<header>", "<title>", "<head-title>", "<onglet>"], correct: 1 },
                { order: 2, type: "true_false", prompt: "Un bon portfolio montre le code ET le résultat visible.", options: ["Vrai", "Faux"], correct: 0 },
                { order: 3, type: "multiple", prompt: "Que doit contenir un portfolio débutant ?", options: ["Une présentation", "Des projets visibles", "Son relevé de notes", "Un moyen de contact"], correct: [0, 1, 3] },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    slug: "cybersecurite-base",
    title: "Cybersécurité de base",
    description:
      "Comprendre les menaces courantes et adopter les bons réflexes : mots de passe, phishing, injections.",
    domain: "cybersecurity",
    level: "practicing",
    weeks: [
      {
        number: 1,
        title: "Se protéger au quotidien",
        objective: "Sécuriser ses comptes et reconnaître le phishing.",
        sessions: [
          {
            number: 1,
            title: "Mots de passe et double authentification",
            objective: "Passer à un gestionnaire de mots de passe + 2FA partout.",
            program:
              "Pourquoi les mots de passe fuient · gestionnaire de mots de passe · activer la 2FA · exercice : audit de ses comptes.",
            skills: ["mots-de-passe", "2fa", "hygiene"],
            activities: [
              { order: 1, kind: "practice", title: "Activer la 2FA", description: "Activer la double authentification sur 3 comptes importants." },
              { order: 2, kind: "resource", title: "ANSSI — Mots de passe", url: "https://www.ssi.gouv.fr/administration/guide/mot-de-passe/" },
            ],
            deliverable: { type: "text", title: "Bilan 2FA", description: "Liste des 3 comptes sécurisés (sans les mots de passe !)." },
            quiz: {
              title: "Quiz — Comptes sécurisés",
              questions: [
                { order: 1, type: "single", prompt: "Quelle est la meilleure pratique ?", options: ["Un mot de passe unique et long par site, dans un gestionnaire", "Le même mot de passe partout", "Sa date de naissance + « ! »", "Noter ses mots de passe sur un post-it"], correct: 0 },
                { order: 2, type: "true_false", prompt: "La 2FA par SMS est inviolable.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Lesquels sont des facteurs de 2FA ?", options: ["Un code d'application (TOTP)", "Une clé de sécurité physique", "Son plat préféré", "Une notification à approuver"], correct: [0, 1, 3] },
              ],
            },
          },
          {
            number: 2,
            title: "Repérer le phishing",
            objective: "Détecter un email ou SMS frauduleux avant de cliquer.",
            program:
              "Anatomie d'un phishing · vérifier l'expéditeur et les liens · exercice : trier 5 messages suspects.",
            skills: ["phishing", "email", "vigilance"],
            activities: [
              { order: 1, kind: "practice", title: "Analyser 5 messages", description: "Classer 5 exemples en « légitime » ou « phishing » en justifiant les indices." },
            ],
            deliverable: { type: "text", title: "Analyse phishing", description: "Votre classement + 1 indice par message." },
            quiz: {
              title: "Quiz — Anti-phishing",
              questions: [
                { order: 1, type: "single", prompt: "Un email urgent de votre « banque » demande votre code. Réflexe ?", options: ["Ne pas cliquer, vérifier via le site officiel", "Répondre vite pour débloquer", "Transférer à ses amis", "Cliquer pour vérifier"], correct: 0 },
                { order: 2, type: "true_false", prompt: "Un logo officiel garantit qu'un email est légitime.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Indices typiques de phishing ?", options: ["Urgence artificielle", "Fautes + expéditeur bizarre", "Demande d'infos sensibles", "Signature manuscrite scannée"], correct: [0, 1, 2] },
              ],
            },
          },
        ],
      },
      {
        number: 2,
        title: "Comprendre les attaques web",
        objective: "Savoir comment les failles communes fonctionnent pour mieux s'en prémunir.",
        sessions: [
          {
            number: 3,
            title: "Injection SQL et XSS",
            objective: "Comprendre les deux failles web les plus célèbres.",
            program:
              "Démo injection SQL sur environnement d'exercice · démo XSS stocké vs réfléchi · comment s'en protéger côté dev.",
            skills: ["sql-injection", "xss", "failles-web"],
            activities: [
              { order: 1, kind: "practice", title: "Exploiter un labo volontairement vulnérable", description: "Sur un environnement d'exercice local, reproduire une injection SQL basique." },
              { order: 2, kind: "resource", title: "OWASP Top 10", url: "https://owasp.org/Top10/" },
            ],
            deliverable: { type: "text", title: "Compte-rendu de labo", description: "Faille exploitée + parade recommandée, en 10 lignes." },
            quiz: {
              title: "Quiz — Failles web",
              questions: [
                { order: 1, type: "single", prompt: "Une injection SQL exploite…", options: ["Une requête construite avec des entrées non filtrées", "Un câble réseau débranché", "Un mot de passe trop court", "Un navigateur obsolète"], correct: 0 },
                { order: 2, type: "true_false", prompt: "Échapper/valider les entrées utilisateur protège des injections.", options: ["Vrai", "Faux"], correct: 0 },
                { order: 3, type: "multiple", prompt: "Bonnes défenses contre le XSS ?", options: ["Échapper le HTML affiché", "Content-Security-Policy", "Désactiver JavaScript partout", "Valider côté serveur"], correct: [0, 1, 3] },
              ],
            },
          },
          {
            number: 4,
            title: "Sécuriser son poste et son réseau",
            objective: "Durcir son environnement : mises à jour, Wi-Fi, sauvegardes.",
            program:
              "Mises à jour et antivirus · dangers du Wi-Fi public + VPN · règle 3-2-1 des sauvegardes · plan d'action personnel.",
            skills: ["durcissement", "wifi", "sauvegardes"],
            activities: [
              { order: 1, kind: "practice", title: "Checklist de durcissement", description: "Appliquer 5 mesures sur son propre poste et les cocher." },
            ],
            deliverable: { type: "text", title: "Plan d'action sécurité", description: "5 mesures appliquées + 2 à planifier." },
            quiz: {
              title: "Quiz — Bilan cybersécurité",
              questions: [
                { order: 1, type: "single", prompt: "La règle 3-2-1 des sauvegardes, c'est…", options: ["3 copies, 2 supports, 1 hors site", "3 mots de passe, 2 comptes, 1 clé", "3 antivirus, 2 pare-feu, 1 VPN", "3 jours, 2 semaines, 1 mois"], correct: 0 },
                { order: 2, type: "true_false", prompt: "Un Wi-Fi public sans mot de passe est sûr pour ses opérations bancaires.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Mesures de base sur son poste ?", options: ["Mises à jour automatiques", "Chiffrement du disque", "Partager son écran en public", "Verrouillage automatique"], correct: [0, 1, 3] },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    slug: "ai-prompt-engineering",
    title: "Ingénierie de prompts IA",
    description:
      "Obtenir des résultats fiables des modèles de langage : contexte, format, itération et limites.",
    domain: "ai",
    level: "autonomous",
    weeks: [
      {
        number: 1,
        title: "Prompter avec méthode",
        objective: "Structurer ses prompts pour des sorties exploitables.",
        sessions: [
          {
            number: 1,
            title: "Anatomie d'un bon prompt",
            objective: "Rôle, contexte, tâche, format : les 4 briques.",
            program:
              "Comment un LLM « comprend » · les 4 briques d'un prompt efficace · exercice : réécrire 3 prompts faibles.",
            skills: ["llm", "prompt", "contexte"],
            activities: [
              { order: 1, kind: "practice", title: "Réécrire 3 prompts", description: "Prendre 3 prompts faibles et les reconstruire avec les 4 briques." },
              { order: 2, kind: "resource", title: "Guide prompting OpenAI", url: "https://platform.openai.com/docs/guides/prompt-engineering" },
            ],
            deliverable: { type: "text", title: "Avant / après", description: "3 prompts avant + 3 versions améliorées." },
            quiz: {
              title: "Quiz — Bases du prompting",
              questions: [
                { order: 1, type: "single", prompt: "Que doit contenir un bon prompt ?", options: ["Rôle + contexte + tâche + format attendu", "Juste une question courte", "Le plus de mots possible", "Uniquement des emojis"], correct: 0 },
                { order: 2, type: "true_false", prompt: "Préciser le format de sortie améliore la qualité des réponses.", options: ["Vrai", "Faux"], correct: 0 },
                { order: 3, type: "multiple", prompt: "Bonnes pratiques de prompting ?", options: ["Donner des exemples", "Découper en étapes", "Tout demander en une fois", "Itérer sur le résultat"], correct: [0, 1, 3] },
              ],
            },
          },
          {
            number: 2,
            title: "Fiabilité : hallucinations et vérification",
            objective: "Ne jamais faire confiance aveuglément : vérifier, sourcer.",
            program:
              "Pourquoi les modèles inventent · techniques de vérification · demander des sources · exercice : piéger puis corriger.",
            skills: ["hallucinations", "verification", "sources"],
            activities: [
              { order: 1, kind: "practice", title: "Piéger puis corriger", description: "Obtenir une hallucination, puis reformuler pour obtenir une réponse sourcée." },
            ],
            deliverable: { type: "text", title: "Hallucination documentée", description: "Capture + explication + prompt corrigé." },
            quiz: {
              title: "Quiz — Fiabilité",
              questions: [
                { order: 1, type: "single", prompt: "Face à une affirmation douteuse d'un LLM, on…", options: ["Vérifie avec une source indépendante", "La publie telle quelle", "Régénère jusqu'à satisfaction", "Change de modèle"], correct: 0 },
                { order: 2, type: "true_false", prompt: "Un LLM cite toujours des sources réelles et vérifiables.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Réduire les hallucinations ?", options: ["Demander des sources", "Limiter le périmètre", "Augmenter la température", "Fournir le contexte exact"], correct: [0, 1, 3] },
              ],
            },
          },
        ],
      },
      {
        number: 2,
        title: "Cas d'usage avancés",
        objective: "Appliquer le prompting au code, aux données et à l'automatisation.",
        sessions: [
          {
            number: 3,
            title: "IA pour coder : assistant, pas pilote",
            objective: "Utiliser l'IA pour coder plus vite sans perdre le contrôle.",
            program:
              "Génération vs complétion · relire le code généré · tests et edge cases · exercice : fonction + tests.",
            skills: ["code-assiste", "tests", "relecture"],
            activities: [
              { order: 1, kind: "practice", title: "Fonction + tests via IA", description: "Faire générer une fonction + ses tests, puis les faire passer." },
              { order: 2, kind: "resource", title: "Bonnes pratiques code + IA", url: "https://github.blog/ai-and-ml/" },
            ],
            deliverable: { type: "github_repo", title: "Dépôt fonction + tests", description: "Lien du dépôt avec fonction générée et tests verts." },
            quiz: {
              title: "Quiz — IA et code",
              questions: [
                { order: 1, type: "single", prompt: "Règle d'or du code généré par IA ?", options: ["Toujours le relire et le tester", "Le pousser directement", "Ne jamais le modifier", "Le garder secret"], correct: 0 },
                { order: 2, type: "true_false", prompt: "L'IA écrit toujours du code sans faille de sécurité.", options: ["Vrai", "Faux"], correct: 1 },
                { order: 3, type: "multiple", prompt: "Bien utiliser l'IA pour coder ?", options: ["Décrire le besoin précisément", "Demander des tests", "Vérifier les edge cases", "Copier sans lire"], correct: [0, 1, 2] },
              ],
            },
          },
          {
            number: 4,
            title: "Projet final : assistant métier",
            objective: "Concevoir un mini-assistant IA utile à un cas réel.",
            program:
              "Choisir un cas d'usage · rédiger le prompt système · itérer et mesurer · démo collective.",
            skills: ["system-prompt", "cas-usage", "demo"],
            activities: [
              { order: 1, kind: "practice", title: "Construire son assistant", description: "Prompt système + 3 exemples d'utilisation réussis." },
            ],
            deliverable: { type: "project", title: "Assistant métier", description: "Prompt système + cas d'usage + limites connues." },
            quiz: {
              title: "Quiz — Bilan prompting",
              questions: [
                { order: 1, type: "single", prompt: "Le « prompt système » sert à…", options: ["Définir le rôle et les règles de l'assistant", "Choisir la couleur du chat", "Payer l'abonnement", "Traduire automatiquement"], correct: 0 },
                { order: 2, type: "true_false", prompt: "Un bon assistant IA précise aussi ce qu'il ne sait pas faire.", options: ["Vrai", "Faux"], correct: 0 },
                { order: 3, type: "multiple", prompt: "Évaluer son assistant ?", options: ["Tester des cas limites", "Mesurer la constance", "Compter les mots", "Recueillir des retours"], correct: [0, 1, 3] },
              ],
            },
          },
        ],
      },
    ],
  },
];

async function seedWorkshop(prisma: PrismaClient, w: WorkshopSeed): Promise<{ created: boolean; sessions: number }> {
  const existing = await prisma.workshop.findUnique({
    where: { slug: w.slug },
    select: { id: true },
  });

  if (existing && !FORCE) {
    const count = await prisma.workshopSession.count({
      where: { week: { workshopId: existing.id } },
    });
    console.info(`  = ${w.slug} (déjà présent, conservé)`);
    return { created: false, sessions: count };
  }

  if (existing && FORCE) {
    if (!DRY_RUN) {
      // Cascade : semaines → séances → activités/livrables/quiz/questions
      await prisma.workshopWeek.deleteMany({ where: { workshopId: existing.id } });
      await prisma.workshop.update({
        where: { id: existing.id },
        data: { title: w.title, description: w.description, domain: w.domain, level: w.level, status: "published" },
      });
    }
    console.info(`  ~ ${w.slug} (contenu recréé)`);
  } else {
    if (!DRY_RUN) {
      await prisma.workshop.create({
        data: { slug: w.slug, title: w.title, description: w.description, domain: w.domain, level: w.level, status: "published" },
      });
    }
    console.info(`  + ${w.slug} — ${w.title}`);
  }

  let sessionCount = 0;

  for (const week of w.weeks) {
    console.info(`    Semaine ${week.number} — ${week.title} (${week.sessions.length} séances)`);
    for (const s of week.sessions) {
      sessionCount++;
      console.info(`      S${s.number} — ${s.title} (${s.quiz.questions.length} questions, livrable ${s.deliverable.type})`);
      if (DRY_RUN) continue;

      const workshop = await prisma.workshop.findUniqueOrThrow({ where: { slug: w.slug }, select: { id: true } });
      const wk = await prisma.workshopWeek.upsert({
        where: { workshopId_number: { workshopId: workshop.id, number: week.number } },
        create: { workshopId: workshop.id, number: week.number, title: week.title, objective: week.objective ?? null },
        update: { title: week.title, objective: week.objective ?? null },
      });

      const session = await prisma.workshopSession.upsert({
        where: { weekId_number: { weekId: wk.id, number: s.number } },
        create: {
          weekId: wk.id,
          number: s.number,
          title: s.title,
          objective: s.objective,
          program: s.program,
          skills: JSON.stringify(s.skills),
          deliverableRequired: true,
          quizRequired: true,
        },
        update: {
          title: s.title,
          objective: s.objective,
          program: s.program,
          skills: JSON.stringify(s.skills),
        },
      });

      // Activités (recréées proprement : delete + create)
      await prisma.workshopActivity.deleteMany({ where: { sessionId: session.id } });
      for (const a of s.activities) {
        await prisma.workshopActivity.create({
          data: { sessionId: session.id, order: a.order, kind: a.kind, title: a.title, description: a.description ?? null, url: a.url ?? null },
        });
      }

      // Livrable (1 par séance)
      await prisma.workshopDeliverable.upsert({
        where: { sessionId: session.id },
        create: { sessionId: session.id, type: s.deliverable.type, title: s.deliverable.title, description: s.deliverable.description ?? null, isRequired: true },
        update: { type: s.deliverable.type, title: s.deliverable.title, description: s.deliverable.description ?? null },
      });

      // Quiz + questions (recréés proprement)
      await prisma.workshopQuiz.deleteMany({ where: { sessionId: session.id } });
      const quiz = await prisma.workshopQuiz.create({
        data: { sessionId: session.id, title: s.quiz.title, passThreshold: s.quiz.passThreshold ?? 70, isRequired: true },
      });
      for (const q of s.quiz.questions) {
        await prisma.workshopQuestion.create({
          data: {
            quizId: quiz.id,
            order: q.order,
            type: q.type,
            prompt: q.prompt,
            optionsJson: JSON.stringify(q.options),
            correctJson: JSON.stringify(q.correct),
            points: q.points ?? 1,
          },
        });
      }
    }
  }

  return { created: !existing, sessions: sessionCount };
}

async function main() {
  const prisma = new PrismaClient();

  console.info(
    `\nSeed ateliers démo — ${WORKSHOPS.length} ateliers` +
      `${DRY_RUN ? " (DRY RUN, aucune écriture)" : ""}${FORCE ? " (--force : contenu recréé)" : ""}\n`,
  );

  let created = 0;
  let totalSessions = 0;
  for (const w of WORKSHOPS) {
    const r = await seedWorkshop(prisma, w);
    if (r.created) created++;
    totalSessions += r.sessions;
  }

  await prisma.$disconnect();

  console.info(
    `\n${DRY_RUN ? "Aperçu" : "Seed"} terminé : ${created} atelier(s) créé(s), ` +
      `${totalSessions} séances au total (quiz + livrables inclus).`,
  );
}

main().catch((err) => {
  console.error("\nSEED ÉCHOUÉ :", err instanceof Error ? err.message : err);
  process.exit(1);
});
