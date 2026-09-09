"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { THREE_MONTH_GOAL_SUGGESTIONS } from "@/lib/profiling/questions";

/**
 * Éditeur d'objectif à 3 mois — PATCH /api/account/profile.
 * Suggestions 1-clic pour réduire la page blanche.
 */
export function GoalEditor({ initialGoal }: { initialGoal: string | null }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialGoal ?? "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const dirty = value.trim() !== (initialGoal ?? "").trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || loading) return;
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threeMonthGoal: value.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de la mise à jour.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Erreur réseau. Vérifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {THREE_MONTH_GOAL_SUGGESTIONS.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {THREE_MONTH_GOAL_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => {
                setValue(s);
                setSuccess(false);
              }}
              className="rounded-full border border-border/60 bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground cursor-pointer disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          Ton objectif à 3 mois
        </MonoLabel>
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSuccess(false);
          }}
          maxLength={280}
          rows={3}
          disabled={loading}
          placeholder="Ex. Décrocher mon premier stage."
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-colors disabled:opacity-50 resize-y"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>4 caractères minimum, 280 maximum.</span>
          <span>{value.trim().length} / 280</span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && !error && (
        <div
          role="status"
          className="rounded-md border border-lime/40 bg-lime/5 p-3 text-sm text-foreground"
        >
          Objectif enregistré.
        </div>
      )}

      <div className="flex justify-end">
        <RebootButton type="submit" size="md" disabled={loading || !dirty}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Enregistrer
            </>
          )}
        </RebootButton>
      </div>
    </form>
  );
}
