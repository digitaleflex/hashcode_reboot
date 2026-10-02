"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { RebootButton, CtaArrow } from "../shared";
import { OptionCard } from "../option-card";
import { useTranslations } from "next-intl";

export type ChoiceOption = {
  value: string;
  label: string;
  emoji?: string;
  description?: string;
  hint?: string;
};

export function MultiChoiceView({
  options,
  selected,
  onToggle,
  onContinue,
  required,
}: {
  options: ChoiceOption[];
  selected: string[];
  onToggle: (v: string) => void;
  onContinue: () => void;
  required: boolean;
}) {
  const t = useTranslations("profiling");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            option={o}
            selected={selected.includes(o.value)}
            onToggle={onToggle}
            variant="checkbox"
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-muted-foreground">
          {selected.length > 0
            ? t("multiChoice.selectedCount", { selectedCount: selected.length })
            : required
            ? t("multiChoice.requiredHint")
            : t("multiChoice.optionalHint")}
        </span>
        <RebootButton
          size="md"
          className="group"
          onClick={onContinue}
          disabled={required && selected.length === 0}
        >
          {selected.length > 0 || required ? t("multiChoice.continue") : t("multiChoice.skip")}
          <CtaArrow />
        </RebootButton>
      </div>
    </div>
  );
}

export function TextView({
  value,
  placeholder,
  onChange,
  onContinue,
  error,
  type = "text",
  maxLength,
  required,
  autocomplete = type === "email" ? "email" : "off",
  spellCheck = false,
  inputMode = type === "email" ? "email" : "text",
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  error: string | null;
  type?: "text" | "email";
  maxLength?: number;
  required?: boolean;
  autocomplete?: string;
  spellCheck?: boolean;
  inputMode?: string;
}) {
  const t = useTranslations("profiling");
  const [blurred, setBlurred] = React.useState(false);
  const showError = error || (blurred ? "" : "");
  return (
    <div className="space-y-3">
      <input
        type={type}
        value={value}
        autoFocus
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setBlurred(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onContinue();
          }
        }}
        autoComplete={autocomplete}
        spellCheck={spellCheck}
        inputMode={inputMode as "text" | "email" | "numeric" | "tel" | "url" | "search" | "decimal" | "none"}
        className={cn(
          "w-full h-14 rounded-md border bg-card px-4 text-base sm:text-lg text-foreground placeholder:text-muted-foreground transition-colors duration-180 focus-lime",
          showError ? "border-destructive" : "border-border focus:border-lime",
        )}
      />
      {showError && <ErrorNote>{showError}</ErrorNote>}
      <div className="flex items-center justify-between gap-3">
        {!required && <span className="text-xs text-muted-foreground">{t("textView.optional")}</span>}
        <RebootButton
          size="lg"
          className="group w-full"
          onClick={onContinue}
          disabled={required ? !value.trim() : false}
        >
          {value.trim() || required ? t("textView.continue") : t("textView.skip")}
          <CtaArrow />
        </RebootButton>
      </div>
    </div>
  );
}

export function LongTextView({
  value,
  placeholder,
  onChange,
  onContinue,
  error,
  minChars,
  maxChars,
  suggestions,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  error: string | null;
  minChars?: number;
  maxChars?: number;
  suggestions?: string[];
}) {
  const t = useTranslations("profiling");
  const len = value.trim().length;
  const [blurred, setBlurred] = React.useState(false);
  const showError = error || (blurred ? "" : "");
  return (
    <div className="space-y-3">
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={value}
        autoFocus
        rows={3}
        placeholder={placeholder}
        maxLength={maxChars}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setBlurred(true)}
        className={cn(
          "w-full rounded-md border bg-card px-4 py-3 text-base sm:text-lg text-foreground placeholder:text-muted-foreground transition-colors duration-180 focus-lime resize-none leading-relaxed",
          showError ? "border-destructive" : "border-border focus:border-lime",
        )}
      />
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "text-muted-foreground",
            minChars && len > 0 && len < minChars && "text-destructive",
          )}
        >
          {minChars && len < minChars
            ? t("longTextView.hintRemaining", { remaining: minChars - len })
            : t("longTextView.hintDefault")}
        </span>
        {maxChars && (
          <span className="mono-label text-muted-foreground">
            {t("longTextView.counter", { len, maxChars })}
          </span>
        )}
      </div>
      {showError && <ErrorNote>{showError}</ErrorNote>}
      <RebootButton
        size="lg"
        className="group w-full"
        onClick={onContinue}
        disabled={!value.trim()}
      >
        {t("longTextView.continue")}
        <CtaArrow />
      </RebootButton>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-destructive animate-hash-in" role="alert">
      {children}
    </p>
  );
}