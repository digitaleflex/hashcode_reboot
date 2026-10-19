"use client";

import * as React from "react";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { ConfirmDialog } from "@/components/reboot/admin/ConfirmDialog";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import {
  Users,
  UserPlus,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";

/**
 * Gestion des comptes admin (operator only).
 *
 * Affiche les membres ayant un `adminRole` (rôle, dernière connexion) et
 * permet d'accorder l'accès à un membre existant (email), de changer un rôle
 * ou de révoquer un accès. Les garde-fous « dernier operator » et « pas sur
 * soi-même » vivent côté serveur (409 LAST_OPERATOR / SELF_REVOKE).
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

  // Formulaire d'octroi d'accès (promotion d'un membre existant)
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"operator" | "viewer">("viewer");
  const [inviting, setInviting] = React.useState(false);
  const [inviteFeedback, setInviteFeedback] = React.useState<string | null>(null);

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<
    { kind: "revoke"; id: string; email: string } | null
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
    const email = inviteEmail.trim();
    try {
      const { res, code } = await fetchJson("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (res.ok) {
        const label = inviteRole === "operator" ? "opérateur" : "lecteur";
        setInviteFeedback(`Accès ${label} accordé à ${email}.`);
        setInviteEmail("");
        void load();
      } else if (code === "NO_MEMBER") {
        setInviteFeedback(
          "Aucun compte membre pour cet email. La personne doit d'abord créer son compte (connexion par email).",
        );
      } else if (code === "LAST_OPERATOR") {
        setInviteFeedback("Impossible : c'est le dernier operator.");
      } else {
        setInviteFeedback("Attribution impossible.");
      }
    } catch {
      setInviteFeedback("Attribution impossible.");
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
            : code === "SELF_REVOKE"
              ? "Tu ne peux pas modifier ton propre rôle."
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

      {/* Octroi d'accès (membre existant) */}
      <form onSubmit={handleInvite} className="rounded-md border border-border/60 bg-elevated/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4 text-lime" aria-hidden />
          <MonoLabel className="text-muted-foreground">Accorder l&apos;accès admin</MonoLabel>
        </div>
        <p className="text-xs text-muted-foreground">
          L&apos;email doit correspondre à un membre existant. La personne crée son
          compte via la connexion par email, puis tu lui accordes l&apos;accès ici.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label htmlFor="invite-email" className="mono-label text-xs text-muted-foreground block mb-1">
              Email du membre
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
              Accorder
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
          title={`Révoquer l'accès admin de ${pending.email} ?`}
          description="Son compte membre est conservé ; seul l'accès admin est retiré."
          confirmLabel="Révoquer"
          pending={busyId === pending.id}
          error={dialogError}
          onClose={() => {
            if (busyId !== pending.id) setPending(null);
          }}
          onConfirm={() => void handleRevoke(pending.id)}
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
