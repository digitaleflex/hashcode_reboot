"use client";

import * as React from "react";
import { MonoLabel, RebootButton, Tag } from "../shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { countryFlag, countryName } from "@/lib/profiling/countries";
import { Check, Copy, Trash2, ExternalLink, Loader2 } from "lucide-react";
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

  const memberName =
    member && typeof member === "object"
      ? `${(member as { firstName?: string }).firstName ?? ""} ${(member as { lastName?: string | null }).lastName ?? ""}`.trim()
      : "";

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">
            {memberName ? `Membre — ${memberName}` : "Détail du membre"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Détails, statuts, invitation WhatsApp, note interne et suppression.
          </DialogDescription>
          {memberName && (
            <a
              href="#member-danger-zone"
              className="text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime w-fit"
            >
              Aller à la suppression
            </a>
          )}
        </DialogHeader>
        {dialogError && (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-foreground animate-hash-in"
            role="alert"
          >
            <span className="text-destructive">{dialogError}</span>
          </p>
        )}
        {loading && <MemberDetailSkeleton />}
        {!loading && !member && !dialogError && (
          <div className="py-8 text-center">
            <p className="text-sm text-foreground font-medium">Membre introuvable.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Il a peut-être été supprimé. Ferme et réessaie.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 inline-flex items-center min-h-[44px] px-4 rounded-md border border-border bg-card text-sm hover:border-lime/60 hover:text-lime transition-colors focus-lime"
            >
              Fermer
            </button>
          </div>
        )}
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

function MemberDetailSkeleton() {
  return (
    <div role="status" aria-label="Chargement du membre" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <span className="sr-only">Chargement du membre…</span>
    </div>
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
  const [invitePreview, setInvitePreview] = React.useState<{
    inviteMessage: string;
    whatsappUrl: string;
  } | null>(null);
  const [inviteCopyError, setInviteCopyError] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState(m.adminNote ?? "");
  const [noteSaved, setNoteSaved] = React.useState(false);
  const [noteSaving, setNoteSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [copyError, setCopyError] = React.useState<string | null>(null);

  // Sync note draft when member changes (e.g. after patch refresh).
  React.useEffect(() => {
    setNoteDraft(m.adminNote ?? "");
    setNoteSaved(false);
    setConfirmDelete(false);
  }, [m.id, m.adminNote]);

  async function copyField(field: string, value: string) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setCopyError("Copie impossible — sélectionne et copie manuellement.");
    }
  }

  async function handleInviteClick() {
    setInviteState("sending");
    setInviteCopyError(null);
    const res = await onInvite();
    if (res) {
      setInvitePreview(res);
      const text = `${res.inviteMessage} ${res.whatsappUrl}`;
      try {
        await navigator.clipboard.writeText(text);
        setInviteState("sent");
      } catch {
        setInviteCopyError("Message préparé mais copie automatique impossible — copie manuellement ci-dessous.");
        setInviteState("idle");
      }
    } else {
      setInviteState("idle");
    }
  }

  async function copyInviteAgain() {
    if (!invitePreview) return;
    try {
      await navigator.clipboard.writeText(
        `${invitePreview.inviteMessage} ${invitePreview.whatsappUrl}`,
      );
      setInviteState("sent");
      setTimeout(() => setInviteState("idle"), 2000);
    } catch {
      setInviteCopyError("Copie impossible — sélectionne le texte ci-dessous.");
    }
  }

  async function saveNote() {
    setNoteSaving(true);
    const ok = await onPatch({ adminNote: noteDraft.trim() || null });
    setNoteSaving(false);
    if (ok) {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
  }

  async function deleteSavedNote() {
    setNoteSaving(true);
    const ok = await onPatch({ adminNote: null });
    setNoteSaving(false);
    if (ok) {
      setNoteDraft("");
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

  const savedNote = m.adminNote ?? "";
  const draftDirty = noteDraft.trim() !== savedNote.trim();

  const rows: [string, React.ReactNode][] = [
    ["Identité", `${m.firstName} ${m.lastName ?? ""}`.trim()],
    [
      "Email",
      // eslint-disable-next-line react/jsx-key
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-xs break-all">{m.email}</span>
        <button
          type="button"
          onClick={() => copyField("email", m.email)}
          className="shrink-0 size-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-lime hover:bg-lime/5 transition-colors focus-lime"
          title="Copier l'email"
          aria-label={copiedField === "email" ? "Email copié" : "Copier l'email"}
        >
          {copiedField === "email" ? (
            <Check className="size-3.5 text-lime" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
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
            type="button"
            onClick={() => copyField("phone", m.phone!)}
            className="shrink-0 size-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-lime hover:bg-lime/5 transition-colors focus-lime"
            title="Copier le téléphone"
            aria-label={copiedField === "phone" ? "Téléphone copié" : "Copier le téléphone"}
          >
            {copiedField === "phone" ? (
              <Check className="size-3.5 text-lime" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
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
          <MonoLabel className="text-muted-foreground">Invitation WhatsApp</MonoLabel>
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
              {inviteState === "sending" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Préparation…
                </>
              ) : inviteState === "sent" ? (
                <>
                  <Check className="size-4" aria-hidden />
                  Message copié
                </>
              ) : (
                "Préparer l’invitation"
              )}
            </RebootButton>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Valide le profil et prépare un message personnel prêt à coller dans WhatsApp.
            </p>
            <p className="sr-only" role="status">
              {inviteState === "sent" ? "Message d’invitation copié." : ""}
              {inviteCopyError ?? ""}
            </p>
            {inviteCopyError && (
              <p className="mt-2 text-xs text-amber-200" role="alert">
                {inviteCopyError}
              </p>
            )}
            {invitePreview && (
              <div className="mt-3 rounded-md border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-medium text-foreground">Aperçu du message</p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {invitePreview.inviteMessage}
                </p>
                <p className="mt-1.5 text-xs font-mono text-lime break-all">
                  {invitePreview.whatsappUrl}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <a
                    href={invitePreview.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-md bg-lime text-black text-sm font-medium hover:bg-lime/90 transition-colors focus-lime"
                  >
                    Ouvrir WhatsApp
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyInviteAgain()}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-md border border-border bg-card text-sm text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime"
                  >
                    <Copy className="size-3.5" aria-hidden />
                    Copier à nouveau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin notes — internal, not shown to member */}
        <div className="pt-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="admin-note" className="mono-label text-muted-foreground">
              Note interne — visible admin uniquement
            </label>
            {noteSaved && (
              <span className="mono-label text-lime" role="status">Enregistré</span>
            )}
          </div>
          <textarea
            id="admin-note"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Contexte, priorité, prochain suivi…"
            rows={3}
            className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-lime focus:border-lime/60 resize-none scroll-slim"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RebootButton
              size="sm"
              variant="outline"
              onClick={() => {
                void saveNote();
              }}
              disabled={!draftDirty || noteSaving}
            >
              {noteSaving ? "Enregistrement…" : "Enregistrer la note"}
            </RebootButton>
            {draftDirty && savedNote && (
              <button
                type="button"
                onClick={() => setNoteDraft(savedNote)}
                className="min-h-[44px] px-2 text-xs text-muted-foreground hover:text-foreground transition-colors focus-lime mono-label"
              >
                Effacer le brouillon
              </button>
            )}
            {savedNote && !draftDirty && (
              <button
                type="button"
                onClick={() => void deleteSavedNote()}
                disabled={noteSaving}
                className="min-h-[44px] px-2 text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime mono-label disabled:opacity-50"
              >
                Supprimer la note
              </button>
            )}
          </div>
          {copyError && (
            <p className="mt-2 text-xs text-amber-200" role="alert">{copyError}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Valider un profil invite automatiquement à la communauté.
        </p>
      </div>

      {/* Danger zone — delete member */}
      <div id="member-danger-zone" className="mt-5 pt-4 border-t border-destructive/30 scroll-mt-24">
        <MonoLabel className="text-destructive/80">Suppression</MonoLabel>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-2 min-h-[44px] text-xs text-muted-foreground hover:text-destructive transition-colors focus-lime inline-flex items-center gap-1.5 px-1"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Supprimer ce membre
          </button>
        ) : (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 animate-hash-in">
            <p className="text-sm text-foreground">
              Supprimer définitivement{" "}
              <span className="font-medium">{m.firstName}</span> ? Cette action
              efface aussi ses événements. Irréversible.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleDelete();
                }}
                disabled={deleting}
                className="min-h-[44px] text-xs px-3 py-1.5 rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors focus-lime disabled:opacity-50"
              >
                {deleting ? "Suppression…" : "Oui, supprimer définitivement"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[44px] text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors focus-lime"
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
