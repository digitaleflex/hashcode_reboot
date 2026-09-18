"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  Send,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionStateBadge } from "./SessionStateBadge";

/**
 * Vue détaillée d'une séance — le cœur du cycle pédagogique :
 * soumission → review → feedback → correction → resoumission ; quiz →
 * tentative → score → repasse.
 *
 * Toutes les données viennent de GET /api/workshops/sessions/[id] (#85) :
 * états, éligibilité et scores sont calculés SERVEUR. Les réponses
 * correctes du quiz ne quittent jamais le serveur (l'API n'expose pas
 * perQuestion volontairement) : l'écran affiche le score, jamais les
 * bonnes réponses.
 */

interface Review {
  id: string;
  decision: string;
  feedback: string | null;
  reviewer: string;
  createdAt: string;
}

interface Submission {
  id: string;
  attempt: number;
  content: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviews: Review[];
}

interface QuizData {
  id: string;
  title: string;
  passThreshold: number;
  maxAttempts: number | null;
  isRequired: boolean;
  questions: {
    id: string;
    order: number;
    type: string;
    prompt: string;
    options: string[];
    points: number;
  }[];
  myAttempts: { id: string; score: number; passed: boolean; submittedAt: string }[];
  canAttempt: boolean;
}

interface SessionData {
  session: {
    id: string;
    number: number;
    title: string;
    objective: string | null;
    program: string | null;
    skills: string;
    state: string;
  };
  activities: {
    id: string;
    order: number;
    kind: string;
    title: string;
    description: string | null;
    url: string | null;
  }[];
  deliverable: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    isRequired: boolean;
  } | null;
  quiz: QuizData | null;
  mySubmissions: Submission[];
}

const SUBMISSION_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "En attente de review", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  IN_REVIEW: { label: "En review", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  APPROVED: { label: "Approuvé", className: "bg-lime/10 text-lime border-lime/30" },
  REVISION: { label: "Correction demandée", className: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  REJECTED: { label: "Rejeté", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  url: "Lien",
  github_repo: "Repo GitHub",
  pull_request: "Pull Request",
  project: "Projet",
  deployed_url: "Site déployé",
  screenshot: "Capture",
  text: "Texte",
};

function isUrlDeliverable(type: string): boolean {
  return ["url", "github_repo", "pull_request", "project", "deployed_url", "screenshot"].includes(type);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionDetailView({ slug, sessionId }: { slug: string; sessionId: string }) {
  const [data, setData] = React.useState<SessionData | null>(null);
  const [error, setError] = React.useState<{ status: number; code: string; message: string } | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(
    async (signal: AbortSignal) => {
      try {
        const res = await fetch(`/api/workshops/sessions/${sessionId}`, {
          cache: "no-store",
          signal,
        });
        const json = (await res.json().catch(() => null)) as
          | (SessionData & { error?: string; code?: string })
          | null;
        if (!res.ok) {
          setError({
            status: res.status,
            code: json?.code ?? "ERROR",
            message: json?.error ?? "Impossible de charger la séance.",
          });
          setData(null);
        } else if (json) {
          setData(json as SessionData);
          setError(null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError({ status: 0, code: "NETWORK", message: "Connexion interrompue — recharge la page." });
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const reload = React.useCallback(async () => {
    const ctrl = new AbortController();
    await load(ctrl.signal);
  }, [load]);

  // ── États bloquants — venus du serveur, jamais devinés ──
  if (error) {
    if (error.code === "SESSION_LOCKED") {
      return (
        <LockScreen
          slug={slug}
          message="Cette séance est encore verrouillée. Complète la séance précédente pour la débloquer."
        />
      );
    }
    if (error.code === "NOT_ENROLLED") {
      return (
        <LockScreen
          slug={slug}
          message="Inscris-toi à l'atelier pour accéder à cette séance."
          cta
        />
      );
    }
    if (error.status === 404) {
      return <LockScreen slug={slug} message="Séance introuvable." />;
    }
    return <ErrorScreen message={error.message} slug={slug} />;
  }

  if (loading || !data) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  return <SessionContent data={data} slug={slug} sessionId={sessionId} reload={reload} />;
}

// ── Écrans bloquants ─────────────────────────────────────────────────────────

function LockScreen({ slug, message, cta }: { slug: string; message: string; cta?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl w-full px-5 sm:px-8 py-16 text-center space-y-4">
      <Lock className="size-10 text-muted-foreground/40 mx-auto" />
      <p className="text-muted-foreground">{message}</p>
      {cta && (
        <Link
          href={`/dashboard/ateliers/${slug}`}
          className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2.5 text-sm font-medium text-background"
        >
          Rejoindre l'atelier
        </Link>
      )}
      <Link
        href={`/dashboard/ateliers/${slug}`}
        className="block text-xs text-muted-foreground hover:text-foreground underline"
      >
        Retour au parcours
      </Link>
    </div>
  );
}

function ErrorScreen({ message, slug }: { message: string; slug: string }) {
  return (
    <div className="mx-auto max-w-2xl w-full px-5 sm:px-8 py-16 text-center space-y-4">
      <p className="text-sm text-red-400">{message}</p>
      <Link
        href={`/dashboard/ateliers/${slug}`}
        className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Retour au parcours
      </Link>
    </div>
  );
}

// ── Contenu principal ────────────────────────────────────────────────────────

function SessionContent({
  data,
  slug,
  sessionId,
  reload,
}: {
  data: SessionData;
  slug: string;
  sessionId: string;
  reload: () => Promise<void>;
}) {
  const { session, activities, deliverable, quiz, mySubmissions } = data;

  let skills: string[] = [];
  try {
    const parsed = JSON.parse(session.skills);
    if (Array.isArray(parsed)) skills = parsed.map((s) => String(s));
  } catch {
    skills = [];
  }

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-8">
      <Link
        href={`/dashboard/ateliers/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Retour au parcours
      </Link>

      <header className="space-y-2">
        <p className="mono-label text-xs text-muted-foreground">
          SÉANCE {String(session.number).padStart(2, "0")}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display font-bold text-2xl tracking-tight">{session.title}</h1>
          <SessionStateBadge state={session.state} />
        </div>
        {session.objective && (
          <p className="text-sm text-muted-foreground max-w-2xl">{session.objective}</p>
        )}
      </header>

      {session.program && (
        <section className="rounded-md border border-border/60 bg-card/40 p-5 space-y-2">
          <h2 className="font-display font-bold text-base tracking-tight">Au programme</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{session.program}</p>
          {skills.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <Tag className="size-3 text-muted-foreground" />
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {activities.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display font-bold text-base tracking-tight">Activités</h2>
          <ol className="space-y-2">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="flex gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-3"
              >
                <span className="mono-label text-xs text-muted-foreground pt-1 w-6 shrink-0">
                  {activity.order + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{activity.title}</span>
                    {activity.kind === "resource" && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        Ressource
                      </span>
                    )}
                  </div>
                  {activity.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                  )}
                  {activity.url && (
                    <a
                      href={activity.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-lime mt-1 hover:underline"
                    >
                      Ouvrir la ressource
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {deliverable && (
        <SubmissionSection
          sessionId={sessionId}
          deliverable={deliverable}
          submissions={mySubmissions}
          reload={reload}
        />
      )}

      {data.quiz && <QuizSection quiz={data.quiz} reload={reload} />}
    </div>
  );
}

// ── Livrable : historique + formulaire ───────────────────────────────────────

function SubmissionSection({
  sessionId,
  deliverable,
  submissions,
  reload,
}: {
  sessionId: string;
  deliverable: { id: string; type: string; title: string; description: string | null; isRequired: boolean };
  submissions: Submission[];
  reload: () => Promise<void>;
}) {
  const latest = submissions[0] ?? null;
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const urlType = isUrlDeliverable(deliverable.type);
  const blockedReason =
    latest?.status === "PENDING" || latest?.status === "IN_REVIEW"
      ? "Ta soumission est en attente de review."
      : latest?.status === "APPROVED"
        ? "Ce livrable est approuvé — rien d'autre à soumettre."
        : null;

  async function submit() {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workshops/sessions/${sessionId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? "Impossible d'enregistrer la soumission.");
        setLoading(false);
        return;
      }
      setContent("");
      await reload();
    } catch {
      setError("Connexion interrompue — ta soumission n'a pas été envoyée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2 flex-wrap">
        <h2 className="font-display font-bold text-base tracking-tight">Livrable</h2>
        {!deliverable.isRequired && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            Facultatif
          </span>
        )}
      </header>
      <div className="rounded-md border border-border/60 bg-card/40 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium">{deliverable.title}</p>
          {deliverable.description && (
            <p className="text-sm text-muted-foreground mt-1">{deliverable.description}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 mono-label">
            TYPE ATTENDU : {DELIVERABLE_TYPE_LABELS[deliverable.type] ?? deliverable.type}
          </p>
        </div>

        {/* Historique — append-only, la dernière tentative fait foi */}
        {submissions.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="mono-label text-[11px] text-muted-foreground">HISTORIQUE</p>
            {submissions.map((sub) => {
              const label =
                SUBMISSION_LABELS[sub.status] ??
                { label: sub.status, className: "bg-secondary text-muted-foreground border-border/60" };
              const review = sub.reviews[0] ?? null;
              return (
                <div
                  key={sub.id}
                  className="rounded-md border border-border/60 bg-background/40 px-4 py-3 space-y-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        label.className,
                      )}
                    >
                      {label.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Tentative #{sub.attempt} · {formatDate(sub.submittedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {urlType ? (
                      <a
                        href={sub.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lime hover:underline break-all"
                      >
                        {sub.content}
                      </a>
                    ) : (
                      <span className="break-words">{sub.content}</span>
                    )}
                  </p>
                  {review && review.feedback && (
                    <div className="rounded-md bg-secondary/60 px-3 py-2 text-xs">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Feedback</span> ·{" "}
                        {review.reviewer !== "unknown" ? review.reviewer : "Reviewer"} ·{" "}
                        {formatDate(review.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{review.feedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {blockedReason ? (
          <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0" />
            {blockedReason}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground mono-label">
              {latest ? "RE-SOUMETTRE (correction)" : "SOUMETTRE TON LIVRABLE"}
            </label>
            {urlType ? (
              <input
                type="url"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30"
              />
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Ton livrable…"
                className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 resize-y"
              />
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={submit}
              disabled={loading || !content.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-medium text-background transition-colors cursor-pointer",
                (loading || !content.trim()) && "opacity-60 cursor-not-allowed",
              )}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {latest ? "Resoumettre" : "Soumettre"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

function QuizSection({ quiz, reload }: { quiz: QuizData; reload: () => Promise<void> }) {
  const [answers, setAnswers] = React.useState<(number | number[] | null)[]>(() =>
    Array.from({ length: quiz.questions.length }, () => null),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ score: number; total: number; percent: number; passed: boolean } | null>(null);

  const allAnswered = answers.every((a) => a !== null && (Array.isArray(a) ? a.length > 0 : true));
  const bestPassed = quiz.myAttempts.some((a) => a.passed);

  async function submit() {
    if (!allAnswered) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workshops/quizzes/${quiz.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        attempt?: { score: number; total: number; percent: number; passed: boolean };
        error?: string;
      } | null;
      if (!res.ok || !json?.attempt) {
        setError(json?.error ?? "Impossible d'enregistrer la tentative.");
        setLoading(false);
        return;
      }
      setResult({
        score: json.attempt.score,
        total: json.attempt.total,
        percent: json.attempt.percent,
        passed: json.attempt.passed,
      });
      await reload();
    } catch {
      setError("Connexion interrompue — ta tentative n'a pas été envoyée.");
    } finally {
      setLoading(false);
    }
  }

  function setSingle(index: number, value: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function toggleMultiple(index: number, value: number) {
    setAnswers((prev) => {
      const next = [...prev];
      const current = Array.isArray(next[index]) ? ([...(next[index] as number[])]) : [];
      const pos = current.indexOf(value);
      if (pos >= 0) current.splice(pos, 1);
      else current.push(value);
      next[index] = current;
      return next;
    });
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2 flex-wrap">
        <h2 className="font-display font-bold text-base tracking-tight">{quiz.title}</h2>
        {!quiz.isRequired && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            Facultatif
          </span>
        )}
      </header>
      <div className="rounded-md border border-border/60 bg-card/40 p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Seuil de réussite : {quiz.passThreshold}% ·{" "}
          {quiz.maxAttempts === null
            ? "Tentatives illimitées"
            : `Max ${quiz.maxAttempts} tentative${quiz.maxAttempts > 1 ? "s" : ""}`}
        </p>

        {/* Dernier résultat / meilleur score */}
        {result && (
          <div
            className={cn(
              "rounded-md px-4 py-3 text-sm",
              result.passed
                ? "bg-lime/10 border border-lime/30 text-lime"
                : "bg-orange-500/10 border border-orange-500/30 text-orange-400",
            )}
          >
            {result.passed
              ? `Quiz réussi — ${result.score}/${result.total} points (${result.percent}%).`
              : `Score : ${result.score}/${result.total} points (${result.percent}%). Tu peux retenter.`}
          </div>
        )}
        {!result && bestPassed && (
          <div className="flex items-center gap-2 rounded-md bg-lime/10 border border-lime/30 px-4 py-3 text-sm text-lime">
            <CheckCircle2 className="size-4 shrink-0" />
            Quiz réussi
          </div>
        )}

        {/* Questions — options SEULEMENT : les réponses correctes restent serveur */}
        {!quiz.canAttempt && !bestPassed ? (
          <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" />
            Nombre maximum de tentatives atteint.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            {quiz.questions.map((q, index) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium">
                  {index + 1}. {q.prompt}
                </p>
                <div className="space-y-1.5 pl-1">
                  {q.type === "multiple"
                    ? q.options.map((option, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={Array.isArray(answers[index]) && (answers[index] as number[]).includes(optIdx)}
                            onChange={() => toggleMultiple(index, optIdx)}
                            className="size-4 rounded border-border/60 bg-background accent-lime"
                          />
                          {option}
                        </label>
                      ))
                    : q.options.map((option, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-3 text-muted-foreground cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[index] === optIdx}
                            onChange={() => setSingle(index, optIdx)}
                            className="size-4 accent-lime"
                          />
                          <span className="text-sm">{option}</span>
                        </label>
                      ))}
                </div>
              </div>
            ))}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !allAnswered}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-medium text-background transition-colors cursor-pointer",
                (loading || !allAnswered) && "opacity-60 cursor-not-allowed",
              )}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
              {loading ? "Correction…" : "Valider mes réponses"}
            </button>
            {!allAnswered && (
              <p className="text-[11px] text-muted-foreground">
                Réponds à toutes les questions pour valider.
              </p>
            )}
          </form>
        )}

        {/* Historique des tentatives */}
        {quiz.myAttempts.length > 0 && (
          <div className="border-t border-border/60 pt-3 space-y-1">
            <p className="mono-label text-[11px] text-muted-foreground">MES TENTATIVES</p>
            {quiz.myAttempts.slice(0, 5).map((attempt) => (
              <p key={attempt.id} className="text-xs text-muted-foreground">
                {formatDate(attempt.submittedAt)} · {attempt.score} points ·{" "}
                {attempt.passed ? (
                  <span className="text-lime">Réussi</span>
                ) : (
                  <span className="text-orange-400">Insuffisant</span>
                )}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
