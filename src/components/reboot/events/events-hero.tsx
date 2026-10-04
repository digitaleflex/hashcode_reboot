import * as React from "react";
import { Eyebrow } from "@/components/reboot/shared";
import { formatDayNumber, formatMonthShort, formatWeekdayUpper } from "./format";
import type { PublicEvent } from "./types";

/**
 * Micro-stat du hero — calculée à partir des événements RÉELS.
 * 3 sources, priorité à la plus parlante.
 */
function useHeroStat(events: PublicEvent[]): string | null {
  return React.useMemo(() => {
    if (events.length === 0) return null;

    const now = Date.now();
    const upcoming = events
      .filter((e) => new Date(e.startsAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    if (upcoming.length === 0) return null;

    const in7days = upcoming.filter((e) => {
      const diff = new Date(e.startsAt).getTime() - now;
      return diff <= 7 * 24 * 60 * 60 * 1000;
    });

    if (in7days.length > 0) {
      const first = in7days[0];
      const weekday = formatWeekdayUpper(first.startsAt).toLowerCase();
      return `Prochain rendez-vous ${weekday} ${formatDayNumber(first.startsAt)} ${formatMonthShort(first.startsAt)}`;
    }

    return `${upcoming.length} événement${upcoming.length > 1 ? "s" : ""} à venir`;
  }, [events]);
}

/**
 * Hero compact — pas une landing page.
 * py-10 sm:py-14, un seul eyebrow, un H1, deux lignes de sous-titre,
 * une micro-stat réelle.
 */
export function EventsHero({
  events,
  isAuthed,
  firstName,
}: {
  events: PublicEvent[];
  isAuthed: boolean;
  firstName?: string | null;
}) {
  const stat = useHeroStat(events);

  return (
    <section className="py-10 sm:py-14">
      <Eyebrow>Prochains rendez-vous</Eyebrow>

      <h1 className="mt-4 font-display text-[28px] font-bold leading-[1.1] tracking-tight text-foreground text-balance sm:text-[36px] lg:text-[40px]">
        Événements
      </h1>

      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-foreground sm:text-base">
        Apprends. Construis. Rencontre.
      </p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Sessions, workshops et rencontres pratiques pour progresser avec la
        communauté HASHCODE.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/70 pt-4">
        {stat && (
          <p className="text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">{stat}</span>
          </p>
        )}
        <p className="text-[13px] text-muted-foreground">
          {isAuthed
            ? `Inscris-toi en un clic${firstName ? `, ${firstName}` : ""} — ton RSVP est enregistré dans ton espace.`
            : "Dis-nous que ça t'intéresse, puis crée ton profil pour t'inscrire."}
        </p>
      </div>
    </section>
  );
}
