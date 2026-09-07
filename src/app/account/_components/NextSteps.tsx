import * as React from "react";
import { ArrowRight } from "lucide-react";
import { MonoLabel } from "@/components/reboot/shared";

/**
 * Server component : 3 prochaines étapes personnalisées par archétype.
 * Contenu éditorial statique (MVP). À enrichir avec du contenu
 * conditionnel par goal/level dans une future itération.
 */
const STEPS_BY_ARCHETYPE: Record<string, string[]> = {
  "CYBER BUILDER": [
    "Rejoins le groupe WhatsApp officiel — c'est là que circulent les ressources et les annonces.",
    "Identifie ton premier terrain d'attaque (SOC, pentest, OSINT) à partir de tes spécialités.",
    "Documente ton prochain lab / challenge sur le canal #labs de la communauté.",
  ],
  "AI EXPLORER": [
    "Rejoins le groupe WhatsApp officiel pour suivre les sessions AI.",
    "Choisis un premier projet LLM ou agent à prototyper ce mois-ci.",
    "Partage un prompt ou une démo sur le canal #ia-pratique.",
  ],
  "WEB ARCHITECT": [
    "Rejoins le groupe WhatsApp officiel — accès au canal #architecture pour les pairs.",
    "Propose un cas d'usage réel (audit d'archi, design review) à un membre moins avancé.",
    "Documente un pattern ou un anti-pattern que tu rencontres sur tes projets.",
  ],
  "WEB BUILDER": [
    "Rejoins le groupe WhatsApp officiel — c'est là que se font les connexions.",
    "Pousse ton premier projet public (même minimal) sur GitHub ce mois-ci.",
    "Demande un feedback sur le canal #code-review de la communauté.",
  ],
  "HASHCODE BUILDER": [
    "Rejoins le groupe WhatsApp officiel pour découvrir les sous-communautés.",
    "Identifie le domaine qui t'attire le plus (web, cyber, AI) et creuse un cas concret.",
    "Partage ton objectif 3 mois sur le canal #objectifs pour trouver un binôme.",
  ],
};

const DEFAULT_STEPS = [
  "Rejoins le groupe WhatsApp officiel pour découvrir la communauté.",
  "Partage ton objectif 3 mois sur le canal #objectifs pour trouver un binôme.",
  "Identifie le prochain terrain sur lequel tu veux progresser ce mois-ci.",
];

export function NextSteps({ archetype }: { archetype: string | null }) {
  const steps =
    (archetype && STEPS_BY_ARCHETYPE[archetype]) || DEFAULT_STEPS;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <MonoLabel className="text-muted-foreground">Prochaines étapes</MonoLabel>
        <span className="mono-label text-xs text-muted-foreground">
          personnalisées pour toi
        </span>
      </div>
      <ol className="rounded-md border border-border/60 bg-card/40 p-5 sm:p-6 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="shrink-0 flex items-center justify-center size-6 rounded-full border border-lime/40 bg-lime/10 text-lime text-xs font-mono font-bold mono-label">
              {i + 1}
            </span>
            <p className="text-sm text-foreground flex-1">{step}</p>
            <ArrowRight className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />
          </li>
        ))}
      </ol>
    </section>
  );
}
