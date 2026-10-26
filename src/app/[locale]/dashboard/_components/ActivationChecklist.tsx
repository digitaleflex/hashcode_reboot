import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/**
 * Checklist d'activation — le fil rouge des premiers jours.
 *
 * Remplace la bannière isolée « Ajoute ton WhatsApp » : chaque geste utile
 * (numéro, communauté, premier atelier, objectif) devient une étape cochable
 * avec sa progression. Server component — tout est dérivé du membre et
 * d'un simple comptage d'inscriptions aux ateliers.
 */
export async function ActivationChecklist({
  hasPhone,
  joinedCommunity,
  hasEnrollment,
  hasGoal,
}: {
  hasPhone: boolean;
  joinedCommunity: boolean;
  hasEnrollment: boolean;
  hasGoal: boolean;
}) {
  const t = await getTranslations("dashboard.home.activation");

  const steps = [
    { key: "profile", done: true, href: "/dashboard/profile", external: false },
    { key: "phone", done: hasPhone, href: "/dashboard/settings", external: false },
    { key: "community", done: joinedCommunity, href: "/api/community/join", external: true },
    { key: "workshop", done: hasEnrollment, href: "/dashboard/ateliers", external: false },
    { key: "goal", done: hasGoal, href: "/dashboard/profile", external: false },
  ] as const;
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  // Tout est fait : la checklist s'efface, plus besoin de la pousser.
  if (doneCount === steps.length) return null;

  return (
    <section className="surface overflow-hidden p-5 sm:p-6" aria-labelledby="activation-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="ds-overlabel ds-overlabel--accent">{t("eyebrow")}</span>
          <h2 id="activation-title" className="mt-1.5 font-display text-xl font-bold tracking-tight">
            {t("title")}
          </h2>
        </div>
        <span className="font-display text-sm font-semibold tabular-nums text-muted-foreground">
          {t("progress", { done: doneCount, total: steps.length })}
        </span>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("title")}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-lime/70 to-lime" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
        {steps.map((s, i) => {
          const content = (
            <>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  s.done ? "bg-lime text-black" : "border border-[var(--line-strong)] text-foreground",
                )}
                aria-hidden
              >
                {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", s.done && "text-muted-foreground line-through decoration-lime/50")}>
                  {t(`steps.${s.key}.title`)}
                </span>
                {!s.done && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t(`steps.${s.key}.hint`)}</span>
                )}
              </span>
              {!s.done && (
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-lime" aria-hidden />
              )}
            </>
          );
          const cls = cn(
            "group flex h-full items-center gap-3 rounded-xl border p-3 transition-colors",
            s.done
              ? "border-transparent bg-white/[0.02]"
              : "border-[var(--line-soft)] bg-background/40 hover:border-lime/40 focus-lime",
          );
          return (
            <li key={s.key}>
              {s.done ? (
                <div className={cls}>
                  {content}
                  <span className="sr-only">{t("doneSr")}</span>
                </div>
              ) : s.external ? (
                <a href={s.href} target="_blank" rel="noopener noreferrer" className={cls}>
                  {content}
                </a>
              ) : (
                <Link href={s.href} className={cls}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
