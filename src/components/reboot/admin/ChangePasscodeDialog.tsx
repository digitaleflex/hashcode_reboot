"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RebootButton } from "../shared";
import { KeyRound, Check, AlertCircle } from "lucide-react";
import { fetchJson } from "./lib/fetchJson";

export function ChangePasscodeDialog({
  onSessionExpired,
  onChanged,
}: {
  onSessionExpired: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [passcode, setPasscode] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passcode !== confirm) {
      setStatus("error");
      setErrorMsg("Les deux saisies ne correspondent pas.");
      return;
    }
    if (passcode.length < 16) {
      setStatus("error");
      setErrorMsg("Le passcode doit faire au moins 16 caractères.");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const { res, data, error, code } = await fetchJson("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        throw new Error(error ?? "Échec de la rotation.");
      }
      setStatus("success");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
        setPasscode("");
        setConfirm("");
        onChanged();
      }, 2000);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Échec de la rotation.");
    }
  }

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (!o) {
      // Reset on close
      setTimeout(() => {
        setStatus("idle");
        setErrorMsg(null);
        setPasscode("");
        setConfirm("");
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <RebootButton
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Changer le passcode admin"
      >
        <KeyRound className="size-4" />
        <span className="hidden sm:inline">Passcode</span>
      </RebootButton>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Changer le passcode admin</DialogTitle>
          <DialogDescription>
            Un nouveau passcode sera généré. Les anciennes clés seront
            révoquées instantanément. Toutes les sessions existantes
            deviennent invalides.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-passcode" className="mb-1.5 block text-sm font-medium text-foreground">
              Nouveau passcode
            </label>
            <input
              id="new-passcode"
              type="password"
              required
              minLength={16}
              autoComplete="new-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="16 caractères minimum"
              disabled={status === "submitting" || status === "success"}
              className="w-full h-11 rounded-md border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="confirm-passcode" className="mb-1.5 block text-sm font-medium text-foreground">
              Confirmer le passcode
            </label>
            <input
              id="confirm-passcode"
              type="password"
              required
              minLength={16}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ressaisis le passcode"
              disabled={status === "submitting" || status === "success"}
              className="w-full h-11 rounded-md border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime disabled:opacity-50"
            />
          </div>

          {status === "error" && errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-foreground flex items-center gap-2" role="alert">
              <AlertCircle className="size-4 text-destructive shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === "success" && (
            <div className="rounded-md border border-lime/40 bg-lime/5 px-3 py-2.5 text-sm text-foreground flex items-center gap-2" role="status">
              <Check className="size-4 text-lime shrink-0" />
              <span>Nouveau passcode enregistré. Redirection…</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <RebootButton
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
              disabled={status === "submitting"}
            >
              Annuler
            </RebootButton>
            <RebootButton
              size="sm"
              type="submit"
              disabled={
                status === "submitting" ||
                status === "success" ||
                !passcode.trim() ||
                !confirm.trim() ||
                passcode.length < 16
              }
            >
              {status === "submitting" ? "Génération…" : "Changer le passcode"}
            </RebootButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}