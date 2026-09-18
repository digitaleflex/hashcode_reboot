"use client";

import * as React from "react";
import { RebootButton, CtaArrow } from "../shared";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Sticky mobile CTA — visible après le hero, thumb-zone friendly      */
/* ------------------------------------------------------------------ */

export function StickyMobileCta({ onJoin }: { onJoin: () => void }) {
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
