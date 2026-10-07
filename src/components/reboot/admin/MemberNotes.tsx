"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { MonoLabel, RebootButton } from "../shared";
import { fetchJson, isAbortError, withRetryAfter } from "./lib/fetchJson";

interface MemberNoteRow {
  id: string;
  createdAt: string;
  author: string;
  content: string;
}

/* ------------------------------------------------------------------ */
/* Dated admin notes (#100) — append-only history beside the singleton  */
/* adminNote (which stays untouched).                                  */
/* ------------------------------------------------------------------ */

export function MemberNotes({ memberId }: { memberId: string }) {
  const t = useTranslations("admin.members.notes");
  const [notes, setNotes] = React.useState<MemberNoteRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [notesError, setNotesError] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const loadNotes = React.useCallback(async () => {
    setLoading(true);
    setNotesError(null);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson(
        `/api/members/${memberId}/notes`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const base = error ?? "Erreur de chargement des notes.";
        throw new Error(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
      }
      setNotes((data?.notes ?? []) as MemberNoteRow[]);
    } catch (e) {
      if (isAbortError(e)) return;
      setNotesError(
        e instanceof Error ? e.message : "Erreur de chargement des notes.",
      );
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  React.useEffect(() => {
    setDraft("");
    setSavedFlash(false);
    setConfirmDeleteId(null);
    void loadNotes();
  }, [loadNotes]);

  async function addNote() {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    setNotesError(null);
    try {
      const { res, error, code, retryAfterSec } = await fetchJson(
        `/api/members/${memberId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) {
        const base = error ?? "Échec de l'ajout de la note.";
        throw new Error(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
      }
      setDraft("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      await loadNotes();
    } catch (e) {
      if (isAbortError(e)) return;
      setNotesError(
        e instanceof Error ? e.message : "Échec de l'ajout de la note.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    setDeletingId(noteId);
    setNotesError(null);
    try {
      const { res, error, code, retryAfterSec } = await fetchJson(
        `/api/members/${memberId}/notes/${noteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const base = error ?? "Échec de la suppression.";
        throw new Error(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
      }
      setConfirmDeleteId(null);
      await loadNotes();
    } catch (e) {
      if (isAbortError(e)) return;
      setNotesError(
        e instanceof Error ? e.message : "Échec de la suppression.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const fmtDate = (at: string) =>
    new Date(at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between gap-2">
        <MonoLabel className="text-muted-foreground">{t("title")}</MonoLabel>
        {savedFlash && (
          <span className="mono-label text-lime" role="status">{t("saved")}</span>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void addNote();
          }
        }}
        placeholder={t("inputPlaceholder")}
        aria-label={t("inputAria")}
        rows={3}
        maxLength={2000}
        className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-lime focus:border-lime/60 resize-none scroll-slim"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RebootButton
          size="sm"
          variant="outline"
          onClick={() => {
            void addNote();
          }}
          disabled={!draft.trim() || saving}
        >
          {saving ? t("saving") : t("add")}
        </RebootButton>
      </div>
      {notesError && (
        <p className="mt-2 text-xs text-amber-200" role="alert">{notesError}</p>
      )}
      <div className="mt-3 space-y-2">
        {loading && (
          <p className="text-xs text-muted-foreground">{t("loading")}</p>
        )}
        {!loading && notes.length === 0 && !notesError && (
          <p className="text-xs text-muted-foreground">{t("empty")}</p>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className="rounded-md border border-border/60 bg-background/60 p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="mono-label text-muted-foreground">
                {fmtDate(n.createdAt)} · {n.author}
              </span>
              {confirmDeleteId !== n.id ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(n.id)}
                  aria-label={t("removeAria", { author: n.author })}
                  className="shrink-0 min-h-[44px] px-2 text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime mono-label"
                >
                  ✕
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {t("deleteConfirm")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteNote(n.id)}
                    disabled={deletingId === n.id}
                    className="min-h-[44px] px-2 text-xs text-destructive hover:underline transition-colors focus-lime disabled:opacity-50"
                  >
                    {deletingId === n.id ? t("deleting") : t("confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deletingId === n.id}
                    className="min-h-[44px] px-2 text-xs text-muted-foreground hover:text-foreground transition-colors focus-lime disabled:opacity-50"
                  >
                    {t("cancel")}
                  </button>
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
              {n.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
