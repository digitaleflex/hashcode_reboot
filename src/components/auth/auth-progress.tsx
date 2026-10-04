"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicateur d'étape « 1 — Email · 2 — Code ».
 *
 * Volontairement plat : pas de stepper lourd, pas de bandeau, pas d'animation.
 * Une liste ordonnée de deux items, l'étape courante en lime et l'étape déjà
 * franchie marquée par une coche — donc jamais signalée par la couleur seule.
 */
export function AuthProgress({
  step,
  className,
}: {
  /** 1 = email, 2 = code. */
  step: 1 | 2;
  className?: string;
}) {
  const t = useTranslations("auth.common");
  const steps: Array<{ index: 1 | 2; label: string }> = [
    { index: 1, label: t("stepOne") },
    { index: 2, label: t("stepTwo") },
  ];

  return (
    <ol
      aria-label={t("progressLabel")}
      className={cn("flex items-center justify-center gap-2", className)}
    >
      {steps.map(({ index, label }) => {
        const isCurrent = index === step;
        const isDone = index < step;
        return (
          <li
            key={index}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] leading-none transition-colors duration-150",
              isCurrent
                ? "border-lime/60 bg-lime/5 text-lime"
                : "border-border bg-card/40 text-muted-foreground",
            )}
          >
            {isDone ? (
              <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <span className="font-mono" aria-hidden="true">
                {index}
              </span>
            )}
            <span>{label}</span>
            {isDone && <span className="sr-only">{t("stepDone")}</span>}
          </li>
        );
      })}
    </ol>
  );
}