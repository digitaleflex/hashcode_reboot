"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Shield,
  Sparkles,
  Check,
  MousePointerClick,
  Compass,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Logo, HashSymbol } from "@/components/brand/logo";
import {
  RebootButton,
  CtaArrow,
  MonoLabel,
  Eyebrow,
  SectionHeader,
  Tag,
  RebootTitle,
} from "./shared";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  code: Code2,
  shield: Shield,
  sparkles: Sparkles,
};

const AXES = [
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

const PILLARS = [
  { k: "01", t: "Apprendre", d: "Les fondamentaux, clairs et solides." },
  { k: "02", t: "Construire", d: "De vrais projets, pas des démos." },
  { k: "03", t: "Pratiquer", d: "Des challenges pour progresser." },
  { k: "04", t: "Collaborer", d: "Progresser avec d'autres membres." },
] as const;

const AUDIENCE = [
  "Débutants",
  "Étudiant·es",
  "Développeur·euses",
  "Professionnel·les",
  "Entrepreneur·es",
  "Passionné·es de cyber",
  "Curieux d'IA",
  "Autodidactes",
] as const;

const STEPS = [
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

const COMING = [
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

const FAQS = [
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

export function Landing({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: () => void;
  onOpenPrivacy?: () => void;
}) {
  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="bg-background min-h-screen flex flex-col pb-[76px] sm:pb-0">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-3">
          <Logo variant="full" size="sm" />
          <nav
            className="hidden md:flex items-center gap-5 text-sm text-muted-foreground"
            aria-label="Navigation"
          >
            <button
              onClick={() => scrollToId("axes")}
              className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
            >
              Axes
            </button>
            <button
              onClick={() => scrollToId("faq")}
              className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
            >
              FAQ
            </button>
            <span className="text-[13px] text-muted-foreground" aria-hidden>
              Reboot · Édition 2026
            </span>
            <RebootButton size="md" onClick={onJoin} className="group">
              Construire mon profil
              <CtaArrow />
            </RebootButton>
          </nav>
          <div className="hidden sm:flex md:hidden items-center gap-6">
            <span className="text-[13px] text-muted-foreground">
              Reboot · 2026
            </span>
            <RebootButton size="md" onClick={onJoin} className="group">
              Construire mon profil
              <CtaArrow />
            </RebootButton>
          </div>
          <RebootButton
            size="md"
            variant="outline"
            onClick={onJoin}
            className="sm:hidden"
          >
            Rejoindre
          </RebootButton>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-vignette bg-noise">
        <div className="absolute inset-0 bg-grid opacity-70" aria-hidden />
        {/* Lime aura in upper-left for depth (subtle, never gradient-y) */}
        <div
          className="absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl opacity-[0.06] hidden sm:block"
          style={{ background: "var(--primary)" }}
          aria-hidden
        />
        {/* Faint large H in corner — engineered motif, not decoration (desktop only) */}
        <HashSymbol
          className="absolute -right-16 -bottom-16 text-border/40 select-none pointer-events-none hidden sm:block"
          size={360}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 pt-14 sm:pt-28 pb-14 sm:pb-32">
          <Eyebrow>Bienvenue dans le Reboot — où que tu sois</Eyebrow>
          <RebootTitle className="mt-4" />
          <h2 className="mt-7 max-w-xl text-2xl sm:text-3xl text-foreground font-display font-bold leading-tight text-balance">
            Rejoins la nouvelle communauté dev, cyber &amp; IA.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground text-base sm:text-lg leading-relaxed">
            Où que tu sois. Crée ton profil en 2 min, reçois ton accès
            WhatsApp et commence avec ton premier challenge cette semaine.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <RebootButton size="lg" onClick={onJoin} className="group w-full sm:w-auto">
              Construire mon profil
              <CtaArrow />
            </RebootButton>
            <RebootButton
              size="lg"
              variant="outline"
              onClick={() => scrollToId("axes")}
              className="w-full sm:w-auto"
            >
              Découvrir les axes
            </RebootButton>
          </div>

          {/* Micro-réassurance lisible */}
          <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-foreground leading-relaxed">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-lime/10 border border-lime/40">
              <Check className="size-3.5 text-lime" strokeWidth={2.5} />
            </span>
            Environ 2 min · Gratuit · Sans engagement
          </p>

          {/* 3 étapes visuelles */}
          <ol className="mt-8 grid gap-2 sm:grid-cols-3 sm:gap-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.n}
                  className="flex items-start gap-3 rounded-md border border-border/60 bg-card/70 p-4 backdrop-blur-[2px]"
                >
                  <span className="shrink-0 size-10 rounded-md border border-lime/40 bg-lime/5 flex items-center justify-center text-lime">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-[12px] font-medium tracking-[0.06em] text-lime">Étape {s.n}</span>
                    <span className="block mt-1 font-display font-semibold text-[15px] text-foreground leading-snug">
                      {s.title}
                    </span>
                    <span className="block mt-0.5 text-sm text-muted-foreground leading-snug">
                      {s.desc}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">
            Sinon email, zéro spam, suppression en 1 message.
          </p>
        </div>

        {/* Scroll indicator — subtle animated chevron, desktop only */}
        <button
          onClick={() =>
            window.scrollTo({
              top: window.innerHeight * 0.85,
              behavior: "smooth",
            })
          }
          className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-1.5 text-muted-foreground hover:text-lime transition-colors focus-lime group"
          aria-label="Faire défiler"
        >
          <span className="text-[12px] tracking-[0.06em]">Défiler</span>
          <ChevronDown className="size-4 animate-bounce-slow" />
        </button>
      </section>

      <div className="divider-grad" />

      {/* Why */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-12 sm:py-24 cv-auto">
        <ScrollReveal>
          <SectionHeader
            index="01 · Pourquoi on revient"
            title="HASHCODE évolue."
            intro="Le contenu seul ne suffit plus. On veut un environnement où les membres peuvent apprendre, pratiquer, construire, collaborer et progresser — pour de vrai."
          />
        </ScrollReveal>
      </section>

      <div className="divider-grad" />

      {/* 3 Axes — index list, not 3 identical cards */}
      <section
        id="axes"
        className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 scroll-mt-20 cv-auto"
      >
        <SectionHeader
          index="02 · Les trois axes"
          title="Trois terrains. Une communauté."
          intro="Choisis ton terrain. Tu pourras en croiser d'autres plus tard."
          className="mb-10"
        />
        <div className="grid gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          {AXES.map((a) => {
            const Icon = DOMAIN_ICONS[a.icon];
            return (
              <div
                key={a.id}
                className="row-sweep bg-card p-6 sm:p-8 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto_1fr_auto] gap-x-6 gap-y-4 items-center hover:bg-elevated/60 transition-colors group"
              >
                <MonoLabel className="text-lime">{a.id}</MonoLabel>
                {Icon && (
                  <span className="size-9 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground group-hover:text-lime group-hover:border-lime/40 transition-colors">
                    <Icon className="size-4" />
                  </span>
                )}
                <div>
                  <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-lime transition-colors">
                    {a.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">{a.desc}</p>
                </div>
                <RebootButton
                  size="md"
                  variant="outline"
                  onClick={onJoin}
                  className="col-span-2 sm:col-span-1 w-full sm:w-auto justify-self-stretch sm:justify-self-end"
                >
                  Construire mon profil
                  <CtaArrow className="size-3.5" />
                </RebootButton>
              </div>
            );
          })}
        </div>
        {/* Rappel mobile après les axes */}
        <div className="mt-6 sm:hidden">
          <RebootButton size="lg" onClick={onJoin} className="group w-full">
            Rejoindre la communauté
            <CtaArrow />
          </RebootButton>
        </div>
      </section>

      <div className="divider-grad" />

      {/* What changes — carrousel mobile, grille desktop */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
        <SectionHeader
          index="03 · Ce qui change vraiment"
          title="Quatre verbes. Une direction."
          intro="On passe de la consommation à la construction."
          className="mb-8 sm:mb-10"
        />
        {/* Desktop : grille 2→4 col existante, inchangée */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 border border-border/60 rounded-md overflow-hidden divide-x divide-border/60">
          {PILLARS.map((p) => (
            <div
              key={p.k}
              className="bg-card p-6 sm:p-7 flex flex-col gap-2 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(2)]:border-b-0"
            >
              <MonoLabel className="text-lime">{p.k}</MonoLabel>
              <h3 className="font-display font-semibold text-lg text-foreground mt-1">
                {p.t}
              </h3>
              <p className="text-muted-foreground text-sm">{p.d}</p>
            </div>
          ))}
        </div>
        {/* Mobile : carrousel horizontal fluide */}
        <PillarsCarousel />
      </section>

      <div className="divider-grad" />

      {/* For who */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
        <SectionHeader
          index="04 · Pour qui c'est fait"
          title="Pas besoin d'être expert."
          intro="Si tu es curieux et motivé, tu as ta place. Touche un profil pour commencer."
          className="mb-8"
        />
        <div className="flex flex-wrap gap-2">
          {AUDIENCE.map((a) => (
            <Tag key={a} onClick={onJoin}>
              {a}
            </Tag>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Débutant ou avancé — on part de là où tu es vraiment.
        </p>
      </section>

      <div className="divider-grad" />

      {/* Témoignage membre — preuve humaine */}
      <section className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
        <ScrollReveal>
        <div className="relative rounded-md border border-border/60 bg-card/60 p-6 sm:p-8">
          {/* Large quote mark — engineered motif */}
          <span
            className="absolute -top-6 -left-2 text-lime/20 font-display text-7xl select-none pointer-events-none"
            aria-hidden
          >
            «
          </span>
          <blockquote className="relative z-10">
            <p className="font-display text-xl sm:text-2xl text-foreground leading-relaxed text-balance">
              Je suis arrivé curieux, reparti avec un plan clair et mon premier
              challenge à faire cette semaine. On sait enfin où aller.
            </p>
            <footer className="mt-6 flex items-center gap-3">
              <span
                className="shrink-0 size-11 rounded-full border border-lime/50 bg-lime/10 flex items-center justify-center font-display font-bold text-lime"
                aria-hidden
              >
                A
              </span>
              <div>
                <div className="font-display font-semibold text-sm text-foreground">
                  Aïcha · Étudiante
                </div>
                <div className="soft-note">
                  Débutante web · Première cohorte 2026
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
        </ScrollReveal>
      </section>

      <div className="divider-grad" />

      {/* What's coming — timeline avec statuts */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
        <SectionHeader
          index="05 · La suite, concrètement"
          title="Le Reboot, c'est maintenant."
          intro="Les premiers membres ouvrent la voie. Voici l'ordre réel."
          className="mb-10"
        />
        <ol className="relative grid gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          {COMING.map((c, i) => (
            <li
              key={c.t}
              className="bg-card p-6 sm:p-7 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 items-start"
            >
              <MonoLabel className={cn(c.live ? "text-lime" : "text-muted-foreground")}>
                {String(i + 1).padStart(2, "0")}
              </MonoLabel>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-semibold text-foreground">
                    {c.t}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium tracking-[0.01em] leading-none",
                      c.live
                        ? "border-lime/60 text-lime bg-lime/10"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {c.live && (
                      <span className="mr-1.5 size-1.5 rounded-full bg-lime animate-hash-pulse" aria-hidden />
                    )}
                    {c.status}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{c.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="divider-grad" />

      {/* FAQ — questions fréquentes */}
      <section
        id="faq"
        className="mx-auto max-w-3xl w-full px-5 sm:px-8 py-16 sm:py-24 scroll-mt-20 cv-auto"
      >
        <SectionHeader
          index="06 · Tes questions"
          title="Tu te demandes peut-être…"
          intro="Les réponses aux questions les plus courantes sur le Reboot."
          className="mb-8"
        />
        <FAQ onOpenPrivacy={onOpenPrivacy} />
        <div className="mt-8 flex justify-center">
          <RebootButton size="lg" onClick={onJoin} className="group w-full sm:w-auto">
            Construire mon profil
            <CtaArrow />
          </RebootButton>
        </div>
      </section>

      <div className="divider-grad" />

      {/* Final CTA */}
      <section id="rejoindre" className="relative overflow-hidden bg-vignette bg-noise scroll-mt-20">
        <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl w-full px-5 sm:px-8 py-20 sm:py-32 text-center">
          <div className="relative inline-flex items-center justify-center">
            <span
              className="absolute size-20 rounded-full opacity-20 animate-hash-pulse"
              style={{ background: "var(--primary)", filter: "blur(20px)" }}
              aria-hidden
            />
            <HashSymbol className="relative text-lime" size={48} />
          </div>
          <h2 className="mt-6 font-display font-bold text-3xl sm:text-4xl tracking-tight text-foreground text-balance">
            Prêt à rejoindre la communauté ?
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-muted-foreground text-base sm:text-lg">
            Crée ton profil en 2 min et reçois ton accès WhatsApp.
          </p>
          <div className="mt-8 flex justify-center">
            <RebootButton size="lg" onClick={onJoin} className="group w-full sm:w-auto">
              Construire mon profil
              <CtaArrow />
            </RebootButton>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-foreground">
            <Check className="size-4 text-lime shrink-0" strokeWidth={2.5} />
            Gratuit · Environ 2 minutes · Zéro spam
          </p>
        </div>
      </section>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-border/60 bg-background">
        {/* Social proof stats bar — modeste et crédible */}
        <div className="border-b border-border/60 bg-card/30">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <SocialProofStat value="2026" label="Première cohorte ouverte" />
            <SocialProofStat value="3" label="Axes : web, cyber, IA" />
            <SocialProofStat value="~2 min" label="Profil par clic, sans friction" />
            <LiveMemberCount />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 grid gap-6 sm:grid-cols-3 items-start">
          <div className="space-y-3">
            <Logo variant="full" size="sm" />
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              La nouvelle communauté dev, cyber &amp; IA. Ton premier
              challenge t’attend cette semaine, où que tu sois.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-1">
            <p className="text-sm font-semibold text-foreground">Liens</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <button
                  onClick={onJoin}
                  className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
                >
                  Construire mon profil
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToId("axes")}
                  className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
                >
                  Voir les 3 axes
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToId("faq")}
                  className="min-h-[44px] inline-flex items-center hover:text-lime transition-colors focus-lime"
                >
                  Questions fréquentes
                </button>
              </li>
            </ul>
          </div>
          <div className="space-y-2 sm:text-right">
            <p className="text-sm font-semibold text-foreground sm:text-right">Confidentialité</p>
            <p className="text-sm text-muted-foreground max-w-xs sm:ml-auto leading-relaxed">
              Minimum nécessaire, zéro revente, zéro pub. Suppression en
              1 message, à tout moment.
            </p>
            <button
              onClick={onOpenPrivacy}
              className="min-h-[44px] text-sm text-lime hover:text-lime/80 transition-colors focus-lime inline-flex items-center gap-1 sm:justify-end"
            >
              Lire la politique complète →
            </button>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
              © 2026 Hashcode · Reboot
            </span>
            <span className="text-[12px] tracking-[0.06em] text-muted-foreground">
              Née au Bénin · Ouverte à toutes et tous
            </span>
          </div>
        </div>
      </footer>
      <StickyMobileCta onJoin={onJoin} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pillars — carrousel mobile uniquement (desktop = grille)            */
/* Swipe natif + snap, sans auto-play, clavier + lecteurs d'écran FR   */
/* ------------------------------------------------------------------ */

function PillarsCarousel() {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const total = PILLARS.length;

  const prefersReduced = React.useCallback(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const stepWidth = React.useCallback(() => {
    const track = trackRef.current;
    if (!track || !track.children[0]) return track?.clientWidth ?? 300;
    const first = track.children[0] as HTMLElement;
    // largeur carte + gap (gap-3 = 12px)
    return first.offsetWidth + 12;
  }, []);

  const updateFromScroll = React.useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const w = stepWidth();
    const i = Math.round(track.scrollLeft / w);
    setIndex(Math.max(0, Math.min(total - 1, i)));
  }, [stepWidth, total]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateFromScroll();
        ticking = false;
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [updateFromScroll]);

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(total - 1, i));
    track.scrollTo({
      left: next * stepWidth(),
      behavior: prefersReduced() ? "auto" : "smooth",
    });
    setIndex(next);
  }

  function onTrackKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(total - 1);
    }
  }

  return (
    <div
      className="sm:hidden"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Ce qui change : quatre verbes, une direction"
    >
      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label="Faites défiler horizontalement pour voir les quatre verbes. Flèches gauche et droite disponibles."
        onScroll={updateFromScroll}
        onKeyDown={onTrackKeyDown}
        className="carousel-track no-scrollbar focus-lime -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 pt-1 rounded-md"
      >
        {PILLARS.map((p, i) => (
          <article
            key={p.k}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${total} : ${p.t}`}
            aria-current={i === index}
            className="w-[85%] shrink-0 snap-start rounded-md border border-border/60 bg-card p-6 flex flex-col gap-2"
          >
            <MonoLabel className="text-lime">{p.k}</MonoLabel>
            <h3 className="font-display font-semibold text-lg text-foreground mt-1">
              {p.t}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{p.d}</p>
          </article>
        ))}
      </div>

      {/* Contrôles : prev/next 44px + compteur + dots */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Voir le verbe précédent"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-lime/60 hover:text-lime focus-lime disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === total - 1}
            aria-label="Voir le verbe suivant"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:border-lime/60 hover:text-lime focus-lime disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {index + 1} / {total}
        </p>

        <div className="flex items-center" role="tablist" aria-label="Choisir un verbe">
          {PILLARS.map((p, i) => (
            <button
              key={p.k}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Aller au verbe ${i + 1} : ${p.t}`}
              onClick={() => goTo(i)}
              className="inline-flex min-h-[44px] min-w-[36px] items-center justify-center px-2 focus-lime rounded-md"
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-lime" : "w-1.5 bg-border hover:bg-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Barre de progression fine */}
      <div
        className="mt-3 h-px w-full bg-border/60 overflow-hidden rounded-full"
        aria-hidden
      >
        <div
          className="h-full bg-lime/70 transition-[width] motion-reduce:transition-none"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ — accordion using shadcn/ui Accordion                           */
/* ------------------------------------------------------------------ */

function FAQ({ onOpenPrivacy }: { onOpenPrivacy?: () => void }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {FAQS.map((f, i) => {
        const isPrivacy = f.q.includes("protégées");
        return (
          <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
            <AccordionTrigger className="min-h-[56px] text-left font-display font-medium text-base sm:text-lg text-foreground hover:text-lime transition-colors py-4 hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm sm:text-base text-muted-foreground leading-relaxed pb-4">
              {f.a}
              {isPrivacy && onOpenPrivacy && (
                <>
                  {" "}
                  <button
                    onClick={onOpenPrivacy}
                    className="min-h-[44px] px-1 -mx-1 inline-flex items-center text-lime hover:text-lime/80 underline underline-offset-4 focus-lime"
                  >
                    Voir la politique de confidentialité
                  </button>
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

/* ------------------------------------------------------------------ */
/* Social proof stat — footer stats bar                                */
/* ------------------------------------------------------------------ */

function SocialProofStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display font-bold text-2xl sm:text-3xl text-lime tabular-nums">
        {value}
      </span>
      <span className="soft-note text-center">
        {label}
      </span>
    </div>
  );
}

/** Live member count — fetches the public count from /api/community/count. */
function LiveMemberCount() {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    fetch("/api/community/count", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setCount(typeof d.count === "number" && d.count > 0 ? d.count : null),
      )
      .catch(() => setCount(null));
  }, []);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display font-bold text-2xl sm:text-3xl text-lime tabular-nums">
        {count !== null ? `${count}` : "1ère"}
      </span>
      <span className="soft-note text-center">
        {count !== null ? "Profils déjà créés" : "Cohorte en cours"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky mobile CTA — visible après le hero, thumb-zone friendly      */
/* ------------------------------------------------------------------ */

function StickyMobileCta({ onJoin }: { onJoin: () => void }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 0.6;
      // Masque quand le CTA final est visible pour éviter le doublon
      const final = document.getElementById("rejoindre");
      let finalVisible = false;
      if (final) {
        const r = final.getBoundingClientRect();
        finalVisible = r.top < window.innerHeight && r.bottom > 0;
      }
      setVisible(past && !finalVisible);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <p className="flex-1 min-w-0 text-sm text-foreground leading-snug">
          <span className="block font-display font-semibold">2 min · Gratuit</span>
          <span className="block text-xs text-muted-foreground">Ton challenge cette semaine</span>
        </p>
        <RebootButton size="md" onClick={onJoin} className="group shrink-0">
          Construire mon profil
          <CtaArrow />
        </RebootButton>
      </div>
    </div>
  );
}
