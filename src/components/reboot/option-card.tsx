"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { QuestionOption } from "@/lib/profiling/types";

/** Single-choice option card — click selects & advances. */
export function OptionCard({
  option,
  selected,
  onSelect,
  compact,
  index,
}: {
  option: QuestionOption;
  selected: boolean;
  onSelect: (v: string) => void;
  compact?: boolean;
  index?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      aria-pressed={selected}
      className={cn(
        "group relative w-full text-left rounded-md border bg-card transition-colors duration-180 focus-lime",
        "hover:border-lime/60 hover:bg-elevated/50",
        selected
          ? "border-lime bg-lime/5"
          : "border-border",
        compact ? "p-3.5" : "p-4 sm:p-5",
      )}
    >
      {/* Numeric shortcut hint (1-9) — desktop only, subtle */}
      {typeof index === "number" && index < 9 && (
        <span
          className={cn(
            "absolute top-2 right-2.5 size-5 rounded-sm flex items-center justify-center text-[10px] font-mono transition-opacity duration-180",
            "border border-border/70 text-muted-foreground",
            "hidden sm:flex",
            selected && "border-lime/60 text-lime",
            "opacity-0 group-hover:opacity-100",
          )}
          aria-hidden
        >
          {index + 1}
        </span>
      )}
      <div className="flex items-center gap-3.5">
        {option.emoji && (
          <span
            className={cn(
              "shrink-0 text-xl leading-none transition-transform duration-180 group-hover:scale-110",
              selected && "scale-110",
            )}
            aria-hidden
          >
            {option.emoji}
          </span>
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
        <span
          className={cn(
            "shrink-0 size-5 rounded-full border-2 transition-colors duration-180",
            selected ? "border-lime bg-lime" : "border-border group-hover:border-lime/50",
          )}
          aria-hidden
        >
          {selected && (
            <span className="block size-full rounded-full bg-black" />
          )}
        </span>
      </div>
    </button>
  );
}

/** Multi-choice option card — toggle, no auto-advance. */
export function MultiOptionCard({
  option,
  selected,
  onToggle,
}: {
  option: QuestionOption;
  selected: boolean;
  onToggle: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(option.value)}
      aria-pressed={selected}
      className={cn(
        "group relative w-full text-left rounded-md border bg-card transition-colors duration-180 focus-lime",
        "hover:border-lime/60 hover:bg-elevated/50",
        selected ? "border-lime bg-lime/5" : "border-border",
        "p-3.5",
      )}
    >
      <div className="flex items-center gap-3">
        {option.emoji && (
          <span className="shrink-0 text-lg leading-none" aria-hidden>
            {option.emoji}
          </span>
        )}
        <span className="flex-1 text-sm font-medium text-foreground">
          {option.label}
        </span>
        <span
          className={cn(
            "shrink-0 size-5 rounded border-2 flex items-center justify-center transition-colors duration-180",
            selected ? "border-lime bg-lime" : "border-border group-hover:border-lime/50",
          )}
          aria-hidden
        >
          {selected && <Check className="size-3.5 text-black" strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}
