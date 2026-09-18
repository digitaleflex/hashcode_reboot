"use client";

import { SectionHeader, Tag } from "../shared";
import { AUDIENCE } from "./data";

export function Audience({ onJoin }: { onJoin: () => void }) {
  return (
    <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
      <SectionHeader
        index="04 · Pour qui c'est fait"
        title="Pas besoin d'être expert."
        intro="Si tu es curieux et motivé, tu as ta place. Touche un profil pour commencer."
        className="mb-8"
      />
      <div className="flex flex-wrap gap-2">
        {AUDIENCE.map((a) => (
          <Tag key={a} onClick={onJoin}>
            {a}
          </Tag>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Débutant ou avancé — on part de là où tu es vraiment.
      </p>
    </section>
  );
}
