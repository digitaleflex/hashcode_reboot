"use client";

import * as React from "react";
import { MonoLabel, RebootButton, Tag } from "../shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { countryFlag, countryName } from "@/lib/profiling/countries";
import { Check, Copy, Trash2 } from "lucide-react";
import { fetchJson, isAbortError, withRetryAfter } from "./lib/fetchJson";

const DOMAIN_LABEL: Record<string, string> = {
  web: "Web",
  cybersecurity: "Cyber",
  ai: "AI",
};
const LEVEL_LABEL: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratique",
  autonomous: "Autonome",
  advanced: "Avancé",
};
const GOAL_LABEL: Record<string, string> = {
  project: "Projet",
  employment: "Emploi",
  freelance: "Freelance",
  upskill: "Compétences",
  business: "Activité",
  career: "Carrière",
  other: "Autre",
};
const BUDGET_LABEL: Record<string, string> = {
  "<2500": "< 2.5k",
  "2500-5000": "2.5–5k",
  "5000-10000": "5–10k",
  "10000-20000": "10–20k",
  "20000-30000": "20–30k",
  ">30000": "> 30k",
  unknown: "NSP",
};

/* ------------------------------------------------------------------ */
/* Detail dialog with status controls                                  */
/* ------------------------------------------------------------------ */

export function MemberDetailDialog({
  id,
  onClose,
  onChanged,
  onDelete,
  onSessionExpired,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
  onDelete: (id: string) => Promise<void>;
  onSessionExpired?: () => void;
}) {
  const [member, setMember] = React.useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      setMember(null);
      setDialogError(null);
      return;
    }
    const ctrl = new AbortController();
    let mounted = true;
    setLoading(true);
    setDialogError(null);
    (async () => {
      try {
        const { res, data, error, code, retryAfterSec } = await fetchJson(
          `/api/members/${id}`,
          {
            cache: "no-store",
            signal: ctrl.signal,
          },
        );
        if (ctrl.signal.aborted) return;
        if (res.status === 401 || code === "UNAUTHORIZED") {
          if (onSessionExpired) onSessionExpired();
          return;
        }
        if (!res.ok) {
          const base = error ?? "Membre introuvable.";
          throw new Error(
            res.status === 429 || code === "RATE_LIMITED"
              ? withRetryAfter(base, retryAfterSec)
              : base,
          );
        }
        if (mounted)
          setMember((data?.member ?? null) as Record<string, unknown> | null);
      } catch (e) {
        if (isAbortError(e)) return;
        if (mounted) {
          setMember(null);
          setDialogError(
            e instanceof Error ? e.message : "Erreur de chargement du membre.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [id, onSessionExpired]);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    if (!id) return false;
    setDialogError(null);
    try {
      const { res, error, code, retryAfterSec } = await fetchJson(
        `/api/members/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.status === 401 || code === "UNAUTHORIZED") {
        if (onSessionExpired) onSessionExpired();
        setDialogError("Session expirée. Reconnecte-toi.");
        return false;
      }
      if (!res.ok) {
        const base = error ?? "Échec de la mise à jour.";
        setDialogError(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
        return false;
      }
      // Refresh detail + table.
      const refreshed = await fetchJson(`/api/members/${id}`, {
        cache: "no-store",
      });
      if (refreshed.res.ok && refreshed.data?.member) {
        setMember(refreshed.data.member as Record<string, unknown>);
      }
      onChanged();
      return true;
    } catch (e) {
      if (isAbortError(e)) return false;
      const msg = e instanceof Error ? e.message : "Échec de la mise à jour.";
      setDialogError(msg);
      return false;
    }
  }

  async function invite(): Promise<{
    inviteMessage: string;
    whatsappUrl: string;
  } | null> {
    if (!id) return null;
    setDialogError(null);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson(
        `/api/members/${id}/invite`,
        {
          method: "POST",
        },
      );
      if (res.status === 401 || code === "UNAUTHORIZED") {
        if (onSessionExpired) onSessionExpired();
        throw new Error("Session expirée. Reconnecte-toi.");
      }
      if (!res.ok) {
        const base = error ?? "Échec de l'invitation.";
        throw new Error(
          res.status === 429 || code === "RATE_LIMITED"
            ? withRetryAfter(base, retryAfterSec)
            : base,
        );
      }
      // Refresh detail + table after status change.
      const refreshed = await fetchJson(`/api/members/${id}`, {
        cache: "no-store",
      });
      if (refreshed.res.ok && refreshed.data?.member) {
        setMember(refreshed.data.member as Record<string, unknown>);
      }
      onChanged();
      if (!data?.inviteMessage || !data?.whatsappUrl) {
        throw new Error("Réponse d'invitation incomplète.");
      }
      return {
        inviteMessage: data.inviteMessage,
        whatsappUrl: data.whatsappUrl,
      };
    } catch (e) {
      if (isAbortError(e)) return null;
      const msg = e instanceof Error ? e.message : "Échec de l'invitation.";
      setDialogError(msg);
      return null;
    }
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">
            Détail du membre
          </DialogTitle>
        </DialogHeader>
        {dialogError && (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-foreground animate-hash-in"
            role="alert"
          >
            <span className="text-destructive">{dialogError}</span>
          </p>
        )}
        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!loading && member && (
          <MemberDetail
            member={member}
            onPatch={patch}
            onInvite={invite}
            onDelete={() => {
              if (id) return onDelete(id);
              return Promise.resolve();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberDetail({
  member,
  onPatch,
  onInvite,
  onDelete,
}: {
  member: Record<string, unknown>;
  onPatch: (b: Record<string, unknown>) => Promise<boolean>;
  onInvite: () => Promise<{
    inviteMessage: string;
    whatsappUrl: string;
  } | null>;
  onDelete: () => Promise<void>;
}) {
  const m = member as {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    country: string;
    city: string | null;
    gender: string | null;
    primaryDomain: string;
    domainSpecialty: string[];
    level: string;
    goal: string;
    goalProjectStage: string | null;
    goalSituation: string | null;
    availability: string;
    learningStyle: string;
    mentoringInterest: string | null;
    mentoringMaybeReason: string | null;
    mentoringTypes: string[];
    mentoringFrequency: string | null;
    budgetWillingness: string | null;
    budgetRange: string | null;
    threeMonthGoal: string | null;
    profileArchetype: string | null;
    tags: string[];
    profileStatus: string;
    communityStatus: string;
    accessLane: string;
    createdAt: string;
    adminNote: string | null;
  };

  const [inviteState, setInviteState] = React.useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [noteDraft, setNoteDraft] = React.useState(m.adminNote ?? "");
  const [noteSaved, setNoteSaved] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Sync note draft when member changes (e.g. after patch refresh).
  React.useEffect(() => {
    setNoteDraft(m.adminNote ?? "");
    setNoteSaved(false);
    setConfirmDelete(false);
  }, [m.id, m.adminNote]);

  async function copyField(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function handleInviteClick() {
    setInviteState("sending");
    const res = await onInvite();
    if (res) {
      const text = `${res.inviteMessage} ${res.whatsappUrl}`;
      try {
        await navigator.clipboard.writeText(text);
        setInviteState("sent");
        setTimeout(() => setInviteState("idle"), 2500);
      } catch {
        setInviteState("idle");
      }
    } else {
      setInviteState("idle");
    }
  }

  async function saveNote() {
    const ok = await onPatch({ adminNote: noteDraft.trim() || null });
    if (ok) {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const rows: [string, React.ReactNode][] = [
    ["Identité", `${m.firstName} ${m.lastName ?? ""}`.trim()],
    [
      "Email",
      // eslint-disable-next-line react/jsx-key
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-xs">{m.email}</span>
        <button
          onClick={() => copyField("email", m.email)}
          className="text-muted-foreground hover:text-lime transition-colors focus-lime"
          title="Copier l'email"
          aria-label="Copier l'email"
        >
          {copiedField === "email" ? (
            <Check className="size-3 text-lime" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
      </span>,
    ],
    [
      "Téléphone",
      m.phone ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-xs">{m.phone}</span>
          <button
            onClick={() => copyField("phone", m.phone!)}
            className="text-muted-foreground hover:text-lime transition-colors focus-lime"
            title="Copier le téléphone"
            aria-label="Copier le téléphone"
          >
            {copiedField === "phone" ? (
              <Check className="size-3 text-lime" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </span>
      ) : (
        "—"
      ),
    ],
    [
      "Pays / Ville",
      `${countryFlag(m.country)} ${countryName(m.country)}${m.city ? " · " + m.city : ""}`,
    ],
    ["Domaine", DOMAIN_LABEL[m.primaryDomain] ?? m.primaryDomain],
    [
      "Spécialité",
      Array.isArray(m.domainSpecialty) && m.domainSpecialty.length
        ? m.domainSpecialty.join(", ")
        : "—",
    ],
    ["Niveau", LEVEL_LABEL[m.level] ?? m.level],
    ["Objectif", GOAL_LABEL[m.goal] ?? m.goal],
    ["Disponibilité", m.availability],
    ["Style", m.learningStyle],
    ["Mentorat", m.mentoringInterest ?? "—"],
    ["Budget", m.budgetRange ? BUDGET_LABEL[m.budgetRange] ?? m.budgetRange : "—"],
    ["Objectif 3 mois", m.threeMonthGoal ? `« ${m.threeMonthGoal} »` : "—"],
    ["Archétype", m.profileArchetype ?? "—"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, val]) => (
          <div key={label}>
            <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
            <div className="mt-0.5 text-sm text-foreground">{val}</div>
          </div>
        ))}
      </div>

      {m.tags.length > 0 && (
        <div>
          <MonoLabel className="text-muted-foreground">Tags</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>
      )}

      {/* Member journey timeline — visual recap of the member's path */}
      <div className="pt-4 border-t border-border/60">
        <MonoLabel className="text-muted-foreground">Parcours</MonoLabel>
        <div className="mt-4 space-y-3">
          <TimelineStep
            done
            label="Inscription"
            detail={new Date(m.createdAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
          <TimelineStep
            done={m.profileStatus === "APPROVED"}
            label="Profil validé"
            detail={
              m.profileStatus === "APPROVED"
                ? "Accès immédiat accordé"
                : "En attente de validation"
            }
            tone={m.profileStatus === "APPROVED" ? "lime" : "muted"}
          />
          <TimelineStep
            done={m.communityStatus === "INVITED" || m.communityStatus === "JOINED"}
            label="Invitation communauté"
            detail={
              m.communityStatus === "JOINED"
                ? "A rejoint la communauté"
                : m.communityStatus === "INVITED"
                  ? "Invitation envoyée"
                  : "Pas encore invité"
            }
            tone={
              m.communityStatus === "JOINED"
                ? "lime"
                : m.communityStatus === "INVITED"
                  ? "sky"
                  : "muted"
            }
          />
          <TimelineStep
            done={m.accessLane === "immediate"}
            label="WhatsApp"
            detail={
              m.accessLane === "immediate"
                ? "Lien accessible"
                : "Verrouillé (PENDING)"
            }
            tone={m.accessLane === "immediate" ? "lime" : "muted"}
            last
          />
        </div>
      </div>

      {/* Status controls */}
      <div className="pt-4 border-t border-border/60 space-y-4">
        <div>
          <MonoLabel className="text-muted-foreground">Statut profil</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {["PENDING", "APPROVED", "WAITLIST", "REJECTED"].map((s) => (
              <RebootButton
                key={s}
                size="sm"
                variant={m.profileStatus === s ? "primary" : "outline"}
                onClick={() => {
                  void onPatch({ profileStatus: s });
                }}
              >
                {s === "PENDING"
                  ? "En attente"
                  : s === "APPROVED"
                    ? "Valider"
                    : s === "WAITLIST"
                      ? "Waitlist"
                      : "Rejeter"}
              </RebootButton>
            ))}
          </div>
        </div>
        <div>
          <MonoLabel className="text-muted-foreground">Statut communauté</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {["NOT_INVITED", "INVITED", "JOINED"].map((s) => (
              <RebootButton
                key={s}
                size="sm"
                variant={m.communityStatus === s ? "primary" : "outline"}
                onClick={() => {
                  void onPatch({ communityStatus: s });
                }}
              >
                {s === "NOT_INVITED"
                  ? "Pas invité"
                  : s === "INVITED"
                    ? "Invité"
                    : "Rejoint"}
              </RebootButton>
            ))}
          </div>
        </div>

        {/* Send-invitation action — copies WhatsApp URL + personal message to clipboard */}
        <div className="pt-2">
          <MonoLabel className="text-muted-foreground">Invitation</MonoLabel>
          <div className="mt-2">
            <RebootButton
              size="sm"
              variant="outline"
              onClick={() => {
                void handleInviteClick();
              }}
              disabled={inviteState === "sending"}
              className={cn(inviteState === "sent" && "border-lime/60 text-lime")}
            >
              {inviteState === "sending"
                ? "Préparation…"
                : inviteState === "sent"
                  ? "Message copié ✓"
                  : "Préparer l'invitation (copier le message)"}
            </RebootButton>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Marque le profil comme validé + invité, et copie un message
              personnel prêt à coller dans WhatsApp.
            </p>
          </div>
        </div>

        {/* Admin notes — internal, not shown to member */}
        <div className="pt-2">
          <div className="flex items-center justify-between">
            <MonoLabel className="text-muted-foreground">Note interne</MonoLabel>
            {noteSaved && (
              <span className="mono-label text-lime">Enregistré ✓</span>
            )}
          </div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Contexte, priorité, prochain suivi… (visible admin uniquement)"
            rows={3}
            className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-lime focus:border-lime/60 resize-none scroll-slim"
          />
          <div className="mt-2 flex items-center gap-2">
            <RebootButton
              size="sm"
              variant="outline"
              onClick={() => {
                void saveNote();
              }}
              disabled={noteDraft.trim() === (m.adminNote ?? "")}
            >
              Enregistrer la note
            </RebootButton>
            {m.adminNote && (
              <button
                onClick={() => setNoteDraft("")}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime mono-label"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Valider un profil invite automatiquement à la communauté.
        </p>
      </div>

      {/* Danger zone — delete member */}
      <div className="mt-5 pt-4 border-t border-destructive/30">
        <MonoLabel className="text-destructive/80">Zone de danger</MonoLabel>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime inline-flex items-center gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Supprimer ce membre
          </button>
        ) : (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 animate-hash-in">
            <p className="text-sm text-foreground">
              Supprimer définitivement{" "}
              <span className="font-medium">{m.firstName}</span> ? Cette action
              efface aussi ses événements analytics. Irréversible.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  void handleDelete();
                }}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors focus-lime disabled:opacity-50"
              >
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors focus-lime"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Timeline step — vertical journey node with connecting line. */
function TimelineStep({
  done,
  label,
  detail,
  tone = "muted",
  last,
}: {
  done: boolean;
  label: string;
  detail: string;
  tone?: "lime" | "sky" | "muted";
  last?: boolean;
}) {
  const dotColor =
    tone === "lime"
      ? "bg-lime"
      : tone === "sky"
        ? "bg-sky-400"
        : "bg-muted-foreground/40";
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "size-2.5 rounded-full shrink-0 mt-1 transition-colors",
            dotColor,
            done && tone === "lime" && "shadow-[0_0_8px_rgba(197,244,65,0.5)]",
          )}
          aria-hidden
        />
        {!last && (
          <span className="w-px flex-1 bg-border/60 min-h-[20px] mt-1" aria-hidden />
        )}
      </div>
      <div className="flex-1 pb-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
      </div>
    </div>
  );
}
