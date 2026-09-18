"use client";

import { RebootButton, CtaArrow, MonoLabel, SectionHeader } from "../shared";
import { AXES, DOMAIN_ICONS } from "./data";

export function Axes({ onJoin }: { onJoin: () => void }) {
  return (
    <section
      id="axes"
      className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 scroll-mt-20 cv-auto"
    >
      <SectionHeader
        index="02 · Les trois axes"
        title="Trois terrains. Une communauté."
        intro="Choisis ton terrain. Tu pourras en croiser d'autres plus tard."
        className="mb-10"
      />
      <div className="grid gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
        {AXES.map((a) => {
          const Icon = DOMAIN_ICONS[a.icon];
          return (
            <div
              key={a.id}
              className="row-sweep bg-card p-6 sm:p-8 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto_1fr_auto] gap-x-6 gap-y-4 items-center hover:bg-elevated/60 transition-colors group"
            >
              <MonoLabel className="text-lime">{a.id}</MonoLabel>
              {Icon && (
                <span className="size-9 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground group-hover:text-lime group-hover:border-lime/40 transition-colors">
                  <Icon className="size-4" />
                </span>
              )}
              <div>
                <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-lime transition-colors">
                  {a.title}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">{a.desc}</p>
              </div>
              <RebootButton
                size="md"
                variant="outline"
                onClick={onJoin}
                className="col-span-2 sm:col-span-1 w-full sm:w-auto justify-self-stretch sm:justify-self-end"
              >
                Construire mon profil
                <CtaArrow className="size-3.5" />
              </RebootButton>
            </div>
          );
        })}
      </div>
      {/* Rappel mobile après les axes */}
      <div className="mt-6 sm:hidden">
        <RebootButton size="lg" onClick={onJoin} className="group w-full">
          Rejoindre la communauté
          <CtaArrow />
        </RebootButton>
      </div>
    </section>
  );
}
