"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AdminKeysManager } from "@/components/reboot/admin/AdminKeysManager";
import { ChangePasscodeDialog } from "@/components/reboot/admin/ChangePasscodeDialog";
import { AuditLogViewer } from "@/components/reboot/admin/AuditLogViewer";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { Shield, KeyRound, Activity, Server, Clock, AlertCircle } from "lucide-react";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [sessionInfo, setSessionInfo] = React.useState<{
    role: string | null;
    identity: string | null;
    expiresAt: string | null;
  } | null>(null);
  const [loadingSession, setLoadingSession] = React.useState(true);

  const handleSessionExpired = React.useCallback(() => {
    router.push("/?admin=1");
  }, [router]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const { res, data, code } = await fetchJson("/api/admin/verify", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (res.status === 401 || code === "UNAUTHORIZED") {
          handleSessionExpired();
          return;
        }
        if (res.ok && data) {
          setSessionInfo({
            role: (data as Record<string, unknown>).role as string | null,
            identity: (data as Record<string, unknown>).identity as string | null,
            expiresAt: (data as Record<string, unknown>).expiresAt as string | null,
          });
        }
      } catch {
        /* silent */
      } finally {
        setLoadingSession(false);
      }
    })();
    return () => ctrl.abort();
  }, [handleSessionExpired]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-sora font-semibold text-xl text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuration de l&apos;interface admin, clés, et sécurité.
        </p>
      </div>

      {/* Session Info */}
      <section aria-label="Informations de session" className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Session</MonoLabel>
        </div>
        {loadingSession ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : sessionInfo ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-elevated/50 border border-border/40 p-3">
              <span className="mono-label text-xs text-muted-foreground block mb-1">Rôle</span>
              <span className="text-sm font-medium text-foreground capitalize">{sessionInfo.role ?? "—"}</span>
            </div>
            <div className="rounded-md bg-elevated/50 border border-border/40 p-3">
              <span className="mono-label text-xs text-muted-foreground block mb-1">Identité</span>
              <span className="text-sm font-medium text-foreground font-mono truncate block">{sessionInfo.identity ?? "—"}</span>
            </div>
            <div className="rounded-md bg-elevated/50 border border-border/40 p-3">
              <span className="mono-label text-xs text-muted-foreground block mb-1">Expire le</span>
              <span className="text-sm font-medium text-foreground">
                {sessionInfo.expiresAt
                  ? new Date(sessionInfo.expiresAt).toLocaleString("fr-FR")
                  : "—"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Informations non disponibles.</p>
        )}
      </section>

      {/* Passcode Management */}
      <section aria-label="Gestion du passcode" className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Passcode</MonoLabel>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Le passcode est la clé d&apos;accès principal. Le changer révoque toutes les clés existantes
          et déconnecte toutes les sessions actives.
        </p>
        <ChangePasscodeDialog
          onSessionExpired={handleSessionExpired}
          onChanged={() => router.refresh()}
        />
      </section>

      {/* Admin Keys */}
      <section aria-label="Clés admin" className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Clés admin</MonoLabel>
        </div>
        <AdminKeysManager onSessionExpired={handleSessionExpired} />
      </section>

      {/* Audit Log */}
      <section aria-label="Journal d'audit" className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Journal d&apos;audit</MonoLabel>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Historique de toutes les actions admin (connexions, rotations de clé, modifications de membres…).
        </p>
        <AuditLogViewer onSessionExpired={handleSessionExpired} />
      </section>
    </div>
  );
}
