"use client";

import * as React from "react";
import { RebootButton, CtaArrow } from "../shared";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/* ------------------------------------------------------------------ */
/* Sticky mobile CTA — visible après le hero, thumb-zone friendly      */
/* ------------------------------------------------------------------ */

/**
 * Comportement d'origine strictement conservé :
 * - apparaît une fois le hero dépassé (60 % de la hauteur) ;
 * - disparaît quand #rejoindre entre dans le viewport, pour ne jamais
 *   doubler le CTA final.
 *
 * Deux corrections par rapport à la version précédente :
 * - `z-30` au lieu de `z-40` : à z-40, la barre passait *au-dessus* du header
 *   collant et entrait en collision avec lui.
 * - `inert` + `aria-hidden` quand masquée : la barre était hors écran mais
 *   restait atteignable au clavier (focus invisible) et annoncée aux lecteurs
 *   d'écran.
 */
export function StickyMobileCta({ onJoin }: { onJoin: (ref?: string) => void }) {
  const t = useTranslations("landing.stickyCta");
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 0.6;
      // Masque quand le CTA final est visible pour éviter le doublon.
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
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      // `inert` retire le sous-arbre de l'ordre de tabulation ET de
      // l'accessibility tree — exactement ce qu'il faut pour un éléments
      // simplement décalé hors écran.
      inert={!visible}
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur-md transition-transform duration-300 sm:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
          <span className="block font-display font-semibold">{t("title")}</span>
          <span className="block text-xs text-muted-foreground">{t("subtitle")}</span>
        </p>
        <RebootButton
          size="md"
          onClick={() => onJoin("sticky-mobile")}
          className="group shrink-0"
        >
          {t("cta")}
          <CtaArrow />
        </RebootButton>
      </div>
    </div>
  );
}