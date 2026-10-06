"use client";

import * as React from "react";
import { AuditLogViewer } from "@/components/reboot/admin/AuditLogViewer";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { useAdminQuery } from "@/components/reboot/admin/lib/adminQuery";
import { Activity, Server, Clock, AlertCircle } from "lucide-react";

export default function AdminSettingsPage() {
  /**
   * D25 + D32 : le 3e `handleSessionExpired` du dépôt disparaît, avec son
   * `useEffect` et son `AbortController`. La lecture de `/api/admin/verify`
   * devient une query ; un 401 y redirige seul, sans passer par un callback.
   *
   * `retry: false` : la route est interrogée au montage et rien d'autre. Sans
   * cela React Query réessaierait 3 fois un 401 en boucle — exactement le
   * symptôme décrit dans `admin-auth.ts`.
   */
  const verify = useAdminQuery<{
    role?: string | null;
    identity?: string | null;
    expiresAt?: string | null;
  } | null>({
    queryKey: ["admin", "verify"],
    url: "/api/admin/verify",
    init: { cache: "no-store" },
    retry: false,
  });

  const sessionInfo = verify.data ?? null;
  const loadingSession = verify.isLoading;

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

      

      {/* Audit Log */}
      <section aria-label="Journal d'audit" className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Journal d&apos;audit</MonoLabel>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Historique de toutes les actions admin (connexions, rotations de clé, modifications de membres…).
        </p>
        <AuditLogViewer />
      </section>
    </div>
  );
}
