"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { Lock, RefreshCw, AlertTriangle, Check, Copy } from "lucide-react";

export function AdminKeysPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<{
    keyAgeDays: number;
    isStub: boolean;
    rotationThresholdDays: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [rotating, setRotating] = React.useState(false);
  const [newKey, setNewKey] = React.useState<string | null>(null);
  const [confirmPasscode, setConfirmPasscode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Fetch key status on mount.
  React.useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/keys");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      setError("Impossible de charger le statut de la clé.");
    }
  }

  async function handleRotate(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmPasscode.trim()) {
      setError("Confirme le passcode actuel.");
      return;
    }
    setRotating(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPasscode: confirmPasscode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Rotation échouée.");
        return;
      }
      setNewKey(data.newKey);
      setConfirmPasscode("");
      await fetchStatus();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setRotating(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Impossible de copier. Sélectionne et copie manuellement.");
    }
  }

  const needsRotation =
    status && status.keyAgeDays >= status.rotationThresholdDays;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight text-foreground">
          Clés d'administration
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gère la rotation du passcode admin. Attention : la rotation
          invalide toutes les sessions admin existantes.
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-md border border-border/60 bg-card p-5 space-y-3">
        <h2 className="font-medium text-foreground flex items-center gap-2">
          <Lock className="size-4" />
          Statut de la clé actuelle
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Âge de la clé</p>
            <p className="font-mono text-foreground">
              {status ? status.keyAgeDays : "—"} jour(s)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Seuil de rotation</p>
            <p className="font-mono text-foreground">
              {status ? status.rotationThresholdDays : "—"} jour(s)
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Type</p>
            <p className={`font-mono ${status?.isStub ? "text-amber-400" : "text-lime"}`}>
              {status ? (status.isStub ? "Stubs (dev)" : "Réelle") : "—"}
            </p>
          </div>
        </div>
        {needsRotation && (
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertTriangle className="size-4" aria-hidden />
            La clé dépasse le seuil de rotation. Il est recommandé de la rotater.
          </div>
        )}
      </div>

      {/* Rotation form */}
      <form onSubmit={handleRotate} className="space-y-4">
        <div className="rounded-md border border-border/60 bg-card p-5 space-y-4">
          <h2 className="font-medium text-foreground flex items-center gap-2">
            <RefreshCw className="size-4" />
            Rotater la clé
          </h2>
          <p className="text-sm text-muted-foreground">
            Pour des raisons de sécurité, confirme le passcode actuel pour
            autoriser la rotation. La nouvelle clé sera affichée une seule
            fois.
          </p>
          <div>
            <label
              htmlFor="confirm-passcode"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Passcode actuel
            </label>
            <input
              id="confirm-passcode"
              type="password"
              required
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              placeholder="Ton passcode admin actuel"
              className="w-full h-12 rounded-md border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors focus-lime border-border focus:border-lime"
            />
          </div>
          <RebootButton
            type="submit"
            disabled={rotating || !confirmPasscode.trim()}
            variant="outline"
            className="gap-2"
          >
            {rotating ? (
              "Rotation en cours…"
            ) : (
              <>
                <RefreshCw className="size-4" aria-hidden />
                Rotater la clé
              </>
            )}
          </RebootButton>
        </div>
      </form>

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* New key display */}
      {newKey && (
        <div className="rounded-md border border-lime/40 bg-lime/5 p-5 space-y-4">
          <div className="flex items-center gap-2 text-lime">
            <Check className="size-4" aria-hidden />
            <span className="font-medium">Clé rotée avec succès !</span>
          </div>
          <div className="relative">
            <p className="text-xs text-muted-foreground mb-1">
              Copie immédiatement cette clé. Elle ne sera plus affichée.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 break-all rounded-md bg-background px-3 py-2 text-sm font-mono text-foreground border border-border/60">
                {newKey}
              </code>
              <RebootButton
                size="sm"
                onClick={copyKey}
                variant="outline"
                className="gap-1"
              >
                {copied ? (
                  <>
                    <Check className="size-3" aria-hidden />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="size-3" aria-hidden />
                    Copier
                  </>
                )}
              </RebootButton>
            </div>
          </div>
          <RebootButton onClick={() => router.refresh()} variant="outline">
            Rafraîchir le statut
          </RebootButton>
        </div>
      )}
    </div>
  );
}
