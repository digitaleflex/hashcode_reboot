"use client";

import * as React from "react";
import { ChevronDown, Code2, Shield, Sparkles, type LucideIcon } from "lucide-react";
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
  SectionHeader,
  Hairline,
  ExternalCta,
  Tag,
  RebootTitle,
} from "./shared";
import { WHATSAPP_URL } from "@/lib/profiling/auto-controls";
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
  { k: "LEARN", t: "Apprendre", d: "Les fondamentaux, clairs et solides." },
  { k: "BUILD", t: "Construire", d: "De vrais projets, pas des démos." },
  { k: "PRACTICE", t: "Pratiquer", d: "Des challenges pour progresser." },
  { k: "COLLABORATE", t: "Collaborer", d: "Progresser avec d'autres membres." },
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

const COMING = [
  { t: "Challenges", d: "Des problèmes concrets à résoudre, régulièrement." },
  { t: "Workshops", d: "Des sessions live pour apprendre ensemble." },
  { t: "Projects", d: "Construire en équipe sur des projets réels." },
  { t: "Mentoring", d: "De l'accompagnement pour celles et ceux qui en ont besoin." },
  { t: "HASHCODE Registry", d: "Le futur centre de gestion des profils et parcours." },
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
    a: "Oui. Le Reboot, le profil, et l'accès à la communauté WhatsApp sont gratuits. Si un jour HASHCODE propose un accompagnement personnalisé payant, ce sera optionnel et adapté à tes objectifs.",
  },
  {
    q: "Que se passe-t-il après mon inscription ?",
    a: "Si ton profil est compatible, tu reçois immédiatement l'accès à la communauté WhatsApp. Sinon, on te recontacte par email pour une invitation personnalisée. Dans tous les cas, ton profil est enregistré pour le futur Registry.",
  },
  {
    q: "Mes données sont protégées ?",
    a: "Oui. On collecte le minimum nécessaire, aucune revente, aucune publicité. Tu peux demander la suppression de tes données à tout moment. Voir la politique de confidentialité pour les détails.",
  },
] as const;

export function Landing({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: () => void;
  onOpenPrivacy?: () => void;
}) {
  return (
    <div className="bg-background min-h-screen flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size="sm" />
          <div className="hidden sm:flex items-center gap-6">
            <span className="mono-label text-muted-foreground">
              V1 · FR · Bénin
            </span>
            <RebootButton size="sm" onClick={onJoin} className="group">
              Rejoindre le Reboot
              <CtaArrow />
            </RebootButton>
          </div>
          <RebootButton
            size="sm"
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
        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 pt-20 sm:pt-28 pb-24 sm:pb-32">
          <MonoLabel className="text-lime">
            Profil Reboot · Édition 2026
          </MonoLabel>
          <RebootTitle className="mt-4 text-6xl leading-[0.9] sm:text-7xl lg:text-8xl" />
          <p className="mt-7 max-w-xl text-xl sm:text-2xl text-foreground font-display italic leading-snug">
            Une nouvelle génération de la communauté commence.
          </p>
          <p className="mt-3 max-w-xl text-muted-foreground text-base sm:text-lg leading-relaxed">
            Apprendre, construire, pratiquer et progresser ensemble dans le{" "}
            <span className="text-foreground">Web Development</span>, la{" "}
            <span className="text-foreground">Cybersecurity</span> et l&apos;
            <span className="text-foreground">Applied AI</span>.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <RebootButton size="lg" onClick={onJoin} className="group">
              Rejoindre le Reboot
              <CtaArrow />
            </RebootButton>
            <RebootButton
              size="lg"
              variant="outline"
              onClick={onJoin}
              className="hover:bg-lime hover:text-black hover:border-lime"
            >
              Découvrir HASHCODE
            </RebootButton>
          </div>

          {/* Tiny metadata row */}
          <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="mono-label">Construis ton profil</span>
            <span className="text-border">·</span>
            <span className="mono-label">~ 2 minutes</span>
            <span className="text-border">·</span>
            <span className="mono-label">100% par clic</span>
            <span className="text-border">·</span>
            <span className="mono-label">Accès à la communauté</span>
          </div>
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
          <span className="mono-label text-[9px]">Scroll</span>
          <ChevronDown className="size-4 animate-bounce-slow" />
        </button>
      </section>

      <div className="divider-grad" />

      {/* Why */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-20 sm:py-24">
        <ScrollReveal>
          <SectionHeader
            index="01 — Pourquoi HASHCODE revient"
            title="HASHCODE évolue."
            intro="Le contenu seul ne suffit plus. On veut un environnement où les membres peuvent apprendre, pratiquer, construire, collaborer et progresser — pour de vrai."
          />
        </ScrollReveal>
      </section>

      <div className="divider-grad" />

      {/* 3 Axes — index list, not 3 identical cards */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-20 sm:py-24">
        <SectionHeader
          index="02 — Les 3 axes"
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
                className="row-sweep bg-card p-6 sm:p-8 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto_1fr_auto] gap-x-6 gap-y-2 items-center hover:bg-elevated/60 transition-colors group"
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
                <button
                  onClick={onJoin}
                  className="col-span-2 sm:col-span-1 justify-self-start sm:justify-self-end text-sm text-muted-foreground hover:text-lime transition-colors inline-flex items-center gap-1 focus-lime"
              >
                Choisir
                <CtaArrow className="size-3.5" />
              </button>
            </div>
          );
          })}
        </div>
      </section>

      <div className="divider-grad" />

      {/* What changes — 4 pillars with hairline separators */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-20 sm:py-24">
        <SectionHeader
          index="03 — Ce qui change"
          title="Quatre verbes. Une direction."
          intro="On passe de la consommation à la construction."
          className="mb-10"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 border border-border/60 rounded-md overflow-hidden divide-x divide-border/60">
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
      </section>

      <div className="divider-grad" />

      {/* For who */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-20 sm:py-24">
        <SectionHeader
          index="04 — Pour qui ?"
          title="Pas besoin d'être expert."
          intro="HASHCODE est ouvert à toutes celles et ceux qui veulent progresser, du débutant à l'expert."
          className="mb-8"
        />
        <div className="flex flex-wrap gap-2">
          {AUDIENCE.map((a) => (
            <Tag key={a}>{a}</Tag>
          ))}
        </div>
      </section>

      <div className="divider-grad" />

      {/* Testimonial / vision quote */}
      <section className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-20 sm:py-24">
        <ScrollReveal>
        <div className="relative">
          {/* Large quote mark — engineered motif */}
          <span
            className="absolute -top-6 -left-2 text-lime/20 font-display text-7xl select-none pointer-events-none"
            aria-hidden
          >
            «
          </span>
          <blockquote className="relative z-10">
            <p className="font-display italic text-xl sm:text-2xl lg:text-3xl text-foreground leading-relaxed">
              On ne veut plus juste partager du contenu. On veut construire un
              environnement où les membres peuvent{" "}
              <span className="text-lime">apprendre</span>,{" "}
              <span className="text-lime">pratiquer</span>,{" "}
              <span className="text-lime">construire</span> et{" "}
              <span className="text-lime">progresser</span> — ensemble.
            </p>
            <footer className="mt-6 flex items-center gap-3">
              <span className="h-px w-8 bg-lime/60" aria-hidden />
              <div>
                <div className="font-display font-semibold text-sm text-foreground">
                  HASHCODE
                </div>
                <div className="mono-label text-muted-foreground">
                  Reboot · Édition 2026
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
        </ScrollReveal>
      </section>

      <div className="divider-grad" />

      {/* What's coming — timeline */}
      <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-20 sm:py-24">
        <SectionHeader
          index="05 — Ce qui arrive"
          title="Le Reboot, c'est maintenant."
          intro="Les premiers membres ouvrent la voie. Le Registry arrive ensuite."
          className="mb-10"
        />
        <ol className="relative grid gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
          {COMING.map((c, i) => (
            <li
              key={c.t}
              className="bg-card p-6 sm:p-7 grid grid-cols-[auto_1fr] gap-x-5 items-baseline"
            >
              <MonoLabel className={cn(i === 0 ? "text-lime" : "text-muted-foreground")}>
                {String(i + 1).padStart(2, "0")}
              </MonoLabel>
              <div>
                <h3 className="font-display font-semibold text-foreground">
                  {c.t}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">{c.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="divider-grad" />

      {/* FAQ — questions fréquentes */}
      <section className="mx-auto max-w-3xl w-full px-5 sm:px-8 py-20 sm:py-24">
        <SectionHeader
          index="06 — Questions fréquentes"
          title="Tu te demandes peut-être…"
          intro="Les réponses aux questions les plus courantes sur le Reboot."
          className="mb-8"
        />
        <FAQ />
      </section>

      <div className="divider-grad" />

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-vignette bg-noise">
        <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl w-full px-5 sm:px-8 py-24 sm:py-32 text-center">
          <div className="relative inline-flex items-center justify-center">
            <span
              className="absolute size-20 rounded-full opacity-20 animate-hash-pulse"
              style={{ background: "var(--primary)", filter: "blur(20px)" }}
              aria-hidden
            />
            <HashSymbol className="relative text-lime" size={48} />
          </div>
          <h2 className="mt-6 font-display font-bold text-3xl sm:text-4xl tracking-tight text-foreground">
            Prêt à repartir avec HASHCODE ?
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-muted-foreground text-base sm:text-lg">
            Quelques choix suffisent pour nous permettre de comprendre où tu
            veux aller.
          </p>
          <div className="mt-8 flex justify-center">
            <RebootButton size="lg" onClick={onJoin} className="group">
              Construire mon profil
              <CtaArrow />
            </RebootButton>
          </div>
          <p className="mt-6 text-xs text-muted-foreground mono-label">
            Environ 2 minutes · Tes réponses servent à mieux comprendre ton
            profil et à personnaliser ton expérience.
          </p>
        </div>
      </section>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-border/60 bg-background">
        {/* Social proof stats bar — with live member count */}
        <div className="border-b border-border/60 bg-card/30">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <SocialProofStat value="~2 min" label="Pour construire ton profil" />
            <SocialProofStat value="3" label="Axes : Web · Cyber · AI" />
            <SocialProofStat value="100%" label="Par clic, peu de friction" />
            <LiveMemberCount />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 grid gap-6 sm:grid-cols-3 items-start">
          <div className="space-y-3">
            <Logo variant="full" size="sm" />
            <p className="text-xs text-muted-foreground max-w-xs">
              La nouvelle génération de la communauté HASHCODE. Web Development,
              Cybersecurity, Applied AI.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-1">
            <MonoLabel>Liens</MonoLabel>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <button onClick={onJoin} className="hover:text-lime transition-colors focus-lime">
                  Rejoindre le Reboot
                </button>
              </li>
            </ul>
          </div>
          <div className="space-y-2 sm:text-right">
            <MonoLabel>Confidentialité</MonoLabel>
            <p className="text-xs text-muted-foreground max-w-xs sm:ml-auto">
              Tes réponses servent à mieux comprendre ton profil et à
              personnaliser ton expérience HASHCODE. Tu peux demander la
              suppression de tes données à tout moment.
            </p>
            <button
              onClick={onOpenPrivacy}
              className="text-xs text-lime hover:text-lime/80 transition-colors focus-lime inline-flex items-center gap-1"
            >
              Lire la politique complète →
            </button>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="mono-label text-muted-foreground">
              © 2026 HASHCODE · REBOOT
            </span>
            <span className="mono-label text-muted-foreground">
              v1.0 · Édition Bénin
            </span>
            <span className="mono-label text-muted-foreground">
              Engineered, not decorated.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ — accordion using shadcn/ui Accordion                           */
/* ------------------------------------------------------------------ */

function FAQ() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {FAQS.map((f, i) => (
        <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
          <AccordionTrigger className="text-left font-display font-medium text-base sm:text-lg text-foreground hover:text-lime transition-colors py-4 hover:no-underline">
            {f.q}
          </AccordionTrigger>
          <AccordionContent className="text-sm sm:text-base text-muted-foreground leading-relaxed pb-4">
            {f.a}
          </AccordionContent>
        </AccordionItem>
      ))}
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
      <span className="mono-label text-muted-foreground text-center leading-tight">
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
      .then((d) => setCount(d.count ?? null))
      .catch(() => setCount(null));
  }, []);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display font-bold text-2xl sm:text-3xl text-lime tabular-nums">
        {count !== null ? count : "✦"}
      </span>
      <span className="mono-label text-muted-foreground text-center leading-tight">
        Membres du Reboot
      </span>
    </div>
  );
}
