"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "../shared";
import { fetchJson, isAbortError } from "./lib/fetchJson";
import { Shield, ShieldOff, AlertCircle, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminKey {
  kid: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export function AdminKeysManager({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [keys, setKeys] = React.useState<AdminKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = React.useState<string | null>(null);

  const loadKeys = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const { res, data, code } = await fetchJson("/api/admin/keys?include_revoked=true", {
        cache: "no-store",
        signal,
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        throw new Error("Erreur de chargement des clés.");
      }
      setKeys((data?.keys ?? []) as AdminKey[]);
    } catch (e) {
      if (isAbortError(e)) return;
      setError(e instanceof Error ? e.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    void loadKeys(ctrl.signal);
    return () => ctrl.abort();
  }, [loadKeys]);

  async function handleRevoke(kid: string) {
    setRevoking(kid);
    try {
      const { res, error, code } = await fetchJson(`/api/admin/keys/${kid}`, {
        method: "DELETE",
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        throw new Error(error ?? "Échec de la révocation.");
      }
      await loadKeys();
      setConfirmRevoke(null);
    } catch (e) {
      if (!isAbortError(e)) {
        setError(e instanceof Error ? e.message : "Échec de la révocation.");
      }
    } finally {
      setRevoking(null);
    }
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <MonoLabel className="text-muted-foreground">Clés admin actives</MonoLabel>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeKeys.length} clé{activeKeys.length !== 1 ? "s" : ""} active{activeKeys.length !== 1 ? "s" : ""}
          </p>
        </div>
        <RebootButton
          size="sm"
          variant="outline"
          onClick={() => void loadKeys()}
          disabled={loading}
        >
          <Shield className="size-4" />
          Actualiser
        </RebootButton>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-foreground flex items-center gap-2" role="alert">
          <AlertCircle className="size-4 text-destructive shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && keys.length === 0 ? (
        <div className="rounded-md border border-border/60 bg-card/40 p-5 text-center">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      ) : (
        <div className="rounded-md border border-border/60 bg-card/40 divide-y divide-border/40">
          {activeKeys.length === 0 && (
            <div className="p-5 text-center">
              <p className="text-sm text-foreground font-medium">Aucune clé active.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Utilise le changement de passcode pour créer une nouvelle clé.
              </p>
            </div>
          )}
          {activeKeys.map((key) => (
            <div
              key={key.kid}
              className="flex items-center gap-3 p-3 hover:bg-elevated/30 transition-colors"
            >
              <Shield className="size-4 text-lime shrink-0" aria-hidden />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground font-mono">{key.kid}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Créée le {new Date(key.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              {confirmRevoke === key.kid ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive font-medium">Révoquer ?</span>
                  <RebootButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRevoke(null)}
                    disabled={revoking === key.kid}
                  >
                    Non
                  </RebootButton>
                  <RebootButton
                    size="sm"
                    onClick={() => void handleRevoke(key.kid)}
                    disabled={revoking === key.kid}
                    className="bg-destructive text-white hover:bg-destructive/90 border-destructive"
                  >
                    {revoking === key.kid ? "…" : "Oui"}
                  </RebootButton>
                </div>
              ) : (
                <RebootButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmRevoke(key.kid)}
                  disabled={revoking !== null}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <ShieldOff className="size-4" />
                  <span className="hidden sm:inline">Révoquer</span>
                </RebootButton>
              )}
            </div>
          ))}

          {revokedKeys.length > 0 && (
            <>
              <div className="px-3 py-2 bg-elevated/30">
                <span className="mono-label text-xs text-muted-foreground">
                  Clés révoquées ({revokedKeys.length})
                </span>
              </div>
              {revokedKeys.map((key) => (
                <div
                  key={key.kid}
                  className="flex items-center gap-3 p-3 opacity-50"
                >
                  <ShieldOff className="size-4 text-muted-foreground shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-mono text-muted-foreground line-through">{key.kid}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Révoquée le {key.revokedAt ? new Date(key.revokedAt).toLocaleDateString("fr-FR") : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
