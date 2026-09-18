"use client";

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ClipboardCheck,
  Loader2,
  AlertCircle,
  Inbox,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";

// ── Types (miroir de GET /api/admin/workshops/submissions) ──────────────────

interface MemberSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ReviewRow {
  id: string;
  reviewer: string;
  decision: string;
  feedback: string | null;
  createdAt: string;
}

interface SubmissionListItem {
  id: string;
  attempt: number;
  content: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  member: MemberSummary;
  deliverable: { id: string; type: string; title: string };
  session: { id: string; number: number; title: string; weekNumber: number };
  workshop: { id: string; slug: string; title: string };
  /** La route liste ne projette pas l'historique ; le détail le fournit. */
  reviews?: ReviewRow[];
}

interface SubmissionListResponse {
  submissions: SubmissionListItem[];
  total: number;
}

type ReviewDecision = "APPROVED" | "REVISION" | "REJECTED";

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

const AWAITING_REVIEW = new Set<string>(["PENDING", "IN_REVIEW"]);

const FILTERS = [
  { value: "PENDING", label: "En attente" },
  { value: "IN_REVIEW", label: "En revue" },
  { value: "APPROVED", label: "Approuvées" },
  { value: "REVISION", label: "Corrections" },
  { value: "REJECTED", label: "Rejetées" },
  { value: "ALL", label: "Toutes" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

const DECISIONS: {
  value: ReviewDecision;
  label: string;
  hint: string;
  activeClass: string;
}[] = [
  {
    value: "APPROVED",
    label: "Approuver",
    hint: "Le livrable est validé.",
    activeClass: "border-green-500/50 bg-green-500/10 text-green-200",
  },
  {
    value: "REVISION",
    label: "Demander une correction",
    hint: "Le membre doit corriger et resoumettre.",
    activeClass: "border-orange-500/50 bg-orange-500/10 text-orange-200",
  },
  {
    value: "REJECTED",
    label: "Rejeter",
    hint: "Le livrable est refusé.",
    activeClass: "border-red-500/50 bg-red-500/10 text-red-200",
  },
];

const FEEDBACK_MIN_LENGTH = 10;

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

function queryError(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur de chargement.";
}

async function loadSubmissions(filter: FilterValue): Promise<SubmissionListResponse> {
  const statuses =
    filter === "ALL" ? [...SUBMISSION_STATUS_VALUES] : [filter];

  const lists = await Promise.all(
    statuses.map(async (status) => {
      const { res, data, code, error, retryAfterSec } = await fetchJson(
        `/api/admin/workshops/submissions?status=${status}&limit=500`,
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
            : error ?? "Impossible de charger les soumissions.",
        );
      }
      return (data as SubmissionListResponse).submissions;
    }),
  );

  // Fusion sans doublon (une soumission n'a qu'un statut, mais on reste défensif).
  const byId = new Map<string, SubmissionListItem>();
  for (const list of lists) {
    for (const submission of list) byId.set(submission.id, submission);
  }
  const submissions = [...byId.values()].sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );
  return { submissions, total: submissions.length };
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

function SubmissionContent({ content }: { content: string }) {
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
      {content.length > 500 ? `${content.slice(0, 500)}…` : content}
    </p>
  );
}

export default function AdminWorkshopSubmissionsPage() {
  const [filter, setFilter] = React.useState<FilterValue>("PENDING");
  const [reviewId, setReviewId] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "workshop-submissions", filter],
    queryFn: () => loadSubmissions(filter),
  });

  // On referme le panneau de revue quand on change d'onglet.
  React.useEffect(() => {
    setReviewId(null);
  }, [filter]);

  const submissions = query.data?.submissions ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-lime" />
          <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight">
            File de revue
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Traite les livrables soumis par les membres : approuver, demander une
          correction ou rejeter.
        </p>
      </header>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "min-h-[44px] rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              filter === f.value
                ? "border-lime/50 bg-lime/10 text-lime"
                : "border-border/60 text-muted-foreground hover:border-lime/40 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground cursor-pointer"
        >
          <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />
          Actualiser
        </button>
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : query.isError ? (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {queryError(query.error)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/40 p-10 text-center">
          <Inbox className="mx-auto mb-3 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Aucune soumission dans cette file.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="mono-label text-muted-foreground">
            {submissions.length} soumission{submissions.length > 1 ? "s" : ""}
          </p>
          {submissions.map((submission) => {
            const canReview = AWAITING_REVIEW.has(submission.status);
            const isOpen = reviewId === submission.id;
            return (
              <article
                key={submission.id}
                className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {memberName(submission.member)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {submission.member.email}
                    </p>
                  </div>
                  <StatusBadge status={submission.status} />
                </div>

                {/* Chaîne atelier → séance → livrable */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="text-foreground">{submission.workshop.title}</span>
                  <span className="text-muted-foreground/50">→</span>
                  <span className="mono-label">
                    S{String(submission.session.number).padStart(2, "0")}
                  </span>
                  <span>{submission.session.title}</span>
                  <span className="text-muted-foreground/50">→</span>
                  <span>{submission.deliverable.title}</span>
                </div>

                <div className="rounded-md border border-border/60 bg-background/40 p-3">
                  <SubmissionContent content={submission.content} />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Tentative {submission.attempt}</span>
                  <span>Soumis le {formatDateTime(submission.submittedAt)}</span>
                  {submission.reviewedAt && (
                    <span>Traité le {formatDateTime(submission.reviewedAt)}</span>
                  )}
                </div>

                {/* Historique des revues — présent uniquement quand la route le fournit. */}
                {submission.reviews && submission.reviews.length > 0 && (
                  <div className="space-y-2">
                    <p className="inline-flex items-center gap-1.5 mono-label text-muted-foreground uppercase">
                      <MessageSquare className="size-3" />
                      Historique
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

                {canReview && !isOpen && (
                  <button
                    type="button"
                    onClick={() => setReviewId(submission.id)}
                    className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-lime/90 cursor-pointer"
                  >
                    <ClipboardCheck className="size-4" />
                    Traiter
                  </button>
                )}

                {canReview && isOpen && (
                  <ReviewPanel
                    submission={submission}
                    onClose={() => setReviewId(null)}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  submission,
  onClose,
}: {
  submission: SubmissionListItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [decision, setDecision] = React.useState<ReviewDecision>("APPROVED");
  const [feedback, setFeedback] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (variables: {
      decision: ReviewDecision;
      feedback: string;
    }) => {
      const { res, data, code, error, retryAfterSec } = await fetchJson(
        `/api/admin/workshops/submissions/${submission.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(variables),
        },
      );
      if (res.status === 401 || code === "UNAUTHORIZED") {
        window.location.href = "/admin/login";
        throw new Error("unauthorized");
      }
      if (!res.ok) {
        throw new Error(
          code === "RATE_LIMITED"
            ? withRetryAfter(error ?? "Trop de requêtes.", retryAfterSec)
            : error ?? "Échec de l'enregistrement de la revue.",
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "workshop-submissions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "workshops", "stats"],
      });
      toast({
        title: "Revue enregistrée",
        description: `${memberName(submission.member)} · ${
          SUBMISSION_STATUS_LABELS[decision] ?? decision
        }`,
      });
      onClose();
    },
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmed = feedback.trim();
    if (trimmed.length < FEEDBACK_MIN_LENGTH) {
      setFormError(
        `Le feedback doit contenir au moins ${FEEDBACK_MIN_LENGTH} caractères.`,
      );
      return;
    }

    try {
      await mutation.mutateAsync({ decision, feedback: trimmed });
    } catch {
      // L'erreur est exposée via mutation.error ci-dessous.
    }
  }

  const mutationErrorMessage =
    mutation.isError && mutation.error instanceof Error
      ? mutation.error.message
      : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border border-lime/30 bg-lime/[0.03] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="inline-flex items-center gap-2 mono-label text-lime uppercase">
          <ClipboardCheck className="size-4" />
          Revue de la soumission
        </p>
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          aria-label="Fermer le panneau de revue"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50 cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Décision */}
      <fieldset className="space-y-2">
        <legend className="mono-label text-muted-foreground uppercase">
          Décision
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DECISIONS.map((option) => {
            const checked = decision === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "cursor-pointer rounded-md border p-3 transition-colors",
                  checked
                    ? option.activeClass
                    : "border-border/60 text-muted-foreground hover:border-lime/40",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`decision-${submission.id}`}
                    value={option.value}
                    checked={checked}
                    onChange={() => setDecision(option.value)}
                    className="size-4 accent-lime"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {option.hint}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Feedback */}
      <div className="space-y-1.5">
        <label
          htmlFor={`feedback-${submission.id}`}
          className="mono-label text-muted-foreground uppercase"
        >
          Feedback ({FEEDBACK_MIN_LENGTH} caractères minimum)
        </label>
        <textarea
          id={`feedback-${submission.id}`}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Explique la décision au membre (points forts, corrections attendues…)"
          className="w-full resize-y rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm transition-colors focus:border-lime/50 focus:outline-none focus:ring-1 focus:ring-lime/30"
        />
        <p className="text-right text-[11px] text-muted-foreground">
          {feedback.trim().length}/2000
        </p>
      </div>

      {(formError || mutationErrorMessage) && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {formError ?? mutationErrorMessage}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="rounded-md border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 cursor-pointer"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-background transition-colors",
            mutation.isPending
              ? "cursor-not-allowed opacity-60"
              : "hover:bg-lime/90 cursor-pointer",
          )}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {mutation.isPending ? "Enregistrement…" : "Enregistrer la revue"}
        </button>
      </div>
    </form>
  );
}
