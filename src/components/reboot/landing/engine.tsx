"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { SectionHeader } from "../shared";
import { ProfileCard } from "../profile-card";
import { generateProfile } from "@/lib/profiling/engine";
import type { ProfileAnswers } from "@/lib/profiling/types";
import { Reveal, Stagger, StaggerItem } from "../motion/primitives";
import { useTranslations } from "next-intl";

/**
 * Entrées figées servant uniquement à la carte de démonstration ci-contre.
 * Elles ne sont jamais envoyées nulle part : aucun appel réseau, aucun
 * enregistrement. Le profil affiché est produit par le VRAI moteur
 * (`generateProfile`), donc exactement ce qu'un membre verrait.
 */
const DEMO_ANSWERS: ProfileAnswers = {
  firstName: "Ama",
  lastName: "D.",
  email: "demo@example.invalid",
  phone: "",
  country: "BJ",
  city: "",
  primaryDomain: "web",
  level: "practicing",
  goal: "upskill",
  availability: "2-5h",
  learningStyle: "project",
  mentoringInterest: "yes",
};

/**
 * §17/18 — PROFILE ENGINE.
 *
 * Deux blocs :
 *  1. le parcours en 7 étapes (= les 7 groupes réels de `questions.ts`) ;
 *  2. la carte de profil de sortie, produite par le moteur réel, clairement
 *     étiquetée comme démonstration.
 *
 * §17 impose de montrer « le système », pas la promesse marketing : c'est
 * pour ça que la carte est affichée et que la wording précise qu'il n'y a
 * pas de modèle d'IA derrière — `generateProfile` est 100 % déterministe.
 */
export function Engine() {
  const t = useTranslations("landing.engine");
  const path = t.raw("path") as Array<{ k: string; t: string; m: string }>;
  const archetypes = t.raw("archetypes") as Array<{ t: string; m: string }>;

  // Mémoïsé : `generateProfile` est pur, mais on évite de le rejouer à
  // chaque rendu.
  const demoProfile = React.useMemo(
    () => generateProfile(DEMO_ANSWERS),
    [],
  );

  return (
    <section
      id="engine"
      className="section border-t border-border/60"
      aria-labelledby="engine-title"
    >
      <div className="shell">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Colonne gauche : le parcours */}
          <div className="lg:col-span-5">
            <SectionHeader
              index={t("index")}
              title={<span id="engine-title">{t("title")}</span>}
              intro={t("intro")}
            />

            <Stagger as="ol" className="mt-10 flex flex-col" stagger={0.06}>
              {path.map((p) => (
                <StaggerItem
                  as="li"
                  key={p.k}
                  className="flex gap-4 border-t border-border/60 py-4 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <span className="font-mono text-[11px] leading-5 tracking-[0.12em] text-lime">
                    {p.k}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[15px] font-semibold leading-5 text-foreground">
                      {p.t}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                      {p.m}
                    </span>
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          {/* Colonne droite : la carte réelle + les archétypes */}
          <div className="lg:col-span-7">
            <Reveal>
              <div
                className="relative rounded-lg border border-border/70 bg-card/40 p-4 sm:p-6"
              >
                {/* Étiquette de démonstration — non ambiguë. */}
                <p className="mono-label mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Info className="size-3.5 shrink-0" aria-hidden />
                  {t("demoLabel")}
                </p>

                <ProfileCard
                  profile={demoProfile}
                  firstName={DEMO_ANSWERS.firstName}
                />

                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {t("demoNote")}
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="mt-8">
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-foreground">
                  {t("archetypesTitle")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("archetypesNote")}
                </p>
                <ul
                  role="list"
                  className="mt-4 flex flex-wrap gap-2"
                >
                  {archetypes.map((a) => (
                    <li
                      key={a.t}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[13px] leading-none text-foreground"
                    >
                      <span className="size-1 rounded-full bg-lime" aria-hidden />
                      <span className="font-medium">{a.t}</span>
                      <span className="text-muted-foreground">{a.m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}