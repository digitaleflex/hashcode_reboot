"use client";

import * as React from "react";

/**
 * Pilote la progression d'un rail au scroll en écrivant la variable CSS
 * `--fill` (0 → 1) **directement sur l'élément**, via `requestAnimationFrame`.
 *
 * Aucun re-render React, aucun `getBoundingClientRect` exécuté au mauvais
 * moment (uniquement dans le rAF). Remplace l'ancien `useScroll`/`useSpring`
 * de framer-motion pour sortir la lib du bundle de la landing.
 *
 * Sous `prefers-reduced-motion`, le rail est rempli à 100 % sans écoute.
 */
export function useScrollFill<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--fill", "1");
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      if (!vh) return;
      const start = vh * 0.85;
      const end = vh * 0.5;
      const total = start - end + rect.height;
      const progress = total <= 0 ? 1 : (start - rect.top) / total;
      el.style.setProperty(
        "--fill",
        String(Math.min(1, Math.max(0, progress))),
      );
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [ref]);
}
