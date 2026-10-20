"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Play, Send, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MissionActionsProps {
  missionId: string;
  canStart: boolean;
  restart: boolean;
  canSubmit: boolean;
  canAbandon: boolean;
  initialContent: string;
}

/**
 * Actions membre sur une mission : démarrer, soumettre, abandonner.
 *
 * Toutes les décisions d'état sont prises par les API serveur
 * (`/api/missions/[id]/*`) : ce composant ne fait que déclencher puis
 * `router.refresh()` — il ne calcule ni ne modifie aucun statut.
 */
export function MissionActions({
  missionId,
  canStart,
  restart,
  canSubmit,
  canAbandon,
  initialContent,
}: MissionActionsProps) {
  const t = useTranslations("dashboard.missions.detail");
  const router = useRouter();
  const [content, setContent] = React.useState(initialContent);
  const [action, setAction] = React.useState<
    "start" | "submit" | "abandon" | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmingAbandon, setConfirmingAbandon] = React.useState(false);

  async function call(
    kind: "start" | "submit" | "abandon",
    body?: Record<string, unknown>,
  ) {
    setAction(kind);
    setError(null);
    try {
      const res = await fetch(`/api/missions/${missionId}/${kind}`, {
        method: "POST",
        ...(body
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error ??
            (kind === "start"
              ? t("startError")
              : kind === "abandon"
                ? t("abandonError")
                : t("submitError")),
        );
        setAction(null);
        return;
      }
      router.refresh();
      setAction(null);
    } catch {
      setError(
        kind === "start"
          ? t("startOffline")
          : kind === "abandon"
            ? t("abandonOffline")
            : t("submitOffline"),
      );
      setAction(null);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setError(t("contentRequired"));
      return;
    }
    void call("submit", { content: trimmed });
  }

  function abandon() {
    setConfirmingAbandon(false);
    void call("abandon");
  }

  return (
    <div className="space-y-4">
      {canStart && (
        <button
          type="button"
          onClick={() => void call("start")}
          disabled={action !== null}
          className={cn(
            "inline-flex items-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-medium text-background transition-colors",
            "hover:bg-lime/90 focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2",
            action !== null && "opacity-60 cursor-not-allowed",
          )}
        >
          {action === "start" ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          {action === "start"
            ? t("starting")
            : restart
              ? t("restart")
              : t("start")}
        </button>
      )}

      {canSubmit && (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <h2 className="font-display font-bold text-lg tracking-tight">
              {t("submitTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("submitHint")}</p>
          </div>
          <label htmlFor="mission-submission" className="block text-sm font-medium">
            {t("contentLabel")}
          </label>
          <textarea
            id="mission-submission"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              if (error) setError(null);
            }}
            placeholder={t("contentPlaceholder")}
            maxLength={20000}
            rows={8}
            className="w-full rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-lime/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          />
          <button
            type="submit"
            disabled={action !== null}
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-lime px-5 py-2.5 text-sm font-medium text-background transition-colors",
              "hover:bg-lime/90 focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2",
              action !== null && "opacity-60 cursor-not-allowed",
            )}
          >
            {action === "submit" ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {action === "submit"
              ? t("submitting")
              : initialContent
                ? t("resubmit")
                : t("submit")}
          </button>
        </form>
      )}

      {canAbandon && !confirmingAbandon && (
        <button
          type="button"
          onClick={() => setConfirmingAbandon(true)}
          disabled={action !== null}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-colors",
            "hover:border-destructive/50 hover:text-destructive focus-visible:ring-2 focus-visible:ring-lime",
            action !== null && "opacity-60 cursor-not-allowed",
          )}
        >
          <Undo2 className="size-4" aria-hidden />
          {t("abandon")}
        </button>
      )}

      {canAbandon && confirmingAbandon && (
        <div
          role="alertdialog"
          aria-labelledby="mission-abandon-confirm"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-4 space-y-3"
        >
          <p id="mission-abandon-confirm" className="text-sm text-foreground">
            {t("abandonConfirm")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={abandon}
              disabled={action !== null}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors",
                "hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-destructive",
                action !== null && "opacity-60 cursor-not-allowed",
              )}
            >
              {action === "abandon" ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {action === "abandon" ? t("abandoning") : t("confirmAbandon")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingAbandon(false)}
              disabled={action !== null}
              className="inline-flex items-center rounded-md border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-lime"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
