"use client";

import { Code2, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { RebootButton, CtaArrow, SectionHeader } from "../shared";
import { Stagger, StaggerItem } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * §15 — THREE TRACKS.
 *
 * Les 3 axes réels du produit (Web / Cybersecurity / Applied AI). Chacun
 * porte un `signal` mono et une liste de capacités, pour donner une identité
 * visuelle distincte — pas trois blocs de texte interchangeables.
 *
 * `id="axes"` est un point d'ancrage structurel : header, hero et sticky-cta
 * scrollent vers lui. Ne pas le renommer.
 */
const AXIS_ICONS: Record<string, LucideIcon> = {
  web: Code2,
  cybersecurity: Shield,
  ai: Sparkles,
};

type AxisItem = {
  id: string;
  title: string;
  desc: string;
  signal: string;
  points: string[];
};

export function Axes({ onJoin }: { onJoin: (ref?: string) => void }) {
  const t = useTranslations("landing.axes");
  const items = t.raw("items") as AxisItem[];

  return (
    <section id="axes" className="section scroll-mt-20 cv-auto" aria-labelledby="axes-title">
      <div className="shell">
        <SectionHeader
          index={t("index")}
          title={<span id="axes-title">{t("title")}</span>}
          intro={t("intro")}
        />

        <Stagger
          as="ul"
          role="list"
          className="mt-12 grid gap-4 md:grid-cols-3"
          stagger={0.08}
        >
          {items.map((a, i) => {
            const Icon = AXIS_ICONS[["web", "cybersecurity", "ai"][i] ?? ""];
            return (
              <StaggerItem
                as="li"
                key={a.id}
                className="group flex flex-col rounded-lg border border-border/70 bg-card/40 p-6 transition-colors hover:border-lime/45"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] leading-none tracking-[0.16em] text-lime">
                    {a.id}
                  </span>
                  {Icon && (
                    <span className="flex size-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors group-hover:border-lime/45 group-hover:text-lime">
                      <Icon className="size-4" aria-hidden />
                    </span>
                  )}
                </div>

                {/* Signal : ce que le produit appelle ce terrain. */}
                <span className="mono-label mt-6 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {a.signal}
                </span>

                <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">
                  {a.title}
                </h3>

                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  {a.desc}
                </p>

                <ul role="list" className="mt-5 flex flex-wrap gap-1.5">
                  {a.points.map((p) => (
                    <li
                      key={p}
                      className="rounded-sm border border-border/80 px-2 py-1 text-[12px] leading-none text-muted-foreground"
                    >
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <RebootButton
                    size="md"
                    variant="outline"
                    onClick={() => onJoin(`axes-${a.id}`)}
                    className="group/btn w-full"
                  >
                    {t("cta")}
                    <CtaArrow className="size-3.5" />
                  </RebootButton>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        {/* Rappel mobile : les 3 cartes portent déjà leur bouton, mais sur
            très petits écrans un CTA pleine largeur rassure. */}
        <div className="mt-6 sm:hidden">
          <RebootButton
            size="lg"
            onClick={() => onJoin("axes-mobile")}
            className="group w-full"
          >
            {t("mobileCta")}
            <CtaArrow />
          </RebootButton>
        </div>
      </div>
    </section>
  );
}