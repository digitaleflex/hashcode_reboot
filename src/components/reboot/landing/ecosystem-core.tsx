"use client";

import * as React from "react";
import { HashSymbol } from "@/components/brand/logo";
import { Float, Glow } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * HASHCODE ECOSYSTEM CORE — visual du Hero.
 *
 * Construit en CSS + SVG inline uniquement : aucun raster, aucun canvas,
 * aucun WebGL (cf. audit perf §30). L'animation ne touche que
 * `transform` et `opacity`.
 *
 * Le contenu des 3 orbites vient de `landing.hero.orbits` (i18n) et décrit
 * les trois axes réels du produit — Web / Cyber / AI.
 */
export function EcosystemCore() {
  const t = useTranslations("landing.hero");
  const orbits = t.raw("orbits") as Array<{ k: string; t: string; m: string }>;
  const classes = ["web", "cybersecurity", "ai"] as const;

  return (
    <div className="ecosystem-core">
      <div className="ecosystem-core__stage">
        {/* Aura : très basse intensité, respiration lente.
            Positionnement en `inset` + taille, jamais en translate : Framer
            Motion écrit la propriété `transform` pour animer `scale`, ce qui
            écraserait un `-translate-x-1/2` de Tailwind. */}
        <Glow
          className="inset-[15%] rounded-full blur-3xl"
          intensity={0.055}
          duration={8}
          scale={1.08}
        />

        {/* Anneaux concentriques — 1px, opacité ≤ 7%. */}
        <div className="ecosystem-core__rings" aria-hidden>
          <div className="ecosystem-core__ring ecosystem-core__ring--1" />
          <div className="ecosystem-core__ring ecosystem-core__ring--2" />
          <div className="ecosystem-core__ring ecosystem-core__ring--3" />
        </div>

        {/* Noyau : le H de la marque. */}
        <Float className="flex h-full w-full items-center justify-center" distance={3} duration={9}>
          <div className="ecosystem-core__hub">
            <HashSymbol className="text-lime" size={40} />
          </div>
        </Float>

        {/* Noeuds de réseau sur l'anneau 3 — décoratifs. */}
        <NetworkNodes />
      </div>

      {/* 3 modules orbitaux */}
      <ul role="list" aria-label={t("orbitAria")} className="contents">
        {orbits.map((o, i) => (
          <li
            key={o.k}
            className={`ecosystem-core__orbit ecosystem-core__orbit--${classes[i] ?? "web"}`}
          >
            <span className="mono-label text-[10px] leading-none text-muted-foreground">{o.k}</span>
            <span className="font-display text-[13px] font-semibold leading-tight text-foreground">
              {o.t}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">{o.m}</span>
          </li>
        ))}
      </ul>

      {/* Légende */}
      <span className="ecosystem-core__legend">{t("core")}</span>
      <span className="sr-only">{t("coreCaption")}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Réseau de noeuds — 6 points sur l'anneau, traits vers le noyau.     */
/* SVG inline : net à toute résolution, aucun coût réseau.            */
/* ------------------------------------------------------------------ */

const NODES = [
  { x: 50, y: 8 },
  { x: 85, y: 30 },
  { x: 85, y: 70 },
  { x: 50, y: 92 },
  { x: 15, y: 70 },
  { x: 15, y: 30 },
] as const;

function NetworkNodes() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
    >
      {NODES.map((n) => (
        <line
          key={`l-${n.x}-${n.y}`}
          x1="50"
          y1="50"
          x2={n.x}
          y2={n.y}
          stroke="currentColor"
          strokeWidth="0.2"
          className="text-lime/25"
        />
      ))}
      {NODES.map((n) => (
        <circle
          key={`c-${n.x}-${n.y}`}
          cx={n.x}
          cy={n.y}
          r="0.9"
          className="fill-lime/60"
        />
      ))}
    </svg>
  );
}