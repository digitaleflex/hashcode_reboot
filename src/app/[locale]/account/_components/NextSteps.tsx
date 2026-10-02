import * as React from "react";
import { ArrowRight } from "lucide-react";
import { MonoLabel } from "@/components/reboot/shared";
import { getTranslations } from "next-intl/server";

/**
 * Server component : 3 prochaines étapes personnalisées par archétype.
 * Contenu éditorial statique (MVP). À enrichir avec du contenu
 * conditionnel par goal/level dans une future itération.
 */
export async function NextSteps({ archetype }: { archetype: string | null }) {
  const t = await getTranslations("account.nextSteps");
  const stepsByArchetype = t.raw("stepsByArchetype") as Record<string, string[]>;
  const defaultSteps = t.raw("defaultSteps") as string[];

  const steps = (archetype && stepsByArchetype[archetype]) || defaultSteps;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <MonoLabel className="text-muted-foreground">{t("title")}</MonoLabel>
        <span className="mono-label text-xs text-muted-foreground">
          {t("personalizedNote")}
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