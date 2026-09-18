"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  GraduationCap,
  CalendarDays,
  ListChecks,
  Users,
  FileText,
  Target,
  ExternalLink,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// ── Types (miroir de GET /api/admin/workshops/[id]) ─────────────────────────

interface MemberSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface EnrollmentRow {
  id: string;
  status: string;
  enrolledAt: string;
  member: MemberSummary;
}

interface ActivityRow {
  id: string;
  order: number;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
}

interface DeliverableRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  isRequired: boolean;
}

interface QuizQuestionRow {
  id: string;
  order: number;
  type: string;
  prompt: string;
  optionsJson: string | null;
  correctJson: string | null;
  points: number;
}

interface QuizRow {
  id: string;
  title: string;
  passThreshold: number;
  maxAttempts: number | null;
  isRequired: boolean;
  questions: QuizQuestionRow[];
}

interface SessionStats {
  submissionCounts: Record<string, number>;
  submissionTotal: number;
  quiz: { attemptCount: number; averageScore: number | null };
}

interface SessionRow {
  id: string;
  number: number;
  title: string;
  objective: string | null;
  program: string | null;
  skills: string | null;
  deliverableRequired: boolean;
  quizRequired: boolean;
  eventId: string | null;
  createdAt: string;
  updatedAt: string;
  activities: ActivityRow[];
  deliverable: DeliverableRow | null;
  quiz: QuizRow | null;
  stats: SessionStats;
}

interface WeekRow {
  id: string;
  number: number;
  title: string;
  objective: string | null;
  sessions: SessionRow[];
}

interface ReviewRow {
  id: string;
  reviewer: string;
  decision: string;
  feedback: string | null;
  createdAt: string;
}

interface SubmissionRow {
  id: string;
  deliverableId: string;
  memberId: string;
  attempt: number;
  content: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  member: MemberSummary;
  reviews: ReviewRow[];
}

interface WorkshopDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  domain: string | null;
  level: string | null;
  createdAt: string;
  updatedAt: string;
  weeks: WeekRow[];
  enrollments: EnrollmentRow[];
  submissions: SubmissionRow[];
}

interface DetailResponse {
  workshop: WorkshopDetail;
}

// ── Présentation ────────────────────────────────────────────────────────────

const SUBMISSION_STATUS_VALUES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REVISION",
  "REJECTED",
] as const;

const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  IN_REVIEW: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  APPROVED: "bg-green-500/15 text-green-300 border-green-500/30",
  REVISION: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  REJECTED: "bg-red-500/15 text-red-300 border-red-500/30",
};

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  IN_REVIEW: "En revue",
  APPROVED: "Approuvée",
  REVISION: "Correction",
  REJECTED: "Rejetée",
};

const WORKSHOP_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border/60",
  published: "bg-lime/15 text-lime border-lime/30",
  archived: "bg-muted/40 text-muted-foreground/60 border-border/40",
};

const WORKSHOP_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  completed: "Terminé",
  dropped: "Abandon",
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single: "Choix unique",
  multiple: "Choix multiple",
  true_false: "Vrai / Faux",
};

const ACTIVITY_KIND_LABELS: Record<string, string> = {
  practice: "Pratique",
  resource: "Ressource",
};

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  url: "URL",
  github_repo: "Dépôt GitHub",
  pull_request: "Pull request",
  project: "Projet",
  deployed_url: "Site déployé",
  screenshot: "Capture d'écran",
  text: "Texte",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberName(member: MemberSummary): string {
  return `${member.firstName} ${member.lastName}`.trim() || member.email;
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function parseCorrectIndexes(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) {
      return value.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 0);
    }
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      return [value];
    }
    return [];
  } catch {
    return [];
  }
}

function queryError(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur de chargement.";
}

async function loadWorkshop(id: string): Promise<DetailResponse> {
  const { res, data, code, error, retryAfterSec } = await fetchJson(
    `/api/admin/workshops/${id}`,
    { cache: "no-store" },
  );
  if (res.status === 401 || code === "UNAUTHORIZED") {
    window.location.href = "/admin/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(
      code === "RATE_LIMITED"
        ? withRetryAfter(error ?? "Trop de requêtes.", retryAfterSec)
        : error ?? "Impossible de charger l'atelier.",
    );
  }
  return data as DetailResponse;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 mono-label",
        SUBMISSION_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border/60",
      )}
    >
      {SUBMISSION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function SubmissionContent({ content, type }: { content: string; type: string }) {
  const isUrl = /^https?:\/\//i.test(content);
  if (isUrl) {
    return (
      <a
        href={content}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 break-all text-sm text-lime hover:underline"
      >
        {content}
        <ExternalLink className="size-3 shrink-0" />
      </a>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
      <span className="mono-label text-muted-foreground/60">
        {DELIVERABLE_TYPE_LABELS[type] ?? type} ·{" "}
      </span>
      {content.length > 400 ? `${content.slice(0, 400)}…` : content}
    </p>
  );
}

export default function AdminAtelierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useQuery({
    queryKey: ["admin", "workshops", "detail", id],
    queryFn: () => loadWorkshop(id),
    enabled: Boolean(id),
  });

  const workshop = query.data?.workshop;

  // Livrable → séance : la route détail ne renvoie que deliverableId sur les
  // soumissions, on résout l'ascendance depuis la structure de l'atelier.
  const deliverableIndex = React.useMemo(() => {
    const map = new Map<
      string,
      { number: number; title: string; deliverableTitle: string; deliverableType: string }
    >();
    for (const week of workshop?.weeks ?? []) {
      for (const session of week.sessions) {
        if (session.deliverable) {
          map.set(session.deliverable.id, {
            number: session.number,
            title: session.title,
            deliverableTitle: session.deliverable.title,
            deliverableType: session.deliverable.type,
          });
        }
      }
    }
    return map;
  }, [workshop]);

  const quizSessions = React.useMemo(
    () =>
      (workshop?.weeks ?? [])
        .flatMap((week) => week.sessions)
        .filter((session) => session.quiz !== null),
    [workshop],
  );

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (query.isError || !workshop) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/ateliers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour aux ateliers
        </Link>
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {query.isError ? queryError(query.error) : "Atelier introuvable."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/ateliers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour aux ateliers
      </Link>

      {/* En-tête */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GraduationCap className="size-5 text-lime" />
          <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight">
            {workshop.title}
          </h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 mono-label",
              WORKSHOP_STATUS_STYLES[workshop.status] ?? WORKSHOP_STATUS_STYLES.draft,
            )}
          >
            {WORKSHOP_STATUS_LABELS[workshop.status] ?? workshop.status}
          </span>
        </div>
        {workshop.description && (
          <p className="max-w-3xl text-sm text-muted-foreground">{workshop.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <code className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[11px]">
            {workshop.slug}
          </code>
          {workshop.domain && (
            <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 mono-label">
              {workshop.domain}
            </span>
          )}
          {workshop.level && (
            <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 mono-label">
              {workshop.level}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            Créé le {formatDate(workshop.createdAt)}
          </span>
          <span>· Mis à jour le {formatDate(workshop.updatedAt)}</span>
        </div>
      </header>

      <Tabs defaultValue="structure" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="structure" className="gap-1.5">
            <ListChecks className="size-3.5" />
            Structure
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-1.5">
            <Users className="size-3.5" />
            Inscriptions
            <span className="text-muted-foreground">({workshop.enrollments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-1.5">
            <FileText className="size-3.5" />
            Soumissions
            <span className="text-muted-foreground">({workshop.submissions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="quiz" className="gap-1.5">
            <Target className="size-3.5" />
            Quiz
            <span className="text-muted-foreground">({quizSessions.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Structure ── */}
        <TabsContent value="structure" className="space-y-6">
          {workshop.weeks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              message="Aucune semaine définie pour cet atelier."
            />
          ) : (
            workshop.weeks.map((week) => (
              <section key={week.id} className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-card/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-lime/30 bg-lime/10 px-2 py-0.5 mono-label text-lime">
                      Semaine {week.number}
                    </span>
                    <h2 className="font-display font-bold text-base">{week.title}</h2>
                  </div>
                  {week.objective && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{week.objective}</p>
                  )}
                </div>

                {week.sessions.length === 0 ? (
                  <p className="pl-1 text-sm text-muted-foreground">
                    Aucune séance dans cette semaine.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {week.sessions.map((session) => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </TabsContent>

        {/* ── Inscriptions ── */}
        <TabsContent value="enrollments">
          {workshop.enrollments.length === 0 ? (
            <EmptyState icon={Users} message="Aucune inscription pour cet atelier." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-card/40 text-left text-xs text-muted-foreground mono-label">
                    <th className="px-3 py-2.5">Membre</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Statut</th>
                    <th className="px-3 py-2.5">Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {workshop.enrollments.map((enrollment) => (
                    <tr
                      key={enrollment.id}
                      className="border-b border-border/20 last:border-0"
                    >
                      <td className="px-3 py-2.5">{memberName(enrollment.member)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {enrollment.member.email}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 mono-label">
                          {ENROLLMENT_STATUS_LABELS[enrollment.status] ?? enrollment.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatDate(enrollment.enrolledAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Soumissions ── */}
        <TabsContent value="submissions" className="space-y-3">
          {workshop.submissions.length === 0 ? (
            <EmptyState icon={FileText} message="Aucune soumission pour cet atelier." />
          ) : (
            workshop.submissions.map((submission) => {
              const session = deliverableIndex.get(submission.deliverableId);
              return (
                <article
                  key={submission.id}
                  className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{memberName(submission.member)}</p>
                      <p className="text-xs text-muted-foreground">
                        {submission.member.email}
                      </p>
                    </div>
                    <StatusBadge status={submission.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {session ? (
                      <>
                        <span className="mono-label">
                          S{String(session.number).padStart(2, "0")}
                        </span>
                        <span>{session.title}</span>
                        <span className="text-muted-foreground/50">→</span>
                        <span>{session.deliverableTitle}</span>
                      </>
                    ) : (
                      <span>Livrable inconnu</span>
                    )}
                    <span>· tentative {submission.attempt}</span>
                    <span>· soumis le {formatDateTime(submission.submittedAt)}</span>
                  </div>

                  <div className="rounded-md border border-border/60 bg-background/40 p-3">
                    <SubmissionContent
                      content={submission.content}
                      type={session?.deliverableType ?? "text"}
                    />
                  </div>

                  {submission.reviews.length > 0 && (
                    <div className="space-y-2">
                      <p className="mono-label text-muted-foreground uppercase">
                        Historique des revues
                      </p>
                      {submission.reviews.map((review) => (
                        <div
                          key={review.id}
                          className="rounded-md border border-border/60 bg-background/40 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={review.decision} />
                            <span className="text-xs text-muted-foreground">
                              par {review.reviewer} · {formatDateTime(review.createdAt)}
                            </span>
                          </div>
                          {review.feedback && (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                              {review.feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </TabsContent>

        {/* ── Quiz ── */}
        <TabsContent value="quiz" className="space-y-4">
          {quizSessions.length === 0 ? (
            <EmptyState icon={Target} message="Aucun quiz défini pour cet atelier." />
          ) : (
            quizSessions.map((session) => {
              const quiz = session.quiz;
              if (!quiz) return null;
              return (
                <section
                  key={session.id}
                  className="rounded-lg border border-border/60 bg-card/40 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="mono-label text-muted-foreground uppercase">
                        S{String(session.number).padStart(2, "0")} · {session.title}
                      </p>
                      <h3 className="font-display font-bold text-base">{quiz.title}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/60 px-2 py-0.5 mono-label">
                        Seuil {quiz.passThreshold}%
                      </span>
                      <span className="rounded-full border border-border/60 px-2 py-0.5 mono-label">
                        {quiz.maxAttempts ? `${quiz.maxAttempts} tentatives max` : "Tentatives illimitées"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-lime/30 bg-lime/10 px-2 py-0.5 mono-label text-lime">
                        <Target className="size-3" />
                        {session.stats.quiz.attemptCount} tentative
                        {session.stats.quiz.attemptCount > 1 ? "s" : ""}
                        {session.stats.quiz.averageScore !== null &&
                          ` · moyenne ${session.stats.quiz.averageScore}%`}
                      </span>
                    </div>
                  </div>

                  {quiz.questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune question dans ce quiz.
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {quiz.questions.map((question) => {
                        const options = parseStringArray(question.optionsJson);
                        const correct = parseCorrectIndexes(question.correctJson);
                        return (
                          <li
                            key={question.id}
                            className="rounded-md border border-border/60 bg-background/40 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="mono-label text-muted-foreground">
                                Q{question.order + 1}
                              </span>
                              <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[11px] mono-label">
                                {QUESTION_TYPE_LABELS[question.type] ?? question.type}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {question.points} pt{question.points > 1 ? "s" : ""}
                              </span>
                            </div>
                            <p className="mt-2 text-sm">{question.prompt}</p>
                            {options.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {options.map((option, index) => {
                                  const isCorrect = correct.includes(index);
                                  return (
                                    <li
                                      key={`${question.id}-${index}`}
                                      className={cn(
                                        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
                                        isCorrect
                                          ? "border-green-500/40 bg-green-500/10 text-green-200"
                                          : "border-border/40 text-muted-foreground",
                                      )}
                                    >
                                      {isCorrect ? (
                                        <CheckCircle2 className="size-3.5 shrink-0 text-green-400" />
                                      ) : (
                                        <span className="size-3.5 shrink-0 rounded-full border border-border/60" />
                                      )}
                                      {option}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SessionCard({ session }: { session: SessionRow }) {
  const skills = parseStringArray(session.skills);
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono-label rounded-full border border-border/60 px-2 py-0.5">
          S{String(session.number).padStart(2, "0")}
        </span>
        <h3 className="font-display font-bold text-sm">{session.title}</h3>
        {session.deliverableRequired && (
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] mono-label text-muted-foreground">
            Livrable requis
          </span>
        )}
        {session.quizRequired && (
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] mono-label text-muted-foreground">
            Quiz requis
          </span>
        )}
      </div>

      {session.objective && (
        <p className="text-sm text-muted-foreground">{session.objective}</p>
      )}

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-lime/25 bg-lime/[0.06] px-2 py-0.5 text-[11px] text-lime"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {session.program && (
        <details className="rounded-md border border-border/60 bg-background/40 p-3">
          <summary className="cursor-pointer text-xs mono-label text-muted-foreground uppercase">
            Programme
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {session.program}
          </p>
        </details>
      )}

      {session.activities.length > 0 && (
        <div>
          <p className="mono-label text-muted-foreground uppercase">Activités</p>
          <ul className="mt-1.5 space-y-1.5">
            {session.activities.map((activity) => (
              <li
                key={activity.id}
                className="rounded-md border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] mono-label">
                    {ACTIVITY_KIND_LABELS[activity.kind] ?? activity.kind}
                  </span>
                  <span className="text-sm">{activity.title}</span>
                  {activity.url && (
                    <a
                      href={activity.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-lime hover:underline"
                    >
                      Ouvrir
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                {activity.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {session.deliverable && (
        <div className="rounded-md border border-border/60 bg-background/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardCheck className="size-3.5 text-muted-foreground" />
            <span className="mono-label text-muted-foreground uppercase">Livrable</span>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] mono-label">
              {DELIVERABLE_TYPE_LABELS[session.deliverable.type] ?? session.deliverable.type}
            </span>
            <span className="text-sm">{session.deliverable.title}</span>
          </div>
          {session.deliverable.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {session.deliverable.description}
            </p>
          )}
        </div>
      )}

      {session.quiz && (
        <div className="rounded-md border border-border/60 bg-background/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Target className="size-3.5 text-muted-foreground" />
            <span className="mono-label text-muted-foreground uppercase">Quiz</span>
            <span className="text-sm">{session.quiz.title}</span>
            <span className="text-[11px] text-muted-foreground">
              {session.quiz.questions.length} question
              {session.quiz.questions.length > 1 ? "s" : ""} · seuil{" "}
              {session.quiz.passThreshold}%
            </span>
          </div>
        </div>
      )}

      {/* Stats de la séance */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mono-label text-muted-foreground uppercase">
          {session.stats.submissionTotal} soumission
          {session.stats.submissionTotal > 1 ? "s" : ""}
        </span>
        {SUBMISSION_STATUS_VALUES.map((status) => {
          const count = session.stats.submissionCounts[status] ?? 0;
          if (count === 0) return null;
          return (
            <span
              key={status}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] mono-label",
                SUBMISSION_STATUS_STYLES[status],
              )}
            >
              {SUBMISSION_STATUS_LABELS[status]} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-10 text-center">
      <Icon className="mx-auto mb-3 size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
