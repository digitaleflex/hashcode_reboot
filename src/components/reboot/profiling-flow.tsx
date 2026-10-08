"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  getVisibleQuestions,
  getProgress,
  validateAnswer,
} from "@/lib/profiling/engine";
import type { ProfileAnswers, Question } from "@/lib/profiling/types";
import { track } from "@/lib/analytics";
import { ProfilingShell } from "./profiling/shell";
import { ResumePrompt } from "./profiling/resume-prompt";
import { QuestionView } from "./profiling/question-view";
import { ProfilePreview, FinalizingState } from "./profiling/preview";
import { STORAGE_KEY, initialAnswers, type PersistedState } from "./profiling/storage";
import { saveDraftBeacon } from "./profiling/draft";
import {
  setEncryptedItem,
  getEncryptedItem,
  removeEncryptedItem,
} from "@/lib/storage-crypto";
import { useTranslations } from "next-intl";

function hasAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function getAnsweredQuestionIds(answers: ProfileAnswers): string[] {
  return getVisibleQuestions(answers)
    .filter((q) => hasAnswer(answers[q.mapsTo]))
    .map((q) => q.id);
}

export function ProfilingFlow({
  onComplete,
  onBack,
  initialValues,
}: {
  onComplete: (answers: ProfileAnswers) => void;
  onBack: () => void;
  initialValues?: ProfileAnswers;
}) {
  const t = useTranslations("profiling");
  const [answers, setAnswers] = React.useState<ProfileAnswers>(
    () => initialValues ?? initialAnswers(),
  );
  const [answeredIds, setAnsweredIds] = React.useState<string[]>([]);
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [hydrated, setHydrated] = React.useState(false);
  const [showResumePrompt, setShowResumePrompt] = React.useState(false);
  const [phase, setPhase] = React.useState<"questions" | "preview">("questions");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState(false);
  const lastQuestionRef = React.useRef<string | null>(null);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await getEncryptedItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as PersistedState;
          if (parsed?.answers && Array.isArray(parsed.answeredIds)) {
            setAnswers(parsed.answers);
            setAnsweredIds(parsed.answeredIds);
            setStep(parsed.step ?? 0);
            setShowResumePrompt(true);
            if (parsed.answers.email && parsed.answers.email.trim().length > 0) {
              setDuplicate(true);
            }
          }
        } else if (initialValues && !cancelled) {
          const visibleQuestions = getVisibleQuestions(initialValues);
          const answered = getAnsweredQuestionIds(initialValues);
          const firstUnansweredRequired = visibleQuestions.findIndex(
            (q) => q.required && !answered.includes(q.id),
          );
          setAnsweredIds(answered);
          setStep(firstUnansweredRequired >= 0 ? firstUnansweredRequired : 0);
        }
      } catch {
        if (initialValues && !cancelled) {
          const visibleQuestions = getVisibleQuestions(initialValues);
          const answered = getAnsweredQuestionIds(initialValues);
          const firstUnansweredRequired = visibleQuestions.findIndex(
            (q) => q.required && !answered.includes(q.id),
          );
          setAnsweredIds(answered);
          setStep(firstUnansweredRequired >= 0 ? firstUnansweredRequired : 0);
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialValues]);

  React.useEffect(() => {
    if (!hydrated || answeredIds.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t("flow.beforeUnloadConfirm");
      if (lastQuestionRef.current) {
        track({ type: "profiling_abandoned", ref: lastQuestionRef.current });
        saveDraftBeacon(answers, lastQuestionRef.current);
      }
      return t("flow.beforeUnloadSaveNote");
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hydrated, answeredIds.length, answers, t]);

  React.useEffect(() => {
    if (!hydrated || answeredIds.length === 0) return;
    let lastHiddenAt = 0;
    const handler = () => {
      if (document.visibilityState === "hidden" && lastQuestionRef.current) {
        const now = Date.now();
        if (now - lastHiddenAt > 5000) {
          lastHiddenAt = now;
          track({ type: "profiling_abandoned", ref: lastQuestionRef.current });
          saveDraftBeacon(answers, lastQuestionRef.current);
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [hydrated, answeredIds.length, answers]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (answeredIds.length === 0) {
      void removeEncryptedItem(STORAGE_KEY);
      return;
    }
    const data: PersistedState = { answers, answeredIds, step };
    void setEncryptedItem(STORAGE_KEY, JSON.stringify(data));
  }, [answers, answeredIds, step, hydrated]);

  const visible = React.useMemo(() => getVisibleQuestions(answers), [answers]);
  const answeredSet = React.useMemo(() => new Set(answeredIds), [answeredIds]);
  const progress = React.useMemo(
    () => getProgress(answers, answeredSet),
    [answers, answeredSet],
  );
  const current = step < visible.length ? visible[step] : undefined;
  const questionStartRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (current) {
      lastQuestionRef.current = current.id;
      questionStartRef.current = Date.now();
    }
  }, [current]);

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

    if (questionStartRef.current > 0) {
      const durationMs = Date.now() - questionStartRef.current;
      if (durationMs > 0 && durationMs < 10 * 60 * 1000) {
        track({
          type: "profiling_question_timed",
          ref: q.id,
          value: Math.round(durationMs),
        });
      }
    }

    if (q.id === "email") {
      setDirection(1);
      setStep((s) => Math.min(s + 1, visible.length));
      return;
    }

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
    void removeEncryptedItem(STORAGE_KEY);
    setAnswers(initialAnswers());
    setAnsweredIds([]);
    setStep(0);
    setPhase("questions");
    setShowResumePrompt(false);
    setDuplicate(false);
  }

  function maybeFinish() {
    const allRequiredAnswered = visible.every(
      (q) => !q.required || answeredSet.has(q.id),
    );
    if (allRequiredAnswered) {
      void removeEncryptedItem(STORAGE_KEY);
      onComplete(answers);
    } else {
      const firstUnanswered = visible.find(
        (q) => q.required && !answeredSet.has(q.id),
      );
      if (firstUnanswered) {
        setStep(visible.indexOf(firstUnanswered));
      }
    }
  }

  React.useEffect(() => {
    if (phase !== "questions") return;
    if (!hydrated || showResumePrompt) return;
    if (!current) maybeFinish();
  }, [current, phase, hydrated, showResumePrompt]);

  if (hydrated && showResumePrompt) {
    return (
      <ResumePrompt
        onResume={resume}
        onRestart={restart}
        progress={progress}
        answeredCount={answeredIds.length}
        duplicate={duplicate}
      />
    );
  }

  if (phase === "preview") {
    return (
      <ProfilePreview
        answers={answers}
        onFinalize={() => {
          setPhase("questions");
          setDirection(1);
          setStep(visible.length);
        }}
        onEdit={goBack}
      />
    );
  }

  if (!current) return <FinalizingState onBack={goBack} />;

  return (
    <ProfilingShell
      progress={progress}
      onBack={goBack}
      stepLabel={t("flow.stepLabel")}
      microcopy={current.microcopy}
      group={current.group}
      showCompletionIndicator
      currentStep={step}
      totalSteps={visible.length}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={current.id}
          custom={direction}
          initial={reducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * 16 }}
          animate={reducedMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0, x: 0 } : { opacity: 0, x: direction * -16 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
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
              const err = validateAnswer(current, v, t);
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
