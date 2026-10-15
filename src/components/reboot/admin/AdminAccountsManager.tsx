"use client";

import * as React from "react";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { ConfirmDialog } from "@/components/reboot/admin/ConfirmDialog";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";

/**
 * Gestion des comptes admin (operator only).
 *
 * Affiche les comptes nominatifs (rôle, 2FA, dernière connexion) + les
 * invitations en attente, et permet d'inviter, changer un rôle, réinitialiser
 * une 2FA perdue ou révoquer un accès. Le garde-fou « dernier operator »
 * vit côté serveur (409 LAST_OPERATOR).
 */

interface AdminRow {
  id: string;
  email: string;
  name: string | null;
  role: "operator" | "viewer";
  banned: boolean;
  twoFactorEnabled: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  createdBy: string | null;
  activeSessions: number;
}

interface InvitationRow {
  id: string;
  email: string;
  name: string | null;
  role: "operator" | "viewer";
  expiresAt: string;
  invitedBy: string | null;
  createdAt: string;
}

export function AdminAccountsManager({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [admins, setAdmins] = React.useState<AdminRow[]>([]);
  const [invitations, setInvitations] = React.useState<InvitationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Formulaire d'invitation
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"operator" | "viewer">("viewer");
  const [inviting, setInviting] = React.useState(false);
  const [inviteFeedback, setInviteFeedback] = React.useState<string | null>(null);

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<
    { kind: "reset2fa" | "revoke"; id: string; email: string } | null
  >(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { res, data, code } = await fetchJson("/api/admin/admins", { cache: "no-store" });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (res.status === 403) {
        setError("Réservé aux opérateurs.");
        return;
      }
      if (!res.ok) {
        setError("Chargement impossible.");
        return;
      }
      const payload = data as { admins: AdminRow[]; invitations: InvitationRow[] };
      setAdmins(payload.admins);
      setInvitations(payload.invitations);
    } catch {
      setError("Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteFeedback(null);
    setInviting(true);
    try {
      const { res, data, code } = await fetchJson("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
          role: inviteRole,
        }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (res.ok) {
        setInviteFeedback(`Invitation envoyée à ${inviteEmail.trim()} (${inviteRole}).`);
        setInviteEmail("");
        setInviteName("");
        void load();
      } else if (code === "USER_EXISTS") {
        setInviteFeedback("Un compte admin existe déjà pour cet email.");
      } else if (code === "EMAIL_FAILED") {
        setInviteFeedback("Compte invité mais l'email n'a pas pu être envoyé — réessaie.");
      } else {
        setInviteFeedback("Invitation impossible.");
      }
    } catch {
      setInviteFeedback("Invitation impossible.");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (id: string, role: "operator" | "viewer") => {
    setBusyId(id);
    setError(null);
    try {
      const { res, code } = await fetchJson("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      if (!res.ok) {
        setError(
          code === "LAST_OPERATOR"
            ? "Impossible : c'est le dernier operator."
            : "Changement de rôle refusé.",
        );
        return;
      }
      void load();
    } catch {
      setError("Changement de rôle impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReset2fa = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const { res } = await fetchJson(`/api/admin/admins/${id}/reset-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setDialogError("Réinitialisation 2FA impossible.");
        return;
      }
      setPending(null);
      void load();
    } catch {
      setDialogError("Réinitialisation 2FA impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const { res, code } = await fetchJson(`/api/admin/admins?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDialogError(
          code === "LAST_OPERATOR"
            ? "Impossible : c'est le dernier operator."
            : code === "SELF_REVOKE"
              ? "Tu ne peux pas révoquer ton propre accès."
              : "Révocation impossible.",
        );
        return;
      }
      setPending(null);
      void load();
    } catch {
      setDialogError("Révocation impossible.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Chargement des comptes admin…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2"
          role="alert"
        >
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Invitation */}
      <form onSubmit={handleInvite} className="rounded-md border border-border/60 bg-elevated/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Inviter un admin</MonoLabel>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <div>
            <label htmlFor="invite-email" className="mono-label text-xs text-muted-foreground block mb-1">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              spellCheck={false}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
              placeholder="prenom@hashcode.fr"
            />
          </div>
          <div>
            <label htmlFor="invite-name" className="mono-label text-xs text-muted-foreground block mb-1">
              Prénom (optionnel)
            </label>
            <input
              id="invite-name"
              type="text"
              maxLength={120}
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              disabled={inviting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50"
              placeholder="Awa"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="mono-label text-xs text-muted-foreground block mb-1">
              Rôle
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "operator" | "viewer")}
              disabled={inviting}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50 min-h-[38px]"
            >
              <option value="viewer">Lecteur</option>
              <option value="operator">Opérateur</option>
            </select>
          </div>
          <div className="flex items-end">
            <RebootButton type="submit" size="sm" disabled={inviting} className="gap-2 min-h-[38px]">
              {inviting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
              Inviter
            </RebootButton>
          </div>
        </div>
        {inviteFeedback && <p className="text-xs text-muted-foreground">{inviteFeedback}</p>}
      </form>

      {/* Comptes */}
      <div className="rounded-md border border-border/60 divide-y divide-border/40">
        <div className="flex items-center gap-2 px-4 py-3">
          <Users className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Comptes admin ({admins.length})</MonoLabel>
        </div>
        {admins.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Aucun compte admin.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {admins.map((a) => (
              <li key={a.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {a.name ? `${a.name} — ` : ""}
                    <span className="font-mono">{a.email}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span>{a.role === "operator" ? "Opérateur" : "Lecteur"}</span>
                    <span className="flex items-center gap-1">
                      {a.twoFactorEnabled ? (
                        <>
                          <ShieldCheck className="size-3 text-lime" aria-hidden /> 2FA active
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="size-3 text-amber-400" aria-hidden /> 2FA inactive
                        </>
                      )}
                    </span>
                    {a.lastSignInAt && (
                      <span title={new Date(a.lastSignInAt).toLocaleString("fr-FR")}>
                        vu {new Date(a.lastSignInAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                    {a.activeSessions > 0 && <span>{a.activeSessions} session(s) active(s)</span>}
                    {a.banned && <span className="text-destructive">suspendu</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Rôle de ${a.email}`}
                    value={a.role}
                    disabled={busyId === a.id}
                    onChange={(e) => void handleRoleChange(a.id, e.target.value as "operator" | "viewer")}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="viewer">Lecteur</option>
                    <option value="operator">Opérateur</option>
                  </select>
                  <RebootButton
                    variant="outline"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => {
                      setDialogError(null);
                      setPending({ kind: "reset2fa", id: a.id, email: a.email });
                    }}
                    className="gap-1.5"
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Reset 2FA</span>
                  </RebootButton>
                  <RebootButton
                    variant="ghost"
                    size="sm"
                    disabled={busyId === a.id}
                    onClick={() => {
                      setDialogError(null);
                      setPending({ kind: "revoke", id: a.id, email: a.email });
                    }}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Révoquer</span>
                  </RebootButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invitations en attente */}
      {invitations.length > 0 && (
        <div className="rounded-md border border-border/60 divide-y divide-border/40">
          <div className="flex items-center gap-2 px-4 py-3">
            <Clock className="size-4 text-amber-400" aria-hidden />
            <MonoLabel className="text-muted-foreground">
              Invitations en attente ({invitations.length})
            </MonoLabel>
          </div>
          <ul className="divide-y divide-border/40">
            {invitations.map((i) => (
              <li key={i.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate font-mono">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.role === "operator" ? "Opérateur" : "Lecteur"} — expire le{" "}
                    {new Date(i.expiresAt).toLocaleDateString("fr-FR")}
                    {i.invitedBy ? ` — invité par ${i.invitedBy}` : ""}
                  </p>
                </div>
                <RebootButton
                  variant="ghost"
                  size="sm"
                  disabled={busyId === i.id}
                  onClick={() => void handleRevokeInvitation(i)}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">Annuler</span>
                </RebootButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title={
            pending.kind === "reset2fa"
              ? `Réinitialiser la 2FA de ${pending.email} ?`
              : `Révoquer l'accès admin de ${pending.email} ?`
          }
          description={
            pending.kind === "reset2fa"
              ? "Ses sessions seront fermées et il devra réenroler sa 2FA."
              : "Cette action est définitive."
          }
          confirmLabel={pending.kind === "reset2fa" ? "Réinitialiser" : "Révoquer"}
          pending={busyId === pending.id}
          error={dialogError}
          onClose={() => {
            if (busyId !== pending.id) setPending(null);
          }}
          onConfirm={() =>
            pending.kind === "reset2fa"
              ? void handleReset2fa(pending.id)
              : void handleRevoke(pending.id)
          }
        />
      )}
    </div>
  );

  async function handleRevokeInvitation(invitation: InvitationRow) {
    setBusyId(invitation.id);
    setError(null);
    try {
      const { res } = await fetchJson(
        `/api/admin/invite?email=${encodeURIComponent(invitation.email)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setError("Annulation impossible.");
        return;
      }
      void load();
    } catch {
      setError("Annulation impossible.");
    } finally {
      setBusyId(null);
    }
  }
}
