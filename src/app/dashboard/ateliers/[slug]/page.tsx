"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Loader2,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionStateBadge } from "../_components/SessionStateBadge";

/**
 * /dashboard/ateliers/[slug] — vue d'ensemble du parcours : semaines →
 * séances, états & locks dérivés serveur, prochain créneau des séances
 * débloquées. Client Component : consomme GET /api/workshops/[slug].
 *
 * Les séances verrouillées n'affichent QUE leur titre + un cadenas —
 * l'API ne renvoie d'ailleurs AUCUN contenu pour elles (elle omet
 * objective/hasDeliverable/event), donc le rendu ne peut pas fuiter.
 */

type SessionState =
  | "LOCKED"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "REVISION"
  | "REJECTED"
  | "COMPLETED";

interface WorkshopEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  url: string | null;
}

interface SessionListItem {
  id: string;
  number: number;
  title: string;
  state: SessionState;
  objective?: string | null;
  hasDeliverable?: boolean;
  hasQuiz?: boolean;
  deliverableRequired?: boolean;
  quizRequired?: boolean;
  eventId?: string | null;
  event?: WorkshopEvent | null;
}

interface Week {
  id: string;
  number: number;
  title: string;
  objective: string | null;
  sessions: SessionListItem[];
}

interface WorkshopSummary {
  total: number;
  completed: number;
  percent: number;
  nextSessionIndex: number | null;
  isComplete: boolean;
}

interface Enrollment {
  status: string;
  enrolledAt: string;
}

interface WorkshopInfo {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  domain: string | null;
  level: string | null;
  status: string;
}

interface WorkshopDetailResponse {
  workshop: WorkshopInfo;
  enrollment: Enrollment | null;
  summary: WorkshopSummary;
  weeks: Week[];
}

const DOMAIN_LABELS: Record<string, string> = {
  web: "Web",
  cybersecurity: "Cyber",
  ai: "AI",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratiquant",
  autonomous: "Autonome",
  advanced: "Avancé",
};

function sessionNumberLabel(n: number): string {
  return `S${String(n).padStart(2, "0")}`;
}

function formatEventDate(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AtelierDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const [data, setData] = React.useState<WorkshopDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [enrolling, setEnrolling] = React.useState(false);
  const [enrollError, setEnrollError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workshops/${slug}`, { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Impossible de charger l'atelier.");
        }
        const body = (await res.json()) as WorkshopDetailResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger l'atelier.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleEnroll() {
    setEnrolling(true);
    setEnrollError(null);
    try {
      const res = await fetch(`/api/workshops/${slug}/enroll`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Impossible de rejoindre l'atelier.");
      }
      const body = (await res.json()) as { enrollment?: Enrollment };
      // Patche l'état local : les semaines restent identiques (les états ne
      // dépendent pas de l'enrollment), seul le CTA change.
      setData((prev) =>
        prev && body.enrollment ? { ...prev, enrollment: body.enrollment } : prev,
      );
      router.refresh();
    } catch (err) {
      setEnrollError(
        err instanceof Error ? err.message : "Impossible de rejoindre l'atelier.",
      );
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6">
      <Link
        href="/dashboard/ateliers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Mes ateliers
      </Link>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-500">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <header className="space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h1 className="font-display font-bold text-2xl tracking-tight">
                {data.workshop.title}
              </h1>
              {(data.workshop.domain || data.workshop.level) && (
                <div className="flex gap-1.5 shrink-0">
                  {data.workshop.domain && (
                    <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {DOMAIN_LABELS[data.workshop.domain] ?? data.workshop.domain}
                    </span>
                  )}
                  {data.workshop.level && (
                    <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {LEVEL_LABELS[data.workshop.level] ?? data.workshop.level}
                    </span>
                  )}
                </div>
              )}
            </div>

            {data.workshop.description && (
              <p className="text-sm text-muted-foreground max-w-2xl">
                {data.workshop.description}
              </p>
            )}

            {/* Progression */}
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">
                {data.summary.completed}/{data.summary.total} séances complétées
              </span>
              <div className="flex-1 max-w-48 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-lime transition-[width]"
                  style={{ width: `${data.summary.percent}%` }}
                />
              </div>
              <span className="text-lime font-medium">{data.summary.percent}%</span>
            </div>
          </header>

          {/* Inscription */}
          {data.enrollment?.status !== "active" && (
            <div className="rounded-lg border border-lime/40 bg-lime/[0.04] px-5 py-4 space-y-3">
              <p className="text-sm">
                Inscris-toi pour débloquer les séances et suivre ta progression.
              </p>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-medium text-background transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2",
                  enrolling && "opacity-60 cursor-not-allowed",
                )}
                aria-label="S'inscrire à l'atelier"
              >
                {enrolling && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                {enrolling ? "Inscription…" : "S'inscrire"}
              </button>
              {enrollError && <p className="text-xs text-red-400">{enrollError}</p>}
            </div>
          )}

          {/* Parcours : semaines → séances */}
          <div className="space-y-8">
            {data.weeks.map((week) => (
              <section key={week.id} className="space-y-3">
                <header>
                  <p className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase">
                    Semaine {week.number}
                  </p>
                  <h2 className="font-display font-bold text-lg tracking-tight mt-0.5">
                    {week.title}
                  </h2>
                  {week.objective && (
                    <p className="text-sm text-muted-foreground mt-0.5">{week.objective}</p>
                  )}
                </header>

                <div className="space-y-2">
                  {week.sessions.map((s) => {
                    const event = s.event ?? null;
                    const requirements =
                      s.state !== "LOCKED"
                        ? [
                            s.deliverableRequired ? "Livrable requis" : null,
                            s.quizRequired ? "Quiz requis" : null,
                          ].filter((label): label is string => label !== null)
                        : [];

                    const inner = (
                      <>
                        <span
                          className={cn(
                            "mono-label text-xs w-9 shrink-0",
                            s.state === "LOCKED" ? "text-muted-foreground/60" : "text-muted-foreground",
                          )}
                        >
                          {sessionNumberLabel(s.number)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                "text-sm truncate",
                                s.state === "LOCKED"
                                  ? "text-muted-foreground"
                                  : "font-medium",
                              )}
                            >
                              {s.title}
                            </span>
                            <SessionStateBadge state={s.state} />
                          </div>

                          {s.objective && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {s.objective}
                            </p>
                          )}

                          {requirements.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {requirements.map((label) => (
                                <span
                                  key={label}
                                  className="inline-flex items-center rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}

                          {event && (
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="size-3" />
                                {formatEventDate(event.startsAt)}
                              </span>
                              {event.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {s.state !== "LOCKED" && (
                          <ArrowRight className="size-4 text-muted-foreground group-hover:text-lime shrink-0" />
                        )}
                      </>
                    );

                    return s.state === "LOCKED" ? (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/20 px-4 py-3 opacity-60"
                      >
                        {inner}
                      </div>
                    ) : (
                      <Link
                        key={s.id}
                        href={`/dashboard/ateliers/${slug}/sessions/${s.id}`}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3 transition-colors hover:border-lime/40 group focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
                        aria-label={`Accéder à la séance ${s.title}`}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
