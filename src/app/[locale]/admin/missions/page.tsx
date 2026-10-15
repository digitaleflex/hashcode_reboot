"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronRight,
  Flag,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";

// ── Types (miroir de GET/POST /api/admin/missions) ──────────────────────────

interface MissionListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  domain: string;
  level: string;
  status: string;
  sortOrder: number;
  _count: { assignments: number; submissions: number };
}

const MISSION_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border/60",
  PUBLISHED: "bg-lime/15 text-lime border-lime/30",
  ARCHIVED: "bg-muted/40 text-muted-foreground/60 border-border/40",
};

const MISSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  ARCHIVED: "Archivée",
};

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "PUBLISHED", label: "Publiées" },
  { value: "ARCHIVED", label: "Archivées" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

function queryError(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur de chargement.";
}

async function loadMissions(): Promise<{ missions: MissionListItem[] }> {
  const { res, data, code, error, retryAfterSec } = await fetchJson(
    "/api/admin/missions?limit=200",
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
        : error ?? "Impossible de charger les missions.",
    );
  }
  return data as { missions: MissionListItem[] };
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [slug, setSlug] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { res, data, code, error } = await fetchJson("/api/admin/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim().toLowerCase(), title: title.trim() }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        window.location.href = "/admin/login";
        throw new Error("unauthorized");
      }
      if (!res.ok) throw new Error(error ?? "Création impossible.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "missions"] });
      toast({ title: "Mission créée", description: "Statut : brouillon." });
      onClose();
    },
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      setFormError("Slug : minuscules, chiffres et tirets uniquement.");
      return;
    }
    if (title.trim().length < 1) {
      setFormError("Titre requis.");
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
        aria-labelledby="mission-create-title"
        className="w-full max-w-md rounded-lg border border-border/60 bg-card p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mission-create-title" className="font-display font-bold text-lg">
          Nouvelle mission
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="mission-slug" className="mono-label text-muted-foreground">
              Slug (stable, public)
            </label>
            <input
              id="mission-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="premiere-interface"
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
              aria-invalid={formError ? true : undefined}
            />
          </div>
          <div>
            <label htmlFor="mission-title" className="mono-label text-muted-foreground">
              Titre
            </label>
            <input
              id="mission-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Réalise ta première interface"
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
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
              {mutation.isPending ? "Création…" : "Créer (brouillon)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminMissionsPage() {
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const [creating, setCreating] = React.useState(false);

  const missionsQuery = useQuery({
    queryKey: ["admin", "missions"],
    queryFn: loadMissions,
  });

  const missions = missionsQuery.data?.missions ?? [];
  const visible = React.useMemo(
    () => (filter === "all" ? missions : missions.filter((m) => m.status === filter)),
    [missions, filter],
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Flag className="size-6 text-lime" />
          <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight">
            Missions
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Référentiel des challenges : brouillons, publication, file de revue.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
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
            onClick={() => setCreating(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-lime/50 bg-lime/10 px-3 py-1.5 text-xs font-medium text-lime"
          >
            <Plus className="size-3.5" />
            Nouvelle mission
          </button>
        </div>

        {missionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : missionsQuery.isError ? (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            {queryError(missionsQuery.error)}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card/40 p-10 text-center">
            <Flag className="mx-auto mb-3 size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {missions.length === 0
                ? "Aucune mission pour le moment — créez la première."
                : "Aucune mission ne correspond à ce filtre."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((mission) => (
              <article
                key={mission.id}
                className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-base truncate">
                        {mission.title}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 mono-label",
                          MISSION_STATUS_STYLES[mission.status] ??
                            MISSION_STATUS_STYLES.DRAFT,
                        )}
                      >
                        {MISSION_STATUS_LABELS[mission.status] ?? mission.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground mono-label">
                      {mission.slug} · {mission.domain} · {mission.level}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {mission._count.assignments} démarrage(s) ·{" "}
                      {mission._count.submissions} soumission(s)
                    </p>
                  </div>
                  <Link
                    href={`/admin/missions/${mission.id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"
                  >
                    Détail
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
