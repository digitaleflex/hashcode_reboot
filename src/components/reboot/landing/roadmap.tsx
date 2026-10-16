"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { SectionHeader } from "../shared";
import { Stagger, StaggerItem } from "../motion/primitives";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Item = { key: string; t: string; d: string; status: string; live: boolean };

/**
 * §23 — ROADMAP.
 *
 * Statuts pilotés par les données (#234) : `/api/public/roadmap` dit quels
 * jalons sont réellement vivants (missions/ateliers publiés) ; le statique
 * i18n sert de repli (offline, erreur) — jamais l'inverse.
 */
export function Roadmap() {
  const t = useTranslations("landing.roadmap");
  const items = t.raw("items") as Item[];
  const [live, setLive] = React.useState<Record<string, boolean> | null>(null);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/public/roadmap", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.live === "object") setLive(d.live);
      })
      .catch(() => {
        /* repli statique */
      });
    return () => ctrl.abort();
  }, []);

  const shown = items.map((it) => ({
    ...it,
    live: live ? (live[it.key] ?? it.live) : it.live,
  }));

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
          {shown.map((it) => (
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
                  <span className="ds-badge ds-badge--accent">
                    <Check className="size-3" aria-hidden />
                    {t("liveBadge")}
                  </span>
                ) : (
                  <span className="ds-badge">
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