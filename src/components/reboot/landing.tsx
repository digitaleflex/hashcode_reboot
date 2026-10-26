"use client";

import { SiteHeader } from "./landing/site-header";
import { Hero } from "./landing/hero";
import { AudienceMarquee } from "./landing/audience-marquee";
import { Axes } from "./landing/axes";
import { Method } from "./landing/method";
import { Engine } from "./landing/engine";
import { Community } from "./landing/community";
import { Activity } from "./landing/activity";
import { Roadmap } from "./landing/roadmap";
import { FaqSection } from "./landing/faq-section";
import { FinalCta } from "./landing/final-cta";
import { SiteFooter } from "./landing/site-footer";
import { StickyMobileCta } from "./landing/sticky-cta";
import { SkipLink } from "./shared";
import { useTranslations } from "next-intl";

/**
 * Orchestrateur de la landing.
 *
 * Ordre narratif : on commence par situer le produit (hero), on explique ce
 * qui change (evolves), on montre les trois axes (axes), la méthode
 * (method), la mécanique réelle (engine), la communauté (community) et son
 * activité réelle (activity), puis la suite (roadmap), les questions (faq) et
 * l'appel à l'action.
 *
 * `onJoin` prend désormais un `ref` optionnel qui identifie le CTA
 * déclenché — les événements analytics gardent leurs noms d'origine.
 *
 * Refonte 2026-10 : `Evolves` (« HASHCODE évolue », discours interne) sort
 * du parcours — un nouveau visiteur a besoin de se reconnaître (bandeau
 * d'audiences) puis de voir les axes, pas de l'historique du projet.
 *
 * Sections retirées :
 * - `Testimonial` : témoignage fabriqué (« Aïcha · Étudiante »), remplacé par
 *   la carte de profil réelle et étiquetée en démonstration dans `Engine`.
 * - `Audience` : replacée dans `Community` (rubrique « À qui ça s'adresse »).
 * - `Pillars` / `Coming` : remplacées par `Method` / `Roadmap`.
 */
export function Landing({
  onJoin,
  onOpenPrivacy,
}: {
  onJoin: (ref?: string) => void;
  onOpenPrivacy?: () => void;
}) {
  const t = useTranslations("landing.a11y");

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      {/* Premier élément focusable : permet de sauter la nav vers <main>. */}
      <SkipLink targetId="contenu" label={t("skipToContent")} />
      <SiteHeader onJoin={onJoin} />

      {/* Le <main> était absent : aucune landmark de contenu sur la page. */}
      <main id="contenu" className="flex-1">
        <Hero onJoin={onJoin} />
        <AudienceMarquee />
        <Axes onJoin={onJoin} />
        <Method />
        <Engine onJoin={onJoin} />
        <Community onJoin={onJoin} />
        <Activity />
        <Roadmap />
        <FaqSection onJoin={onJoin} onOpenPrivacy={onOpenPrivacy} />
        <FinalCta onJoin={onJoin} />
      </main>

      <SiteFooter onJoin={onJoin} onOpenPrivacy={onOpenPrivacy} />
      <StickyMobileCta onJoin={onJoin} />
    </div>
  );
}