"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   HASHCODE REBOOT — Motion primitives (sans framer-motion)

   Un seul langage de motion pour toute l'interface, implémenté en
   CSS + IntersectionObserver. Objectif : sortir framer-motion du bundle
   initial de la landing (poids + TBT) tout en gardant le même rendu.

   Règles :
   - `transform` / `opacity` uniquement (compositor-friendly).
   - Le contenu est VISIBLE dans le HTML SSR (aucun `opacity:0` rendu
     côté serveur) : les révélations ne sont « armées » qu'après montage,
     et uniquement pour les éléments hors viewport. Sans JS → tout visible.
   - `prefers-reduced-motion` géré à la fois en CSS (cf. globals.css) et
     en JS (on n'arme aucune révélation).
   ============================================================ */

/** Courbe maison — identique à celle utilisée dans globals.css. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Viewport = { once?: boolean; amount?: number };

/**
 * Balises cibles (animer un `<li>` avec un `<div>` intermédiaire casserait
 * la sémantique de `<ol>` / `<ul>`).
 */
export type MotionTag =
  | "div"
  | "li"
  | "span"
  | "p"
  | "ul"
  | "ol"
  | "section"
  | "article"
  | "figure"
  | "header";

/** Props HTML additionnelles acceptées par les primitives (`role`, `aria-*`…). */
type RestProps = Omit<React.ComponentPropsWithoutRef<"div">, "children">;

const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/* ------------------------------------------------------------------ */
/* Hook interne : état de révélation                                   */
/* ------------------------------------------------------------------ */

type RevealState = "idle" | "hidden" | "shown";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Renvoie l'état de révélation d'un élément.
 *
 * `idle` = non armé (visible, état SSR par défaut) ; `hidden` = caché en
 * attente d'entrée ; `shown` = révélé. Un élément déjà dans le viewport au
 * montage reste `shown` (jamais masqué) : c'est ce qui évite tout flash et
 * garantit qu'un élément above-the-fold est peint immédiatement.
 */
function useRevealState(
  ref: React.RefObject<HTMLElement | null>,
  {
    amount = 0.25,
    once = true,
    disabled = false,
  }: { amount?: number; once?: boolean; disabled?: boolean } = {},
): RevealState {
  const [state, setState] = React.useState<RevealState>(
    disabled ? "shown" : "idle",
  );

  React.useEffect(() => {
    if (disabled) {
      setState("shown");
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setState("shown");
      return;
    }

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const inView = rect.top < vh && rect.bottom > 0;
    if (inView) {
      setState("shown");
      return;
    }

    setState("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          if (once) io.disconnect();
        } else if (!once) {
          setState("hidden");
        }
      },
      { threshold: Math.min(1, Math.max(0, amount)) },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, amount, once, disabled]);

  return state;
}

/** Rendu générique d'une « boîte » révélée, avec variables CSS. */
function RevealBox({
  as = "div",
  delay = 0,
  duration = 0.5,
  x = 0,
  y = 0,
  scale = 1,
  initial = true,
  amount = 0.25,
  once = true,
  className,
  style,
  children,
  ...rest
}: {
  as?: MotionTag;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  scale?: number;
  initial?: boolean;
  amount?: number;
  once?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & RestProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const state = useRevealState(ref, { amount, once, disabled: !initial });
  const Comp = as as React.ElementType;

  const vars = {
    "--reveal-delay": `${delay}s`,
    "--reveal-duration": `${duration}s`,
    "--reveal-x": `${x}px`,
    "--reveal-y": `${y}px`,
    "--reveal-scale": `${scale}`,
    "--reveal-ease": EASING,
  } as React.CSSProperties;

  return (
    <Comp
      ref={ref}
      className={className}
      style={{ ...vars, ...style }}
      data-reveal={state === "idle" ? undefined : state}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal — entrée générique au scroll                                 */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  y = 16,
  duration = 0.5,
  viewport,
  initial = true,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: MotionTag;
  delay?: number;
  y?: number;
  duration?: number;
  viewport?: Viewport;
  /**
   * `false` : ne jamais masquer (contenu above-the-fold). Conservé pour
   * compatibilité d'API ; le nouveau modèle laisse déjà visible tout élément
   * présent dans le viewport au montage.
   */
  initial?: boolean;
} & RestProps) {
  const { once = true, amount = 0.25 } = viewport ?? {};
  return (
    <RevealBox
      as={as}
      delay={delay}
      duration={duration}
      y={y}
      initial={initial}
      once={once}
      amount={amount}
      className={className}
      {...rest}
    >
      {children}
    </RevealBox>
  );
}

/* ------------------------------------------------------------------ */
/* Stagger + StaggerItem                                               */
/* ------------------------------------------------------------------ */

export function Stagger({
  children,
  className,
  as = "div",
  stagger = 0.07,
  delayChildren = 0,
  viewport,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: MotionTag;
  stagger?: number;
  delayChildren?: number;
  viewport?: Viewport;
} & RestProps) {
  void viewport;
  const Comp = as as React.ElementType;
  return (
    <Comp
      className={className}
      style={
        {
          "--stagger-step": `${stagger}s`,
          "--stagger-delay": `${delayChildren}s`,
        } as React.CSSProperties
      }
      data-stagger
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
  y = 14,
  duration = 0.5,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: MotionTag;
  y?: number;
  duration?: number;
} & RestProps) {
  return (
    <RevealBox as={as} y={y} duration={duration} className={className} {...rest}>
      {children}
    </RevealBox>
  );
}

/* ------------------------------------------------------------------ */
/* Fade / Slide / Scale                                                */
/* ------------------------------------------------------------------ */

export function Fade({
  children,
  className,
  delay = 0,
  duration = 0.45,
  viewport,
  initial = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  viewport?: Viewport;
  initial?: boolean;
}) {
  const { once = true, amount = 0.25 } = viewport ?? {};
  return (
    <RevealBox
      delay={delay}
      duration={duration}
      initial={initial}
      once={once}
      amount={amount}
      className={className}
    >
      {children}
    </RevealBox>
  );
}

export function Slide({
  children,
  className,
  from = "up",
  distance = 22,
  delay = 0,
  duration = 0.55,
  viewport,
  initial = true,
}: {
  children: React.ReactNode;
  className?: string;
  from?: "up" | "down" | "left" | "right";
  distance?: number;
  delay?: number;
  duration?: number;
  viewport?: Viewport;
  initial?: boolean;
}) {
  const { once = true, amount = 0.25 } = viewport ?? {};
  const offset: Record<typeof from, { x: number; y: number }> = {
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  };
  const { x, y } = offset[from];
  return (
    <RevealBox
      delay={delay}
      duration={duration}
      x={x}
      y={y}
      initial={initial}
      once={once}
      amount={amount}
      className={className}
    >
      {children}
    </RevealBox>
  );
}

export function Scale({
  children,
  className,
  from = 0.97,
  delay = 0,
  duration = 0.5,
  viewport,
}: {
  children: React.ReactNode;
  className?: string;
  from?: number;
  delay?: number;
  duration?: number;
  viewport?: Viewport;
}) {
  const { once = true, amount = 0.25 } = viewport ?? {};
  return (
    <RevealBox
      delay={delay}
      duration={duration}
      scale={from}
      once={once}
      amount={amount}
      className={className}
    >
      {children}
    </RevealBox>
  );
}

/* ------------------------------------------------------------------ */
/* Glow — respiration lime (opacity + scale uniquement, CSS)           */
/* ------------------------------------------------------------------ */

export function Glow({
  className,
  intensity = 0.06,
  duration = 7,
  scale = 1.05,
}: {
  className?: string;
  intensity?: number;
  duration?: number;
  scale?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn("motion-glow pointer-events-none absolute", className)}
      style={
        {
          background: "var(--primary)",
          "--glow-intensity": `${intensity}`,
          "--glow-duration": `${duration}s`,
          "--glow-scale": `${scale}`,
        } as React.CSSProperties
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Float — micro flottement (CSS)                                      */
/* ------------------------------------------------------------------ */

export function Float({
  children,
  className,
  distance = 4,
  duration = 8,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <div
      className={cn("motion-float", className)}
      style={
        {
          "--float-distance": `${distance}px`,
          "--float-duration": `${duration}s`,
          "--float-delay": `${delay}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
