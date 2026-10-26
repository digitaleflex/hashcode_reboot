"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { EmojiIcon } from "./emoji-icon";
import type { QuestionOption } from "@/lib/profiling/types";
import { useTranslations } from "next-intl";

type Variant = "radio" | "checkbox";


export function OptionCard({
  option,
  selected,
  onSelect = () => {},
  onToggle,
  compact,
  index,
  variant = "radio",
}: {
  option: QuestionOption;
  selected: boolean;
  onSelect?: (v: string) => void;
  onToggle?: (v: string) => void;
  compact?: boolean;
  index?: number;
  variant?: Variant;
}) {
  const t = useTranslations("profiling");
  const isCheckbox = variant === "checkbox";
  const handleClick = isCheckbox && onToggle
    ? () => onToggle(option.value)
    : () => onSelect(option.value);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selected}
      aria-label={selected ? t("optionCard.selected", { label: option.label }) : option.label}
      className={cn(
        "group relative w-full text-left rounded-2xl border transition-all duration-200 focus-lime",
        "hover:border-lime/50 hover:bg-white/[0.03]",
        selected
          ? "border-lime bg-lime/[0.07] shadow-[0_0_0_1px_var(--primary),0_12px_32px_-16px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
          : "border-[var(--line-soft)] bg-card",
        compact ? "p-3.5" : "p-4 sm:p-[18px]",
      )}
    >
      <div className={cn("flex items-center gap-3.5", isCheckbox && "gap-3")}>
        {option.emoji && (
          <OptionIcon emoji={option.emoji} selected={selected} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={cn(
                "font-medium text-foreground truncate",
                compact ? "text-sm" : "text-base",
              )}
            >
              {option.label}
            </span>
            {option.hint && (
              <span className="mono-label shrink-0 text-muted-foreground">
                {option.hint}
              </span>
            )}
          </div>
          {option.description && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
              {option.description}
            </p>
          )}
        </div>
        {/* Raccourci clavier 1-9 — desktop, au survol, À CÔTÉ du radio
            (il le chevauchait en position absolue). */}
        {typeof index === "number" && index < 9 && !selected && (
          <kbd
            className="hidden h-5 min-w-5 items-center justify-center rounded border border-[var(--line-strong)] px-1 font-mono text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex"
            aria-hidden
          >
            {index + 1}
          </kbd>
        )}
        {!isCheckbox && (
          <span
            className={cn(
              "grid shrink-0 size-6 place-items-center rounded-full border-2 transition-colors duration-200",
              selected ? "border-lime bg-lime text-black" : "border-[var(--line-strong)] group-hover:border-lime/50",
            )}
            aria-hidden
          >
            {selected && <Check className="size-3.5" strokeWidth={3} />}
          </span>
        )}
        {isCheckbox && (
          <span
            className={cn(
              "shrink-0 size-5 rounded border-2 flex items-center justify-center transition-colors duration-200",
              selected ? "border-lime bg-lime" : "border-border group-hover:border-lime/50",
            )}
            aria-hidden
          >
            {selected && <Check className="size-3.5 text-black" strokeWidth={3} />}
          </span>
        )}
      </div>
    </button>
  );
}

function OptionIcon({ emoji, selected }: { emoji: string; selected: boolean }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl border transition-colors duration-200",
        selected
          ? "border-lime/50 bg-lime text-black"
          : "border-[var(--line-strong)] bg-white/[0.03] text-foreground/80 group-hover:border-lime/40 group-hover:text-lime",
      )}
      aria-hidden
    >
      <EmojiIcon emoji={emoji} className="size-[18px]" />
    </span>
  );
}
