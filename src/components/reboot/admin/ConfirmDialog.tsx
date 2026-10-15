"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialogue de confirmation partagé admin (#224).
 * Actions destructives / à fort impact : jamais de `window.confirm`
 * (incohérent visuellement, non stylable). Pattern harmonisé avec les
 * dialogues revue/relance : role + aria, erreur `role=alert`, état pending.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmer",
  danger = true,
  pending = false,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-full sm:max-w-sm rounded-lg border border-border bg-card p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={cn("size-5 shrink-0 mt-0.5", danger ? "text-destructive" : "text-amber-400")}
            aria-hidden
          />
          <div>
            <h2 id="confirm-dialog-title" className="font-display font-bold text-base">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
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
            disabled={pending}
            className="min-h-[44px] px-4 py-2 rounded-md border border-border bg-card text-sm disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "min-h-[44px] px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50",
              danger
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-lime text-black hover:bg-lime/90",
            )}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
