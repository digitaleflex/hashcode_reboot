"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ============================================================
   HASHCODE REBOOT — Motion primitives
   Un seul langage de motion pour toute l'interface.

   Règles (cf. audit motion) :
   - transform / opacity UNIQUEMENT (jamais de blur, filter ou
     box-shadow animés : coût de paint trop élevé sur mobile).
   - useReducedMotion() respecté PAR PRIMITIVE, pas seulement via
     les classes `motion-reduce:` de globals.css (qui ne coverent
     pas les variants Framer Motion).
   - Amplitude faible. Le site doit rester professionnel, jamais
     "démo de librairie d'animations".
   ============================================================ */

/** Courbe maison — identique à celle déjà utilisée dans globals.css. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Viewport = { once?: boolean; amount?: number };

/**
 * Balises cibles. Utile quand l'animation enveloppe un élément qui doit
 * respecter la structure du document : animer un `<li>` avec un `<div>`
 * intermédiaire casserait la sémantique de `<ol>` / `<ul>`.
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

const MOTION_TAGS = {
  div: motion.div,
  li: motion.li,
  span: motion.span,
  p: motion.p,
  ul: motion.ul,
  ol: motion.ol,
  section: motion.section,
  article: motion.article,
  figure: motion.figure,
  header: motion.header,
} as const;

/** Props HTML additionnelles acceptées par les primitives (`role`, `aria-*`…). */
type RestProps = Omit<React.ComponentPropsWithoutRef<"div">, "children">;

/* ------------------------------------------------------------------ */
/* Reveal — entrée générique au scroll                                  */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  y = 16,
  duration = 0.5,
  viewport,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: MotionTag;
  /** Retard en secondes. */
  delay?: number;
  /** Distance verticale de départ, en px. */
  y?: number;
  duration?: number;
  viewport?: Viewport;
} & RestProps) {
  const reduced = useReducedMotion();
  const { once = true, amount = 0.25 } = viewport ?? {};
  const Comp = MOTION_TAGS[as] as React.ElementType;

  // reduced motion : on part directement de l'état final, rien n'est masqué.
  if (reduced) {
    const Plain = as as React.ElementType;
    return (
      <Plain className={className} {...rest}>
        {children}
      </Plain>
    );
  }

  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/* ------------------------------------------------------------------ */
/* Stagger + StaggerItem — cascade                                     */
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
  const reduced = useReducedMotion();
  const { once = true, amount = 0.15 } = viewport ?? {};
  const Comp = MOTION_TAGS[as] as React.ElementType;

  if (reduced) {
    const Plain = as as React.ElementType;
    return (
      <Plain className={className} {...rest}>
        {children}
      </Plain>
    );
  }

  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren } },
      }}
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
  const reduced = useReducedMotion();
  const Comp = MOTION_TAGS[as] as React.ElementType;

  if (reduced) {
    const Plain = as as React.ElementType;
    return (
      <Plain className={className} {...rest}>
        {children}
      </Plain>
    );
  }

  return (
    <Comp
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration, ease: EASE } },
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/* ------------------------------------------------------------------ */
/* Fade / Slide / Scale — éléments uniques                             */
/* ------------------------------------------------------------------ */

export function Fade({
  children,
  className,
  delay = 0,
  duration = 0.45,
  viewport,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  viewport?: Viewport;
}) {
  const reduced = useReducedMotion();
  const { once = true, amount = 0.25 } = viewport ?? {};
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
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
}: {
  children: React.ReactNode;
  className?: string;
  from?: "up" | "down" | "left" | "right";
  distance?: number;
  delay?: number;
  duration?: number;
  viewport?: Viewport;
}) {
  const reduced = useReducedMotion();
  const { once = true, amount = 0.25 } = viewport ?? {};
  if (reduced) return <div className={className}>{children}</div>;

  const offset: Record<NonNullable<typeof from>, { x: number; y: number }> = {
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset[from] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
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
  const reduced = useReducedMotion();
  const { once = true, amount = 0.25 } = viewport ?? {};
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: from }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Glow — respiration lime (opacity + scale uniquement)               */
/* ------------------------------------------------------------------ */

export function Glow({
  className,
  /** Opacité maximale. Garde ≤ 0.08 : au-delà ça devient du "vert partout". */
  intensity = 0.06,
  duration = 7,
  scale = 1.05,
}: {
  className?: string;
  intensity?: number;
  duration?: number;
  scale?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div
        aria-hidden
        className={cn("pointer-events-none absolute", className)}
        style={{ background: "var(--primary)", opacity: intensity }}
      />
    );
  }

  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute", className)}
      style={{ background: "var(--primary)" }}
      animate={{ opacity: [intensity * 0.55, intensity, intensity * 0.55], scale: [1, scale, 1] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Float — micro flottement (± few px)                                */
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
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}