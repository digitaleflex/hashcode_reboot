"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldOff, Loader2, X, AlertTriangle } from "lucide-react";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { MonoLabel } from "@/components/reboot/shared";
import { cn } from "@/lib/utils";

const REASONS = [
  { value: "spammer", label: "Spammer" },
  { value: "harassment", label: "Harcèlement" },
  { value: "duplicate", label: "Doublon" },
  { value: "abuser", label: "Abusif" },
  { value: "admin", label: "Décision admin" },
  { value: "other", label: "Autre" },
] as const;

const REASON_STYLES: Record<string, string> = {
  spammer: "bg-red-500/15 text-red-300 border-red-500/30",
  harassment: "bg-red-500/15 text-red-300 border-red-500/30",
  duplicate: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  abuser: "bg-red-500/15 text-red-300 border-red-500/30",
  admin: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  other: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

interface BlacklistEntry {
  id: string;
  email: string;
  reason: string;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
  autoAdded: boolean;
}

export function BlacklistTable() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [reasonFilter, setReasonFilter] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [removeId, setRemoveId] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "blacklist", { page, search, reason: reasonFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), perPage: "25" });
      if (search) params.set("search", search);
      if (reasonFilter) params.set("reason", reasonFilter);
      const { res, data, code, error, retryAfterSec } = await fetchJson(
        `/api/admin/blacklist?${params.toString()}`,
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
            : error ?? "Erreur de chargement.",
        );
      }
      return data as { items: BlacklistEntry[]; total: number; page: number };
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const csrf =
        document
          .querySelector('meta[name="csrf-token"]')
          ?.getAttribute("content") ?? "";
      const res = await fetch(`/api/admin/blacklist/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de la suppression.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blacklist"] }),
  });

  const total = query.data?.total ?? 0;
  const items = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-3 py-2 rounded-md border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => {
            setReasonFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-md border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime"
        >
          <option value="">Toutes les raisons</option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-lime text-black font-medium hover:bg-lime/90 transition-colors whitespace-nowrap"
        >
          <Plus className="size-4" />
          Blacklister un email
        </button>
      </div>

      {/* Total count */}
      <div className="text-xs text-muted-foreground">
        {total === 0
          ? "Aucun email blacklisté."
          : `${total} email${total > 1 ? "s" : ""} blacklisté${total > 1 ? "s" : ""}`}
      </div>

      {/* Table */}
      {query.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Erreur."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          Aucun email blacklisté pour le moment.
        </div>
      ) : (
        <div className="rounded-md border border-border/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground mono-label border-b border-border/40 bg-card/40">
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Raison</th>
                <th className="px-3 py-2.5">Ajouté</th>
                <th className="px-3 py-2.5">Expire</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => {
                const isExpired =
                  entry.expiresAt && new Date(entry.expiresAt) < new Date();
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border/20 last:border-0"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs text-foreground">
                          {entry.email}
                        </code>
                        {entry.autoAdded && (
                          <span
                            className="text-[10px] mono-label text-muted-foreground border border-border/40 px-1.5 py-0.5 rounded"
                            title="Ajouté automatiquement (ex: soft-delete)"
                          >
                            AUTO
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {entry.note}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center text-[11px] mono-label border rounded-full px-2 py-0.5",
                          REASON_STYLES[entry.reason] ?? REASON_STYLES.other,
                        )}
                      >
                        {REASONS.find((r) => r.value === entry.reason)?.label ??
                          entry.reason}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {entry.expiresAt ? (
                        isExpired ? (
                          <span className="text-muted-foreground italic">
                            Expiré
                          </span>
                        ) : (
                          <span className="text-foreground">
                            {new Date(entry.expiresAt).toLocaleDateString(
                              "fr-FR",
                              { day: "2-digit", month: "short", year: "2-digit" },
                            )}
                          </span>
                        )
                      ) : (
                        <span className="text-amber-400 mono-label text-[11px]">
                          permanent
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => setRemoveId(entry.id)}
                        disabled={removeMutation.isPending}
                        className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        title="Retirer de la blacklist"
                      >
                        <ShieldOff className="size-3" />
                        Retirer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-border bg-card text-foreground disabled:opacity-50"
            >
              ←
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border border-border bg-card text-foreground disabled:opacity-50"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Add dialog */}
      {addOpen && (
        <AddToBlacklistDialog
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ["admin", "blacklist"] });
          }}
        />
      )}

      {/* Remove confirm */}
      {removeId && (
        <RemoveConfirmDialog
          entryId={removeId}
          onClose={() => setRemoveId(null)}
          onConfirm={async () => {
            await removeMutation.mutateAsync(removeId);
            setRemoveId(null);
          }}
          error={removeMutation.error as Error | null}
        />
      )}
    </div>
  );
}

function AddToBlacklistDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [reason, setReason] = React.useState<string>("admin");
  const [note, setNote] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const csrf =
        document
          .querySelector('meta[name="csrf-token"]')
          ?.getAttribute("content") ?? "";
      const body: Record<string, unknown> = { email, reason };
      if (note.trim()) body.note = note.trim();
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

      const res = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(data.error ?? "Trop d'ajouts. Réessaie plus tard.");
        } else {
          setError(data.error ?? "Erreur lors de l'ajout.");
        }
        return;
      }
      onSuccess();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-lg">
              Blacklister un email
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cet email ne pourra plus s'inscrire sur HASHCODE.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <MonoLabel className="text-muted-foreground block mb-1.5">
              Email
            </MonoLabel>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="spam@exemple.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime"
            />
          </div>
          <div>
            <MonoLabel className="text-muted-foreground block mb-1.5">
              Raison
            </MonoLabel>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <MonoLabel className="text-muted-foreground block mb-1.5">
              Expire le (optionnel)
            </MonoLabel>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Laisser vide pour un blocage permanent.
            </p>
          </div>
          <div>
            <MonoLabel className="text-muted-foreground block mb-1.5">
              Note (optionnel)
            </MonoLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Contexte : a déjà créé 3 comptes…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime resize-y"
            />
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-md border border-border bg-card text-sm text-foreground hover:border-lime/60 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldOff className="size-4" />
              )}
              Blacklister
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemoveConfirmDialog({
  entryId,
  onClose,
  onConfirm,
  error,
}: {
  entryId: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  error: Error | null;
}) {
  const [loading, setLoading] = React.useState(false);

  async function handle() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-bold text-base">
              Retirer de la blacklist ?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cet email pourra à nouveau s'inscrire. Action réversible.
            </p>
          </div>
        </div>
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm text-destructive">
            {error.message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-md border border-border bg-card text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-lime text-black font-medium hover:bg-lime/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Confirmer"}
          </button>
        </div>
        {/* entryId hint to keep prop referenced in case of debug */}
        <span className="hidden">{entryId}</span>
      </div>
    </div>
  );
}
