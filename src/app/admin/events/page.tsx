"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Globe,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AdminEventList } from "./_components/AdminEventList";

const TYPE_OPTIONS = [
  { value: "session", label: "Session" },
  { value: "workshop", label: "Workshop" },
  { value: "meetup", label: "Meetup" },
  { value: "webinar", label: "Webinaire" },
  { value: "other", label: "Autre" },
] as const;

const DOMAIN_OPTIONS = [
  { value: "web", label: "Web" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "ai", label: "AI" },
] as const;

const LEVEL_OPTIONS = [
  { value: "beginner", label: "Débutant" },
  { value: "practicing", label: "Pratiquant" },
  { value: "autonomous", label: "Autonome" },
  { value: "advanced", label: "Avancé" },
] as const;

const RECURRENCE_OPTIONS = [
  { value: "", label: "One-shot" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "biweekly", label: "Toutes les 2 semaines" },
  { value: "monthly", label: "Mensuel" },
] as const;

export default function AdminEventsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [refreshSignal, setRefreshSignal] = React.useState(0);

  const [form, setForm] = React.useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    location: "",
    url: "",
    type: "session",
    domain: "",
    level: "",
    recurrence: "",
    maxAttendees: "",
    notify: true,
  });

  const update = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        location: form.location || null,
        url: form.url || null,
        type: form.type,
        domain: form.domain || null,
        level: form.level || null,
        recurrence: form.recurrence || null,
        maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
        notify: form.notify,
      };

      const result = await fetchJson("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (result.error) {
        setError(result.error);
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setSuccess(true);
      toast({
        title: "Événement créé",
        description: `${result.data?.event?.title} — notification envoyée à ${result.data?.notify?.recipientCount ?? 0} membres.`,
      });

      // Reset form
      setForm((f) => ({
        ...f,
        title: "",
        description: "",
        startsAt: "",
        endsAt: "",
        location: "",
        url: "",
        maxAttendees: "",
      }));

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setRefreshSignal((n) => n + 1);
    } catch (err) {
      if (isAbortError(err)) return;
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <header>
          <h1 className="font-display font-bold text-2xl tracking-tight">
            Événements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pilote l&apos;agenda membre : statuts, édition, renotification, suppression.
          </p>
        </header>
        <AdminEventList refreshSignal={refreshSignal} />
      </section>

      <section className="space-y-6">
        <header>
          <h2 className="font-display font-bold text-xl tracking-tight">
            Nouvel événement
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Créer un événement et notifier tous les membres approuvés.
          </p>
        </header>

      {success && (
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="size-4 shrink-0" />
          Événement créé avec succès. Les notifications sont en cours d&apos;envoi.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Titre */}
        <div className="space-y-2">
          <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
            Titre
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="ex: Session pratique Web Dev"
            required
            minLength={3}
            maxLength={200}
            className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Détails de l&apos;événement..."
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors resize-y"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Date de début
            </label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => update("startsAt", e.target.value)}
              required
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Date de fin (optionnel)
            </label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => update("endsAt", e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            />
          </div>
        </div>

        {/* Type + Domaine + Niveau */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Domaine
            </label>
            <select
              value={form.domain}
              onChange={(e) => update("domain", e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            >
              <option value="">Tous</option>
              {DOMAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Niveau
            </label>
            <select
              value={form.level}
              onChange={(e) => update("level", e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            >
              <option value="">Tous</option>
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lieu + URL + Capacité */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Lieu
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="ex: WhatsApp, Salle 1, Zoom"
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Lien externe
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Places max (optionnel)
            </label>
            <input
              type="number"
              min={1}
              max={9999}
              value={form.maxAttendees}
              onChange={(e) => update("maxAttendees", e.target.value)}
              placeholder="Illimité"
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            />
          </div>
        </div>

        {/* Récurrence + Notification */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium mono-label text-muted-foreground uppercase">
              Récurrence
            </label>
            <select
              value={form.recurrence}
              onChange={(e) => update("recurrence", e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-lime/50 focus:ring-1 focus:ring-lime/30 transition-colors"
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.notify}
                onChange={(e) => update("notify", e.target.checked)}
                className="size-4 rounded border-border/60 bg-background accent-lime"
              />
              <span className="text-sm text-muted-foreground">
                Notifier tous les membres approuvés
              </span>
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-lime px-6 py-2.5 text-sm font-medium text-background transition-colors",
              loading && "opacity-60 cursor-not-allowed",
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {loading ? "Création..." : "Créer l&apos;événement"}
          </button>
        </div>
      </form>
      </section>
    </div>
  );
}
