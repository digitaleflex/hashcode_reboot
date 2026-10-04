"use client";

import { Check } from "lucide-react";
import { SectionHeader } from "../shared";
import { Stagger, StaggerItem } from "../motion/primitives";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Item = { t: string; d: string; status: string; live: boolean };

/**
 * §23 — ROADMAP.
 *
 * Reprend les 5 jalons existants avec leurs statuts réels
 * (Maintenant / Bientôt / Ensuite). Un seul est marqué « en cours » — le
 * lime ne sert qu'à ça.
 *
 * Le libellé d'origine « Le premier dès cette semaine » a été retiré : rien
 * dans le dépôt ne permet de sourcer cette promesse de délai.
 */
export function Roadmap() {
  const t = useTranslations("landing.roadmap");
  const items = t.raw("items") as Item[];

  return (
    <section
      id="roadmap"
      className="section border-t border-border/60"
      aria-labelledby="roadmap-title"
    >
      <div className="shell">
        <SectionHeader
          index={t("index")}
          title={<span id="roadmap-title">{t("title")}</span>}
          intro={t("intro")}
        />

        <Stagger
          as="ol"
          className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-5"
          stagger={0.06}
        >
          {items.map((it) => (
            <StaggerItem
              as="li"
              key={it.t}
              className={cn(
                "flex flex-col gap-3 bg-card/40 p-5",
                it.live && "bg-lime/[0.04]",
              )}
            >
              <div className="flex items-center gap-2">
                {it.live ? (
                  <span className="mono-label inline-flex items-center gap-1.5 rounded-sm border border-lime/50 bg-lime/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-lime">
                    <Check className="size-3" aria-hidden />
                    {t("liveBadge")}
                  </span>
                ) : (
                  <span className="mono-label rounded-sm border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {it.status}
                  </span>
                )}
              </div>
              <h3 className="font-display text-base font-semibold leading-tight text-foreground">
                {it.t}
              </h3>
              <p className="text-sm leading-snug text-muted-foreground">{it.d}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}