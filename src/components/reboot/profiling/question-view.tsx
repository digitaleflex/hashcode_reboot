"use client";

import * as React from "react";
import {
  getQuestionOptions,
  THREE_MONTH_GOAL_SUGGESTIONS,
} from "@/lib/profiling/questions";
import type { ProfileAnswers, Question } from "@/lib/profiling/types";
import { RebootButton, CtaArrow } from "../shared";
import { OptionCard } from "../option-card";
import { CountrySelect } from "../country-select";
import { MultiChoiceView, TextView, LongTextView, ErrorNote } from "./views";

/* ------------------------------------------------------------------ */
/* Per-question view                                                   */
/* ------------------------------------------------------------------ */

export function QuestionView({
  question,
  answers,
  value,
  error,
  debouncedError,
  onSingle,
  onMultiToggle,
  onTextChange,
  onCountry,
  onContinue,
}: {
  question: Question;
  answers: ProfileAnswers;
  value: unknown;
  error: string | null;
  debouncedError?: string;
  onSingle: (v: string) => void;
  onMultiToggle: (v: string) => void;
  onTextChange: (v: string) => void;
  onCountry: (v: string) => void;
  onContinue: () => void;
}) {
  void debouncedError;
  const options = React.useMemo(
    () =>
      question.options ?? getQuestionOptions(question.id, answers),
    [question, answers],
  );

  // Keyboard shortcuts: 1-9 select option N (single-choice only).
  React.useEffect(() => {
    if (question.type !== "single_choice" || options.length === 0) return;
    function onKey(e: KeyboardEvent) {
      // Ignore when focus is in an input/textarea/select.
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= options.length) {
        e.preventDefault();
        onSingle(options[n - 1].value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question.type, options, onSingle]);

  return (
    <div>
      <h2 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-foreground leading-snug">
        {question.title}
      </h2>
      {question.description && (
        <p className="mt-2 text-muted-foreground text-sm sm:text-base leading-relaxed">
          {question.description}
        </p>
      )}

      <div className="mt-6">
        {question.type === "single_choice" && (
          <div className="grid gap-2.5">
            {options.map((o, i) => (
              <OptionCard
                key={o.value}
                option={o}
                selected={value === o.value}
                onSelect={onSingle}
                index={i}
              />
            ))}
          </div>
        )}

        {question.type === "multi_choice" && (
          <MultiChoiceView
            options={options}
            selected={(value as string[]) ?? []}
            onToggle={onMultiToggle}
            onContinue={onContinue}
            required={question.required}
          />
        )}

        {question.type === "text" && (
          <TextView
            value={(value as string) ?? ""}
            placeholder={question.placeholder}
            onChange={onTextChange}
            onContinue={onContinue}
            error={error}
            maxLength={question.maxChars}
            required={question.required}
          />
        )}

        {question.type === "longtext" && (
          <LongTextView
            value={(value as string) ?? ""}
            placeholder={question.placeholder}
            onChange={onTextChange}
            onContinue={onContinue}
            error={error}
            minChars={question.minChars}
            maxChars={question.maxChars}
            suggestions={
              question.id === "threeMonthGoal"
                ? THREE_MONTH_GOAL_SUGGESTIONS
                : undefined
            }
          />
        )}

        {question.type === "email" && (
          <TextView
            value={(value as string) ?? ""}
            placeholder={question.placeholder}
            onChange={onTextChange}
            onContinue={onContinue}
            error={error}
            type="email"
            maxLength={question.maxChars}
            required={question.required}
          />
        )}

        {question.type === "country" && (
          <div className="space-y-3">
            <CountrySelect value={(value as string) ?? ""} onChange={onCountry} />
            {error && <ErrorNote>{error}</ErrorNote>}
            <RebootButton
              size="lg"
              className="group w-full"
              onClick={onContinue}
              disabled={!value}
            >
              Continuer
              <CtaArrow />
            </RebootButton>
          </div>
        )}
      </div>
    </div>
  );
}
