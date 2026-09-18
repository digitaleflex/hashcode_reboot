"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonoLabel, SectionHeader } from "../shared";
import { cn } from "@/lib/utils";
import { PILLARS } from "./data";

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

export function Pillars() {
  return (
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
  );
}
