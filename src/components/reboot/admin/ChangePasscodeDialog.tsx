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

export function ChangePasscodeDialog({
  onSessionExpired,
  onChanged,
}: {
  onSessionExpired: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState("");
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
    if (passcode.length < 8) {
      setStatus("error");
      setErrorMsg("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: passcode, revokeOtherSessions: false }),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Échec du changement.");
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
       <button
         type="button"
         onClick={() => setOpen(true)}
         title="Changer le mot de passe admin"
         className="inline-flex items-center justify-center gap-2 rounded-md border border-border hover:border-lime/60 hover:text-lime transition-colors duration-180 min-h-[44px] cursor-pointer text-sm px-4 bg-transparent text-foreground border border-border"
       >
         <KeyRound className="size-4" />
         <span className="hidden sm:inline">Mot de passe</span>
       </button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Changer le mot de passe admin</DialogTitle>
          <DialogDescription>
            Définis un nouveau mot de passe pour ton compte admin Better Auth.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-foreground">
              Mot de passe actuel
            </label>
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={status === "submitting" || status === "success"}
              className="w-full h-11 rounded-md border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="new-passcode" className="mb-1.5 block text-sm font-medium text-foreground">
              Nouveau mot de passe
            </label>
            <input
              id="new-passcode"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="8 caractères minimum"
              disabled={status === "submitting" || status === "success"}
              className="w-full h-11 rounded-md border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="confirm-passcode" className="mb-1.5 block text-sm font-medium text-foreground">
              Confirmer le mot de passe
            </label>
            <input
              id="confirm-passcode"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ressaisis le mot de passe"
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
              <span>Nouveau mot de passe enregistré. Redirection…</span>
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
                !current.trim() ||
                passcode.length < 8
              }
            >
              {status === "submitting" ? "Enregistrement…" : "Changer le mot de passe"}
            </RebootButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}