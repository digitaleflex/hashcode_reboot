"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
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

export function ProfilingFlow({
  onComplete,
  onBack,
}: {
  onComplete: (answers: ProfileAnswers) => void;
  onBack: () => void;
}) {
  const [answers, setAnswers] = React.useState<ProfileAnswers>(initialAnswers);
  const [answeredIds, setAnsweredIds] = React.useState<string[]>([]);
  const [step, setStep] = React.useState(0); // index into visible list
  const [direction, setDirection] = React.useState(1);
  const [hydrated, setHydrated] = React.useState(false);
  const [hasResume, setHasResume] = React.useState(false);
  const [showResumePrompt, setShowResumePrompt] = React.useState(false);
  const [phase, setPhase] = React.useState<"questions" | "preview">("questions");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState(false);
  // Vérification email : lien magique 1-clic envoyé à la fin (POST /api/members).
  // L'email est collecté en Q2 sans bloquer — plus d'interruption OTP.
  const lastQuestionRef = React.useRef<string | null>(null);

  // --- Hydrate from localStorage on mount (resume support) ---
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
            setHasResume(true);
            setShowResumePrompt(true);
            if (parsed.answers.email && parsed.answers.email.trim().length > 0) {
              setDuplicate(true);
            }
          }
        }
      } catch {
        /* ignore corrupt storage */
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Confirmation de sortie (beforeunload) + drop-off tracking ---
  React.useEffect(() => {
    if (!hydrated || answeredIds.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Tu es sûr de vouloir quitter ?";
      if (lastQuestionRef.current) {
        track({ type: "profiling_abandoned", ref: lastQuestionRef.current });
        saveDraftBeacon(answers, lastQuestionRef.current);
      }
      return "Tes réponses sont sauvegardées, tu peux reprendre plus tard.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hydrated, answeredIds.length, answers, lastQuestionRef]);

  // Track drop-off on visibility change (tab switch / mobile background)
  React.useEffect(() => {
    if (!hydrated || answeredIds.length === 0) return;
    let lastHiddenAt = 0;
    const handler = () => {
      if (document.visibilityState === "hidden" && lastQuestionRef.current) {
        // Debounce: don't fire twice for a quick tab switch within 5s.
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
  }, [hydrated, answeredIds.length, answers, lastQuestionRef]);

  // --- Persist to localStorage (encrypted, resume support) ---
  React.useEffect(() => {
    if (!hydrated) return;
    if (answeredIds.length === 0) {
      void removeEncryptedItem(STORAGE_KEY);
      return;
    }
    const data: PersistedState = { answers, answeredIds, step };
    void setEncryptedItem(STORAGE_KEY, JSON.stringify(data));
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

  // Track the last question shown for drop-off analytics.
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

    // Time-per-question: report how long the user spent on THIS question.
    // Capped at 10 min to ignore tabs left open in the background.
    if (questionStartRef.current > 0) {
      const durationMs = Date.now() - questionStartRef.current;
      if (durationMs > 0 && durationMs < 10 * 60 * 1000) {
        track({ type: "profiling_question_timed", ref: q.id, value: Math.round(durationMs) });
      }
    }

    // Après l'email (Q2) → on avance direct, sans bloquer.
    // La vérification se fait à la fin par lien magique 1-clic.
    if (q.id === "email") {
      setDirection(1);
      setStep((s) => Math.min(s + 1, visible.length));
      return;
    }

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
    void removeEncryptedItem(STORAGE_KEY);
    setAnswers(initialAnswers());
    setAnsweredIds([]);
    setStep(0);
    setPhase("questions");
    setShowResumePrompt(false);
    setHasResume(false);
    setDuplicate(false);
  }

  // --- Submit once all required visible questions are answered ---
  // Plus de blocage OTP : on soumet direct, le lien magique part à la fin (POST /api/members).
  function maybeFinish() {
    const allRequiredAnswered = visible.every(
      (q) => !q.required || answeredSet.has(q.id),
    );
    if (allRequiredAnswered) {
      // Clear local storage after successful completion.
      void removeEncryptedItem(STORAGE_KEY);
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
        duplicate={duplicate}
      />
    );
  }

  // --- Profile preview interlude ---
  if (phase === "preview") {
    return (
      <ProfilePreview
        answers={answers}
        onFinalize={() => {
          setPhase("questions");
          setDirection(1);
          // La partie Contact (WhatsApp) a été retirée de l'inscription :
          // on défile au-delà de la dernière question, ce qui déclenche
          // l'envoi du profil via l'effet d'auto-finalisation.
          setStep(visible.length);
        }}
        onEdit={goBack}
      />
    );
  }

  if (!current) {
    // All done — show a transition state while maybeFinish fires.
    // Previously returned null which caused a brief black screen.
    return <FinalizingState onBack={goBack} />;
  }

  return (
    <ProfilingShell
      progress={progress}
      onBack={goBack}
      stepLabel="Ton profil HASHCODE"
      microcopy={current.microcopy}
      group={current.group}
      showCompletionIndicator
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
