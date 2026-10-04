"use client";

import * as React from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DOMAIN_FILTERS,
  LEVEL_FILTERS,
  PERIOD_FILTERS,
  TYPE_FILTERS,
  type EventFilters,
} from "./types";

/* ── briques ─────────────────────────────────────────────────────────────── */

const PILL =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border px-3.5 text-[13px] font-medium leading-none transition-colors duration-150 focus-lime cursor-pointer";

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        PILL,
        active
          ? "border-lime/60 bg-lime/10 text-lime"
          : "border-border text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

const SELECT =
  "min-h-[44px] w-full appearance-none rounded-md border border-border bg-background pl-3 pr-9 text-[13px] text-foreground transition-colors focus-lime hover:border-lime/50 cursor-pointer";

function FilterSelect({
  idPrefix,
  label,
  value,
  options,
  onChange,
}: {
  idPrefix: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="sr-only" htmlFor={`${idPrefix}-${label}`}>
        {label}
      </label>
      <div className="relative">
        <select
          id={`${idPrefix}-${label}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={SELECT}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}

function ActiveFilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-md bg-lime text-[11px] font-semibold tabular-nums text-background">
      {count}
    </span>
  );
}

/* ── barre ───────────────────────────────────────────────────────────────── */

export interface EventsFilterBarProps {
  filters: EventFilters;
  onChange: (next: EventFilters) => void;
  /** Nombre de résultats après filtrage. */
  resultCount: number;
  /** Nombre total avant filtrage. */
  totalCount: number;
}

/**
 * Barre de filtres — pills de type (scrollables horizontalement sur mobile)
 * + 3 `<select>` natifs repliés dans un bottom sheet sur mobile.
 *
 * Le compteur est annoncé via `aria-live="polite"`.
 */
export function EventsFilterBar({
  filters,
  onChange,
  resultCount,
  totalCount,
}: EventsFilterBarProps) {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const activeCount =
    (filters.type !== "all" ? 1 : 0) +
    (filters.level !== "all" ? 1 : 0) +
    (filters.domain !== "all" ? 1 : 0) +
    (filters.period !== "all" ? 1 : 0);
  const hasActive = activeCount > 0;

  const set = React.useCallback(
    (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch }),
    [filters, onChange],
  );

  const reset = React.useCallback(() => {
    onChange({ type: "all", level: "all", domain: "all", period: "all" });
  }, [onChange]);

  // Les selects existent en double (barre desktop + bottom sheet mobile) :
  // un `idPrefix` par instance évite les `id` dupliqués.
  const makeSelects = (idPrefix: string) => (
    <>
      <FilterSelect
        idPrefix={idPrefix}
        label="Niveau"
        value={filters.level}
        options={LEVEL_FILTERS}
        onChange={(v) => set({ level: v })}
      />
      <FilterSelect
        idPrefix={idPrefix}
        label="Axe"
        value={filters.domain}
        options={DOMAIN_FILTERS}
        onChange={(v) => set({ domain: v })}
      />
      <FilterSelect
        idPrefix={idPrefix}
        label="Période"
        value={filters.period}
        options={PERIOD_FILTERS}
        onChange={(v) => set({ period: v as EventFilters["period"] })}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Pills de type : rail horizontal qui touche les bords sur mobile. */}
      <div className="-mx-5 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:px-0">
        <div
          role="group"
          aria-label="Filtrer par type d'événement"
          className="flex w-max flex-nowrap items-center gap-2 sm:w-auto sm:flex-wrap"
        >
          {TYPE_FILTERS.map((opt) => (
            <FilterPill
              key={opt.value}
              label={opt.label}
              active={filters.type === opt.value}
              onClick={() => set({ type: opt.value })}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Desktop : selects en ligne. */}
        <div className="hidden min-w-0 flex-1 gap-3 md:flex">
          {makeSelects("filter-desktop")}
        </div>

        {/* Mobile : les 3 selects vivent dans un bottom sheet. */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={`Filtres (${activeCount} actif${activeCount > 1 ? "s" : ""})`}
              className={cn(
                "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border px-3.5 text-[13px] font-medium transition-colors focus-lime cursor-pointer md:hidden",
                hasActive
                  ? "border-lime/60 bg-lime/10 text-lime"
                  : "border-border text-foreground",
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Filtres
              <ActiveFilterCount count={activeCount} />
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] gap-0 rounded-t-xl border-border bg-background px-5 pb-6 pt-5 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
          >
            <SheetHeader className="p-0">
              <SheetTitle className="font-display text-lg font-semibold tracking-tight">
                Affiner les événements
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-3">{makeSelects("filter-sheet")}</div>
            <button
              type="button"
              onClick={() => {
                reset();
                setSheetOpen(false);
              }}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-foreground transition-colors focus-lime hover:border-lime/50 cursor-pointer"
            >
              <RotateCcw className="size-4" aria-hidden />
              Réinitialiser les filtres
            </button>
          </SheetContent>
        </Sheet>

        {hasActive && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-1 text-[13px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-lime hover:underline focus-lime cursor-pointer"
          >
            <RotateCcw className="size-4" aria-hidden />
            Réinitialiser
          </button>
        )}

        <p
          aria-live="polite"
          aria-atomic="true"
          className="ml-auto shrink-0 text-[13px] text-muted-foreground"
        >
          {resultCount === 0
            ? "Aucun événement"
            : `${resultCount} événement${resultCount > 1 ? "s" : ""}`}
          {hasActive && totalCount !== resultCount ? ` sur ${totalCount}` : ""}
        </p>
      </div>
    </div>
  );
}
