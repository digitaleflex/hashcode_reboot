"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  Flag,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";

// ── Types (miroir API) ───────────────────────────────────────────────────────

interface MissionDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  domain: string;
  level: string;
  status: string;
  sortOrder: number;
}

interface PendingSubmission {
  id: string;
  attempt: number;
  content: string;
  status: string;
  submittedAt: string;
  member: { id: string; email: string; firstName: string; lastName: string };
}

const NEXT_STATUSES: Record<string, Array<{ to: string; label: string }>> = {
  DRAFT: [{ to: "PUBLISHED", label: "Publier" }],
  PUBLISHED: [
    { to: "DRAFT", label: "Repasser en brouillon" },
    { to: "ARCHIVED", label: "Archiver" },
  ],
  ARCHIVED: [{ to: "PUBLISHED", label: "Republier" }],
};

const FEEDBACK_MIN_LENGTH = 4;

function queryError(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur de chargement.";
}

async function loadDetail(id: string) {
  const { res, data, code, error, retryAfterSec } = await fetchJson(
    `/api/admin/missions/${id}`,
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
        : error ?? "Mission introuvable.",
    );
  }
  return data as { mission: MissionDetail };
}

async function loadPending(id: string) {
  const { res, data, code, error } = await fetchJson(
    `/api/admin/mission-submissions?missionId=${encodeURIComponent(id)}&status=PENDING&limit=100`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(error ?? "File de revue inaccessible.");
  return (data as { submissions: PendingSubmission[] }).submissions;
}

function ReviewDialog({
  submission,
  missionId,
  onClose,
}: {
  submission: PendingSubmission;
  missionId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [decision, setDecision] = React.useState<"APPROVED" | "REVISION" | "REJECTED">(
    "APPROVED",
  );
  const [feedback, setFeedback] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { res, data, code, error, retryAfterSec } = await fetchJson(
        `/api/admin/mission-submissions/${submission.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, feedback: feedback.trim() }),
        },
      );
      if (!res.ok) {
        throw new Error(
          code === "RATE_LIMITED"
            ? withRetryAfter(error ?? "Trop de requêtes.", retryAfterSec)
            : error ?? "Échec de l'enregistrement.",
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "mission-submissions", missionId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "mission-detail", missionId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "missions"] });
      toast({ title: "Revue enregistrée", description: decision });
      onClose();
    },
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (feedback.trim().length < FEEDBACK_MIN_LENGTH) {
      setFormError(`Le feedback doit contenir au moins ${FEEDBACK_MIN_LENGTH} caractères.`);
      return;
    }
    try {
      await mutation.mutateAsync();
    } catch {
      /* exposée via mutation.error */
    }
  }

  const mutationError =
    mutation.isError && mutation.error instanceof Error
      ? mutation.error.message
      : null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-review-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border/60 bg-card p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mission-review-title" className="font-display font-bold text-lg">
          Revue — tentative {submission.attempt} · {submission.member.firstName}{" "}
          {submission.member.lastName}
        </h2>
        <p className="rounded-md border border-border/60 bg-background p-3 text-sm whitespace-pre-wrap">
          {submission.content}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2" role="radiogroup" aria-label="Décision">
            {(["APPROVED", "REVISION", "REJECTED"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={decision === d}
                onClick={() => setDecision(d)}
                className={cn(
                  "min-h-[44px] flex-1 rounded-md border px-3 py-2 text-xs font-medium",
                  decision === d
                    ? "border-lime/50 bg-lime/10 text-lime"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {d === "APPROVED" ? "Valider" : d === "REVISION" ? "Retravailler" : "Rejeter"}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="mission-feedback" className="mono-label text-muted-foreground">
              Feedback (requis)
            </label>
            <textarea
              id="mission-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
              aria-invalid={formError ? true : undefined}
            />
          </div>
          {formError && (
            <p role="alert" className="text-xs text-red-400">
              {formError}
            </p>
          )}
          {mutationError && (
            <p role="alert" className="text-xs text-red-400">
              {mutationError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-md border border-border/60 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="min-h-[44px] rounded-md border border-lime/50 bg-lime/10 px-4 py-2 text-xs text-lime disabled:opacity-50"
            >
              {mutation.isPending ? "Enregistrement…" : "Enregistrer la revue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminMissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reviewing, setReviewing] = React.useState<PendingSubmission | null>(null);
  const [busyStatus, setBusyStatus] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin", "mission-detail", id],
    queryFn: () => loadDetail(id),
  });
  const pendingQuery = useQuery({
    queryKey: ["admin", "mission-submissions", id],
    queryFn: () => loadPending(id),
  });

  async function changeStatus(to: string) {
    setBusyStatus(true);
    try {
      const { res, data, code, error } = await fetchJson(`/api/admin/missions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) throw new Error(error ?? `Statut ${code ?? "?"}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "mission-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "missions"] });
      toast({ title: "Statut mis à jour", description: (data as { mission: { status: string } }).mission.status });
    } catch (e) {
      toast({
        title: "Échec",
        description: e instanceof Error ? e.message : "Transition refusée.",
      });
    } finally {
      setBusyStatus(false);
    }
  }

  const mission = detailQuery.data?.mission;
  const pending = pendingQuery.data ?? [];

  return (
    <div className="space-y-8">
      <Link
        href="/admin/missions"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Missions
      </Link>

      {detailQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4 animate-pulse" />
          Chargement…
        </div>
      ) : detailQuery.isError || !mission ? (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {queryError(detailQuery.error)}
        </div>
      ) : (
        <>
          <header className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Flag className="size-6 text-lime" />
              <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight">
                {mission.title}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mono-label">
              {mission.slug} · {mission.domain} · {mission.level} · {mission.status}
            </p>
            {mission.description && (
              <p className="text-sm text-muted-foreground">{mission.description}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {(NEXT_STATUSES[mission.status] ?? []).map((n) => (
                <button
                  key={n.to}
                  type="button"
                  disabled={busyStatus}
                  onClick={() => changeStatus(n.to)}
                  className="min-h-[44px] rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-lime/40 hover:text-lime disabled:opacity-50"
                >
                  {busyStatus ? "…" : n.label}
                </button>
              ))}
            </div>
          </header>

          <section className="space-y-3">
            <h2 className="mono-label text-muted-foreground uppercase">
              File de revue ({pending.length})
            </h2>
            {pendingQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : pendingQuery.isError ? (
              <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="size-4 shrink-0" />
                {queryError(pendingQuery.error)}
              </div>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune soumission en attente de revue.
              </p>
            ) : (
              <div className="space-y-2">
                {pending.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {s.member.firstName} {s.member.lastName}{" "}
                        <span className="text-muted-foreground">· tentative {s.attempt}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {s.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewing(s)}
                      className="min-h-[44px] shrink-0 rounded-md border border-lime/50 bg-lime/10 px-3 py-1.5 text-xs text-lime"
                    >
                      Revoir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {reviewing && mission && (
        <ReviewDialog
          submission={reviewing}
          missionId={mission.id}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
