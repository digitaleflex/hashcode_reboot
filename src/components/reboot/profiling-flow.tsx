"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import {
  QUESTIONS,
  getQuestionOptions,
} from "@/lib/profiling/questions";
import {
  getVisibleQuestions,
  getProgress,
  validateAnswer,
  generateProfile,
} from "@/lib/profiling/engine";
import type { ProfileAnswers, Question } from "@/lib/profiling/types";
import { track } from "@/lib/analytics";
import { RebootButton, CtaArrow, MonoLabel } from "./shared";
import { HashSymbol } from "@/components/brand/logo";
import { OptionCard, MultiOptionCard } from "./option-card";
import { CountrySelect } from "./country-select";
import { ProfileCard } from "./profile-card";

const STORAGE_KEY = "hashcode:reboot:profiling";

interface PersistedState {
  answers: ProfileAnswers;
  answeredIds: string[];
  step: number; // index within visible list at save time
}

export function ProfilingFlow({
  onComplete,
  onBack,
}: {
  onComplete: (answers: ProfileAnswers) => void;
  onBack: () => void;
}) {
  const [answers, setAnswers] = React.useState<ProfileAnswers>({
    firstName: "",
    email: "",
    country: "",
  });
  const [answeredIds, setAnsweredIds] = React.useState<string[]>([]);
  const [step, setStep] = React.useState(0); // index into visible list
  const [direction, setDirection] = React.useState(1);
  const [hydrated, setHydrated] = React.useState(false);
  const [hasResume, setHasResume] = React.useState(false);
  const [showResumePrompt, setShowResumePrompt] = React.useState(false);
  const [phase, setPhase] = React.useState<"questions" | "preview">("questions");
  const [localError, setLocalError] = React.useState<string | null>(null);

  // --- Hydrate from localStorage on mount (resume support) ---
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed?.answers && Array.isArray(parsed.answeredIds)) {
          setAnswers(parsed.answers);
          setAnsweredIds(parsed.answeredIds);
          setStep(parsed.step ?? 0);
          setHasResume(true);
          setShowResumePrompt(true);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  // --- Persist to localStorage (only non-sensitive profiling answers) ---
  React.useEffect(() => {
    if (!hydrated) return;
    if (answeredIds.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data: PersistedState = { answers, answeredIds, step };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / disabled */
    }
  }, [answers, answeredIds, step, hydrated]);

  const visible = React.useMemo(
    () => getVisibleQuestions(answers),
    [answers],
  );
  const answeredSet = React.useMemo(() => new Set(answeredIds), [answeredIds]);
  const progress = React.useMemo(
    () => getProgress(answers, answeredSet),
    [answers, answeredSet],
  );

  // Current question. When step >= visible.length, all questions are done → current is
  // undefined, which the auto-finish effect uses to submit the profile.
  const current = step < visible.length ? visible[step] : undefined;

  function setAnswer(q: Question, value: unknown) {
    setAnswers((prev) => ({ ...prev, [q.mapsTo]: value as never }));
  }

  function markAnswered(q: Question) {
    setAnsweredIds((prev) => (prev.includes(q.id) ? prev : [...prev, q.id]));
  }

  function advance(q: Question, value?: unknown) {
    if (value !== undefined) setAnswer(q, value);
    markAnswered(q);
    setLocalError(null);

    // Strategic interlude: after threeMonthGoal → show profile preview before contact.
    if (q.id === "threeMonthGoal") {
      setPhase("preview");
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, visible.length));
  }

  function goBack() {
    if (phase === "preview") {
      setPhase("questions");
      return;
    }
    if (step === 0) {
      onBack();
      return;
    }
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
    setLocalError(null);
  }

  function resume() {
    setShowResumePrompt(false);
  }
  function restart() {
    localStorage.removeItem(STORAGE_KEY);
    setAnswers({ firstName: "", lastName: "", email: "", phone: "", country: "", city: "" });
    setAnsweredIds([]);
    setStep(0);
    setPhase("questions");
    setShowResumePrompt(false);
    setHasResume(false);
  }

  // --- Submit once all required visible questions are answered ---
  function maybeFinish() {
    const allRequiredAnswered = visible.every(
      (q) => !q.required || answeredSet.has(q.id),
    );
    if (allRequiredAnswered) {
      // Clear local storage after successful completion.
      localStorage.removeItem(STORAGE_KEY);
      onComplete(answers);
    } else {
      // Some required question wasn't answered — find the first unanswered
      // required question and jump back to it instead of staying stuck.
      const firstUnanswered = visible.find(
        (q) => q.required && !answeredSet.has(q.id),
      );
      if (firstUnanswered) {
        const idx = visible.indexOf(firstUnanswered);
        setStep(idx);
      }
    }
  }

  // Auto-finish if the last answer completed the flow.
  React.useEffect(() => {
    if (phase !== "questions") return;
    if (!hydrated || showResumePrompt) return;
    if (!current) {
      maybeFinish();
    }
  }, [current, phase, hydrated, showResumePrompt]);

  // --- Resume prompt (first interaction) ---
  if (hydrated && showResumePrompt) {
    return (
      <ResumePrompt
        onResume={resume}
        onRestart={restart}
        progress={progress}
        answeredCount={answeredIds.length}
      />
    );
  }

  // --- Profile preview interlude ---
  if (phase === "preview") {
    const gen = generateProfile(answers);
    return (
      <ProfilingShell
        progress={0.98}
        onBack={goBack}
        stepLabel="Ton profil HASHCODE est prêt"
        group="vision"
      >
        <div className="animate-hash-in">
          <div className="max-w-xl mx-auto text-center">
            <HashSymbol className="mx-auto text-lime" size={40} />
            <h2 className="mt-5 font-display font-bold text-2xl sm:text-3xl tracking-tight">
              Ton profil HASHCODE est prêt.
            </h2>
            <p className="mt-2 text-muted-foreground">
              Voici la première orientation qu&apos;on tire de tes réponses.
            </p>
          </div>
          <div className="mt-8 max-w-md mx-auto">
            <ProfileCard profile={gen} goal={answers.threeMonthGoal} />
          </div>
          <div className="mt-8 max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <RebootButton
              size="lg"
              className="group w-full"
              onClick={() => {
                setPhase("questions");
                setDirection(1);
                // Next question after preview is email (first contact question).
                const emailIdx = visible.findIndex((q) => q.id === "email");
                if (emailIdx >= 0) setStep(emailIdx);
              }}
            >
              Continuer
              <CtaArrow />
            </RebootButton>
            <RebootButton
              size="lg"
              variant="outline"
              onClick={goBack}
              className="w-full sm:w-auto whitespace-nowrap"
            >
              <ArrowLeft className="size-4 shrink-0" /> Modifier mes réponses
            </RebootButton>
          </div>
          <p className="mt-6 max-w-md mx-auto text-center text-xs text-muted-foreground">
            Plus que tes coordonnées pour t&apos;envoyer ton accès. On n&apos;y
            touche pas plus.
          </p>
        </div>
      </ProfilingShell>
    );
  }

  if (!current) {
    // All done — show a transition state while maybeFinish fires.
    // Previously returned null which caused a brief black screen.
    return (
      <ProfilingShell
        progress={1}
        onBack={goBack}
        stepLabel="Finalisation…"
      >
        <div className="text-center animate-hash-in">
          <div className="relative inline-flex">
            <HashSymbol className="text-lime" size={36} />
            <span className="absolute inset-0 animate-hash-sweep rounded-sm overflow-hidden" />
          </div>
          <h2 className="mt-5 font-display font-bold text-lg text-foreground">
            On finalise ton profil…
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Une seconde.
          </p>
        </div>
      </ProfilingShell>
    );
  }

  return (
    <ProfilingShell
      progress={progress}
      onBack={goBack}
      stepLabel={current.group === "contact" ? "Coordonnées" : "Ton profil HASHCODE"}
      microcopy={current.microcopy}
      group={current.group}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={current.id}
          custom={direction}
          initial={{ opacity: 0, x: direction * 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -16 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <QuestionView
            question={current}
            answers={answers}
            value={answers[current.mapsTo]}
            error={localError}
            onSingle={(v) => {
              track({ type: "profiling_question_answered", ref: current.id });
              advance(current, v);
            }}
            onMultiToggle={(v) => {
              const cur = (answers[current.mapsTo] as string[]) ?? [];
              const next = cur.includes(v)
                ? cur.filter((x) => x !== v)
                : [...cur, v];
              setAnswer(current, next);
            }}
            onTextChange={(v) => setAnswer(current, v)}
            onCountry={(v) => setAnswer(current, v)}
            onContinue={() => {
              const v = answers[current.mapsTo];
              const err = validateAnswer(current, v);
              if (err) {
                setLocalError(err);
                return;
              }
              if (!answeredSet.has(current.id)) {
                markAnswered(current);
                track({ type: "profiling_question_answered", ref: current.id });
              }
              advance(current);
            }}
          />
        </motion.div>
      </AnimatePresence>
    </ProfilingShell>
  );
}

/* ------------------------------------------------------------------ */
/* Shell: nav + progress + back                                        */
/* ------------------------------------------------------------------ */

function ProfilingShell({
  children,
  progress,
  onBack,
  stepLabel,
  microcopy,
  group,
}: {
  children: React.ReactNode;
  progress: number;
  onBack: () => void;
  stepLabel: string;
  microcopy?: string;
  group?: string;
}) {
  const MILESTONES: { key: string; label: string }[] = [
    { key: "profil", label: "Profil" },
    { key: "objectifs", label: "Objectif" },
    { key: "rythme", label: "Rythme" },
    { key: "mentorat", label: "Mentorat" },
    { key: "vision", label: "Vision" },
    { key: "contact", label: "Contact" },
  ];
  const activeIdx = group ? MILESTONES.findIndex((m) => m.key === group) : -1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-2xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Retour</span>
          </button>
          <MonoLabel>{stepLabel}</MonoLabel>
          <span className="text-xs text-muted-foreground mono-label tabular-nums flex items-center gap-2">
            <span>~{Math.max(1, Math.round((1 - progress) * 120))}s restantes</span>
            <span className="text-border">·</span>
            <span>{Math.round(progress * 100)}%</span>
          </span>
        </div>
        <div className="h-0.5 bg-border">
          <div
            className="h-full bg-lime transition-[width] duration-320 ease-out"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
        {/* Milestone group indicator — subtle stage tracker */}
        {activeIdx >= 0 && (
          <div className="mx-auto max-w-2xl px-5 sm:px-8 py-2 flex items-center gap-1.5 overflow-x-auto scroll-slim">
            {MILESTONES.map((m, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              return (
                <React.Fragment key={m.key}>
                  <span
                    className={cn(
                      "mono-label whitespace-nowrap transition-colors",
                      active
                        ? "text-lime"
                        : done
                          ? "text-muted-foreground"
                          : "text-border",
                    )}
                  >
                    {m.label}
                  </span>
                  {i < MILESTONES.length - 1 && (
                    <span
                      className={cn(
                        "h-px w-3 shrink-0 transition-colors",
                        done ? "bg-muted-foreground/40" : "bg-border",
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-5 sm:px-8 py-10 sm:py-16">
        <div className="w-full max-w-2xl">
          {microcopy && (
            <p className="mb-5 text-center text-sm text-lime font-display italic animate-hash-in">
              {microcopy}
            </p>
          )}
          {children}
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-2xl px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Tes réponses servent à mieux comprendre ton profil.
          </p>
          {/* Keyboard shortcut hint — only on single-choice questions */}
          {group && group !== "contact" && group !== "vision" && (
            <span className="text-xs text-muted-foreground mono-label flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center size-4 rounded-sm border border-border bg-card text-[9px] font-mono">1</kbd>
              <span>–</span>
              <kbd className="inline-flex items-center justify-center size-4 rounded-sm border border-border bg-card text-[9px] font-mono">9</kbd>
              <span className="hidden sm:inline">pour choisir</span>
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resume prompt                                                       */
/* ------------------------------------------------------------------ */

function ResumePrompt({
  onResume,
  onRestart,
  progress,
  answeredCount,
}: {
  onResume: () => void;
  onRestart: () => void;
  progress: number;
  answeredCount: number;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-2xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <MonoLabel>Ton profil HASHCODE</MonoLabel>
          <span className="text-xs text-muted-foreground mono-label">
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div className="h-0.5 bg-border">
          <div
            className="h-full bg-lime"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-5 sm:px-8">
        <div className="w-full max-w-md text-center animate-hash-in">
          <HashSymbol className="mx-auto text-lime" size={40} />
          <h2 className="mt-5 font-display font-bold text-2xl tracking-tight">
            Ton profil est toujours là.
          </h2>
          <p className="mt-2 text-muted-foreground">
            Tu as déjà répondu à {answeredCount} question
            {answeredCount > 1 ? "s" : ""}. Tu peux reprendre là où tu
            t&apos;étais arrêté.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <RebootButton size="lg" className="group w-full sm:w-auto" onClick={onResume}>
              Reprendre
              <CtaArrow />
            </RebootButton>
            <RebootButton size="lg" variant="outline" onClick={onRestart}>
              <RotateCcw className="size-4" /> Recommencer
            </RebootButton>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-question view                                                   */
/* ------------------------------------------------------------------ */

function QuestionView({
  question,
  answers,
  value,
  error,
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
  onSingle: (v: string) => void;
  onMultiToggle: (v: string) => void;
  onTextChange: (v: string) => void;
  onCountry: (v: string) => void;
  onContinue: () => void;
}) {
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

function MultiChoiceView({
  options,
  selected,
  onToggle,
  onContinue,
  required,
}: {
  options: { value: string; label: string; emoji?: string; description?: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  onContinue: () => void;
  required: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map((o) => (
          <MultiOptionCard
            key={o.value}
            option={o}
            selected={selected.includes(o.value)}
            onToggle={onToggle}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-muted-foreground">
          {selected.length > 0
            ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}`
            : required
              ? "Choisis au moins une option"
              : "Facultatif — tu peux passer"}
        </span>
        <RebootButton
          size="md"
          className="group"
          onClick={onContinue}
          disabled={required && selected.length === 0}
        >
          {selected.length > 0 ? "Continuer" : required ? "Continuer" : "Passer"}
          <CtaArrow />
        </RebootButton>
      </div>
    </div>
  );
}

function TextView({
  value,
  placeholder,
  onChange,
  onContinue,
  error,
  type = "text",
  maxLength,
  required,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  error: string | null;
  type?: "text" | "email";
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <div className="space-y-3">
      <input
        type={type}
        value={value}
        autoFocus
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onContinue();
          }
        }}
        className={cn(
          "w-full h-14 rounded-md border bg-card px-4 text-base sm:text-lg text-foreground placeholder:text-muted-foreground transition-colors duration-180 focus-lime",
          error ? "border-destructive" : "border-border focus:border-lime",
        )}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center justify-between gap-3">
        {!required && <span className="text-xs text-muted-foreground">Facultatif</span>}
        <RebootButton
          size="lg"
          className="group w-full"
          onClick={onContinue}
          disabled={required ? !value.trim() : false}
        >
          {value.trim() || required ? "Continuer" : "Passer"}
          <CtaArrow />
        </RebootButton>
      </div>
    </div>
  );
}

function LongTextView({
  value,
  placeholder,
  onChange,
  onContinue,
  error,
  minChars,
  maxChars,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  error: string | null;
  minChars?: number;
  maxChars?: number;
}) {
  const len = value.trim().length;
  return (
    <div className="space-y-3">
      <textarea
        value={value}
        autoFocus
        rows={3}
        placeholder={placeholder}
        maxLength={maxChars}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-md border bg-card px-4 py-3 text-base sm:text-lg text-foreground placeholder:text-muted-foreground transition-colors duration-180 focus-lime resize-none leading-relaxed",
          error ? "border-destructive" : "border-border focus:border-lime",
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
            ? `Encore ${minChars - len} caractères`
            : "Une phrase suffit."}
        </span>
        {maxChars && (
          <span className="mono-label text-muted-foreground">
            {len}/{maxChars}
          </span>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <RebootButton
        size="lg"
        className="group w-full"
        onClick={onContinue}
        disabled={!value.trim()}
      >
        Continuer
        <CtaArrow />
      </RebootButton>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-destructive animate-hash-in" role="alert">
      {children}
    </p>
  );
}
