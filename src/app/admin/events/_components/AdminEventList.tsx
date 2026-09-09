"use client";

import * as React from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Pencil,
  Trash2,
  Send,
  Loader2,
  RefreshCw,
  X,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";

interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  url: string | null;
  type: string;
  domain: string | null;
  level: string | null;
  status: string;
  recurrence: string | null;
  maxAttendees: number | null;
  notifiedAt: string | null;
  goingCount: number;
  maybeCount: number;
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  live: "bg-red-500/15 text-red-300 border-red-500/30",
  completed: "bg-muted text-muted-foreground border-border/60",
  cancelled: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planifié",
  live: "En direct",
  completed: "Terminé",
  cancelled: "Annulé",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }) +
    " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Liste de pilotage admin : compteurs RSVP + changement de statut
 * + édition + renotification + suppression.
 */
export function AdminEventList({ refreshSignal }: { refreshSignal: number }) {
  const { toast } = useToast();
  const [events, setEvents] = React.useState<AdminEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AdminEvent | null>(null);
  const [editForm, setEditForm] = React.useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    location: "",
    url: "",
    type: "session",
    domain: "",
    level: "",
    status: "scheduled",
    maxAttendees: "",
  });
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { res, data } = await fetchJson("/api/events?status=all&limit=50");
      if (res.ok) setEvents(data.events ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  async function handleStatus(id: string, status: string) {
    setActionId(id);
    try {
      const { res, error } = await fetchJson(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast({ title: "Erreur", description: error ?? "Échec", variant: "destructive" });
        return;
      }
      toast({ title: "Statut mis à jour", description: STATUS_LABELS[status] ?? status });
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function handleRenotify(id: string) {
    setActionId(id);
    try {
      const { res, data, error } = await fetchJson(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify: true }),
      });
      if (!res.ok) {
        toast({ title: "Erreur", description: error ?? "Échec", variant: "destructive" });
        return;
      }
      toast({
        title: "Notifications renvoyées",
        description: `${data?.notify?.recipientCount ?? 0} membres notifiés.`,
      });
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Supprimer "${title}" ? Les RSVP seront supprimés aussi.`)) return;
    setActionId(id);
    try {
      const { res, error } = await fetchJson(`/api/events/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast({ title: "Erreur", description: error ?? "Échec", variant: "destructive" });
        return;
      }
      toast({ title: "Événement supprimé" });
      await load();
    } finally {
      setActionId(null);
    }
  }

  function openEdit(ev: AdminEvent) {
    setEditing(ev);
    setEditForm({
      title: ev.title,
      description: ev.description ?? "",
      startsAt: toLocalInput(ev.startsAt),
      endsAt: toLocalInput(ev.endsAt),
      location: ev.location ?? "",
      url: ev.url ?? "",
      type: ev.type,
      domain: ev.domain ?? "",
      level: ev.level ?? "",
      status: ev.status,
      maxAttendees: ev.maxAttendees ? String(ev.maxAttendees) : "",
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const { res, error } = await fetchJson(`/api/events/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          startsAt: editForm.startsAt,
          endsAt: editForm.endsAt || null,
          location: editForm.location || null,
          url: editForm.url || null,
          type: editForm.type,
          domain: editForm.domain || null,
          level: editForm.level || null,
          status: editForm.status,
          maxAttendees: editForm.maxAttendees ? Number(editForm.maxAttendees) : null,
        }),
      });
      if (!res.ok) {
        toast({ title: "Erreur", description: error ?? "Échec", variant: "destructive" });
        return;
      }
      toast({ title: "Événement mis à jour" });
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 rounded-lg border border-border/60 bg-card/40">
        <Calendar className="size-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Aucun événement pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground mono-label">
          {events.length} événement{events.length > 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <RefreshCw className="size-3.5" />
          Actualiser
        </button>
      </div>

      {events.map((ev) => {
        const busy = actionId === ev.id;
        return (
          <div
            key={ev.id}
            className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium truncate">{ev.title}</h3>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium mono-label",
                      STATUS_STYLES[ev.status] ?? STATUS_STYLES.scheduled,
                    )}
                  >
                    {STATUS_LABELS[ev.status] ?? ev.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDate(ev.startsAt)}
                  </span>
                  {ev.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {ev.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-lime">
                    <Users className="size-3" />
                    {ev.goingCount} inscrit{ev.goingCount > 1 ? "s" : ""}
                    {ev.maybeCount > 0 && (
                      <span className="text-muted-foreground">· {ev.maybeCount} peut-être</span>
                    )}
                  </span>
                  {ev.maxAttendees && (
                    <span className="text-muted-foreground/60">
                      / {ev.maxAttendees} places
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(["scheduled", "live", "completed", "cancelled"] as const)
                .filter((s) => s !== ev.status)
                .slice(0, 2)
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStatus(ev.id, s)}
                    className="rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground cursor-pointer disabled:opacity-50"
                  >
                    → {STATUS_LABELS[s]}
                  </button>
                ))}
              <span className="flex-1" />
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRenotify(ev.id)}
                title="Renvoyer l'email à tous les APPROVED"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime cursor-pointer disabled:opacity-50"
              >
                <Send className="size-3.5" />
                Renotifier
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => openEdit(ev)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-lime/40 hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                <Pencil className="size-3.5" />
                Éditer
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete(ev.id, ev.title)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-300 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </button>
            </div>
          </div>
        );
      })}

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-border/60 bg-card p-5 space-y-4 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold">Modifier l&apos;événement</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                required
                minLength={3}
                placeholder="Titre"
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:border-lime/50"
              />
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Description"
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:border-lime/50 resize-y"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="datetime-local"
                  value={editForm.startsAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, startsAt: e.target.value }))}
                  required
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                />
                <input
                  type="datetime-local"
                  value={editForm.endsAt}
                  onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Lieu"
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                />
                <input
                  type="url"
                  value={editForm.url}
                  onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                >
                  <option value="session">Session</option>
                  <option value="workshop">Workshop</option>
                  <option value="meetup">Meetup</option>
                  <option value="webinar">Webinaire</option>
                  <option value="other">Autre</option>
                </select>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                >
                  <option value="scheduled">Planifié</option>
                  <option value="live">En direct</option>
                  <option value="completed">Terminé</option>
                  <option value="cancelled">Annulé</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={editForm.maxAttendees}
                  onChange={(e) => setEditForm((f) => ({ ...f, maxAttendees: e.target.value }))}
                  placeholder="Places"
                  className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-background hover:bg-lime/90 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
