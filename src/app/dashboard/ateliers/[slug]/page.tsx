import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Lock,
  MapPin,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/account-auth";
import { loadWorkshopForMember } from "@/lib/workshop-server";
import { EnrollButton } from "../_components/EnrollButton";
import { SessionStateBadge } from "../_components/SessionStateBadge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Atelier — HASHCODE REBOOT",
};

function sessionNumberLabel(n: number): string {
  return `S${String(n).padStart(2, "0")}`;
}

/**
 * /dashboard/ateliers/[slug] — vue d'ensemble du parcours : semaines →
 * séances, états & locks dérivés serveur, prochain créneau des séances
 * débloquées.
 *
 * Les séances verrouillées n'affichent QUE leur titre + un cadenas —
 * aucun contenu pédagogique d'une séance verrouillée (protocole §21).
 * Le détail d'une séance (contenu, soumission, quiz) vit dans #89.
 */
export default async function AtelierProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/ateliers");

  const { slug } = await params;
  const workshop = await db.workshop.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!workshop || workshop.status !== "published") notFound();

  const view = await loadWorkshopForMember(session.member.id, workshop.id);
  if (!view) notFound();

  // Prochain créneau des séances débloquées liées à un Event.
  const eventIds = view.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => s.state !== "LOCKED" && s.eventId)
    .map((s) => s.eventId as string);
  const events = eventIds.length
    ? await db.event.findMany({
        where: { id: { in: eventIds } },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          location: true,
          url: true,
          status: true,
        },
      })
    : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const { workshop: w, enrollment, summary } = view;

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6">
      <Link
        href="/dashboard/ateliers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Mes ateliers
      </Link>

      <header className="space-y-2">
        <h1 className="font-display font-bold text-2xl tracking-tight">
          {w.title}
        </h1>
        {w.description && (
          <p className="text-sm text-muted-foreground max-w-2xl">{w.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            {summary.completed}/{summary.total} séances validées
          </span>
          <div className="flex-1 max-w-48 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-lime transition-all"
              style={{ width: `${summary.percent}%` }}
            />
          </div>
          <span className="text-lime font-medium">{summary.percent}%</span>
        </div>
      </header>

      {enrollment?.status !== "active" && (
        <div className="rounded-md border border-lime/40 bg-lime/[0.04] px-5 py-4 space-y-3">
          <p className="text-sm">
            Inscris-toi pour débloquer les séances et suivre ta progression.
          </p>
          <EnrollButton slug={slug} />
        </div>
      )}

      {/* Parcours : semaines → séances */}
      <div className="space-y-8">
        {view.weeks.map((week) => (
          <section key={week.id} className="space-y-3">
            <header>
              <p className="mono-label text-xs text-muted-foreground">
                SEMAINE {week.number}
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
                const ev = s.eventId ? eventById.get(s.eventId) : null;
                return s.state === "LOCKED" ? (
                  // Séance verrouillée : titre + cadenas, AUCUN contenu.
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-md border border-border/60 bg-card/20 px-4 py-3 opacity-60"
                  >
                    <span className="mono-label text-xs text-muted-foreground w-9 shrink-0">
                      {sessionNumberLabel(s.number)}
                    </span>
                    <span className="text-sm text-muted-foreground truncate flex-1">
                      {s.title}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="size-3" />
                      Verrouillée
                    </span>
                  </div>
                ) : (
                  <Link
                    key={s.id}
                    href={`/dashboard/ateliers/${slug}/sessions/${s.id}`}
                    className="flex items-center gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-3 transition-colors hover:border-lime/40 group"
                  >
                    <span className="mono-label text-xs text-muted-foreground w-9 shrink-0">
                      {sessionNumberLabel(s.number)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {s.title}
                        </span>
                        <SessionStateBadge state={s.state} />
                      </div>
                      {s.objective && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {s.objective}
                        </p>
                      )}
                      {ev && (
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            {ev.startsAt.toLocaleDateString("fr-FR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {ev.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-lime shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
