import {
  Code2,
  Shield,
  Sparkles,
  MousePointerClick,
  Compass,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

export const DOMAIN_ICONS: Record<string, LucideIcon> = {
  code: Code2,
  shield: Shield,
  sparkles: Sparkles,
};

export const AXES = [
  {
    id: "01",
    domain: "web",
    title: "Web Development",
    desc: "Créer des applications, produits et expériences numériques.",
    icon: "code",
  },
  {
    id: "02",
    domain: "cybersecurity",
    title: "Cybersecurity",
    desc: "Comprendre, protéger, analyser et expérimenter.",
    icon: "shield",
  },
  {
    id: "03",
    domain: "ai",
    title: "Applied AI",
    desc: "Construire avec l'IA, l'automatisation et les agents.",
    icon: "sparkles",
  },
] as const;

export const PILLARS = [
  { k: "01", t: "Apprendre", d: "Les fondamentaux, clairs et solides." },
  { k: "02", t: "Construire", d: "De vrais projets, pas des démos." },
  { k: "03", t: "Pratiquer", d: "Des challenges pour progresser." },
  { k: "04", t: "Collaborer", d: "Progresser avec d'autres membres." },
] as const;

export const AUDIENCE = [
  "Débutants",
  "Étudiant·es",
  "Développeur·euses",
  "Professionnel·les",
  "Entrepreneur·es",
  "Passionné·es de cyber",
  "Curieux d'IA",
  "Autodidactes",
] as const;

export const STEPS = [
  {
    n: "01",
    title: "Réponds par clic",
    desc: "Quelques questions simples, environ 2 minutes, sans rédiger.",
    icon: MousePointerClick,
  },
  {
    n: "02",
    title: "Reçois ton axe",
    desc: "Web, Cyber ou IA — selon ton niveau et ton objectif.",
    icon: Compass,
  },
  {
    n: "03",
    title: "Rejoins WhatsApp",
    desc: "Accès immédiat si compatible. Sinon email, zéro spam.",
    icon: MessageCircle,
  },
] as const;

export const COMING = [
  {
    t: "Challenges",
    d: "Des problèmes concrets à résoudre, régulièrement. Le premier dès cette semaine.",
    status: "Maintenant",
    live: true,
  },
  {
    t: "Workshops",
    d: "Des sessions live pour apprendre ensemble.",
    status: "Bientôt",
    live: false,
  },
  {
    t: "Projects",
    d: "Construire en équipe sur des projets réels.",
    status: "Bientôt",
    live: false,
  },
  {
    t: "Mentoring",
    d: "De l'accompagnement pour celles et ceux qui en ont besoin.",
    status: "Ensuite",
    live: false,
  },
  {
    t: "HASHCODE Registry",
    d: "Le futur centre de gestion des profils et parcours.",
    status: "Ensuite",
    live: false,
  },
] as const;

export const FAQS = [
  {
    q: "C'est quoi le Reboot exactement ?",
    a: "Le Reboot est le nouveau point d'entrée de la communauté HASHCODE. Tu construis ton profil en 2 minutes, tu reçois une première orientation, et tu rejoins la communauté officielle. C'est la première étape du nouveau HASHCODE.",
  },
  {
    q: "Combien de temps ça prend ?",
    a: "Environ 2 minutes. La majorité des réponses se font par clic. On ne te demande que ce qui est nécessaire pour comprendre ton profil — rien de superflu.",
  },
  {
    q: "Faut-il être expert pour rejoindre ?",
    a: "Non. HASHCODE est ouvert aux débutants, aux étudiants, aux développeurs, aux professionnels, aux entrepreneurs et aux autodidactes. On part de là où tu es vraiment.",
  },
  {
    q: "C'est gratuit ?",
    a: "Oui. Le Reboot est gratuit : profil + accès communauté. Si un jour une option payante existe, ce sera optionnel et annoncé clairement. Rien n'est prélevé, rien n'est caché.",
  },
  {
    q: "Que se passe-t-il après mon inscription ?",
    a: "Tu réponds par clic (~2 min), tu reçois ton axe proposé, puis ton accès WhatsApp si ton profil est compatible. Sinon, on te recontacte par email pour une invitation personnalisée. Zéro spam, suppression en 1 message.",
  },
  {
    q: "Mes données sont protégées ?",
    a: "Oui. On collecte le minimum nécessaire, aucune revente, aucune publicité. Tu peux demander la suppression de tes données à tout moment.",
  },
] as const;
