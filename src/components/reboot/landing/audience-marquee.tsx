"use client";

import { useTranslations } from "next-intl";

/**
 * Bandeau défilant « à qui ça s'adresse », juste sous le hero.
 *
 * Remplace le nuage de tags qui fermait la section Communauté : l'info
 * arrive plus tôt (le visiteur se reconnaît avant de lire la méthode).
 * La liste est doublée pour une boucle continue ; la copie est masquée
 * aux lecteurs d'écran. `.marquee__track` s'arrête si reduced-motion.
 */
export function AudienceMarquee() {
  const t = useTranslations("landing");
  const audiences = t.raw("community.audiences") as string[];

  const row = (hidden: boolean) => (
    <ul
      role="list"
      aria-hidden={hidden || undefined}
      className="marquee__track"
    >
      {audiences.map((a) => (
        <li
          key={a}
          className="inline-flex items-center gap-3 whitespace-nowrap rounded-full border border-[var(--line-soft)] bg-card/60 px-4 py-2 text-sm text-foreground/80"
        >
          <span className="size-1.5 rounded-full bg-lime/70" aria-hidden />
          {a}
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label={t("audienceMarqueeAria")}
      className="border-y border-[var(--line-soft)] bg-card/30 py-5"
    >
      <div className="marquee">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
