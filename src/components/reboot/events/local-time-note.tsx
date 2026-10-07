"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { REFERENCE_LABEL, REFERENCE_TIME_ZONE, localTimeNote } from "@/lib/events-timezone";

/**
 * Note de fuseau horaire, au-dessus de la timeline.
 *
 * POURQUOI CE COMPOSANT EXISTE
 *
 * Toute la page événements affiche l'heure du NAVIGATEUR (`format.ts` ne
 * fait aucune conversion : `toLocaleTimeString("fr-FR", …)`). Un visiteur
 * installé sur un autre fuseau que celui du groupe (Bénin, UTC+1) lit donc des
 * horaires qui ne correspondent pas à ce qui est annoncé ailleurs. Sans
 * explication, il conclut à une erreur de programmation.
 *
 * La note ne s'affiche QUE dans ce cas : un visiteur déjà à l'heure du groupe
 * n'a rien à savoir, et une mention permanente serait du bruit. Le même
 * arbitrage est fait côté email par `localTimeNote()` — la décision est donc
 * partagée, pas réécrite ici.
 */

/** Fuseau IANA du navigateur, une seule fois. `null` = inconnu. */
function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/**
 * Décalage de `zone` par rapport à UTC, EN MINUTES, à la date donnée.
 *
 * `Intl` gère seul l'heure d'été : le décalage est recalculé à la date de
 * l'événement, pas une fois pour toutes. `null` si la zone est inexploitable.
 */
function offsetMinutes(date: Date, zone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(date);
    const raw = (parts.find((p) => p.type === "timeZoneName")?.value ?? "")
      // `fr-FR` sort « UTC−04:00 » avec un vrai signe moins (U+2212), pas un
      // trait d'union ASCII : sans cette normalisation, tout fuseau à l'ouest
      // de Greenwich renvoyait null (America/New_York, America/Sao_Paulo…).
      .replace(/−/g, "-");
    // "UTC+02:00" (et "GMT+1" sur certains runtimes) → minutes signées.
    const match = /^(?:UTC|GMT)?([+-])(\d{1,2})(?::(\d{2}))?$/.exec(raw);
    if (!match) return null;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  } catch {
    return null;
  }
}

/** 120 → "UTC+2" ; 330 → "UTC+5:30" ; -300 → "UTC-5". */
function offsetLabel(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${minutes < 0 ? "-" : "+"}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** 120 → "+2 h" ; -330 → "-5 h 30" ; 45 → "+45 min". */
function shiftLabel(deltaMinutes: number): string {
  const abs = Math.abs(deltaMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const shift = deltaMinutes === 0 ? "" : m ? `${h} h ${m} min` : `${h} h`;
  return `${deltaMinutes < 0 ? "-" : "+"}${shift}`;
}

export interface LocalTimeNoteProps {
  /** ISO du premier événement affiché — l'appelant peut ne rien avoir. */
  startsAt?: string | Date | null;
  className?: string;
}

/**
 * Une ligne, pas un encadré : l'information est utile une fois lue, sa valeur
 * est exactement d'être discrète.
 */
export function LocalTimeNote({ startsAt, className }: LocalTimeNoteProps) {
  /**
   * Le fuseau du navigateur n'est lisible qu côté client. On le lit dans un
   * effet, pas pendant le rendu : le HTML initial (serveur, indexable) et la
   * première hydratation s'affichent donc à l'identique, sans divergence.
   */
  const [zone, setZone] = React.useState<string | null>(null);

  React.useEffect(() => {
    setZone(browserTimeZone());
  }, []);

  const content = React.useMemo(() => {
    if (!zone) return null;
    if (!startsAt) return null;

    const date = startsAt instanceof Date ? startsAt : new Date(startsAt);
    if (Number.isNaN(date.getTime())) return null;

    // Décision partagée avec l'email : l'horloge affichée à cet instant est-elle
    // différente de celle annoncée au groupe ? Si non, la note n'apparaît pas.
    if (!localTimeNote(date, zone)) return null;

    const visitor = offsetMinutes(date, zone);
    const reference = offsetMinutes(date, REFERENCE_TIME_ZONE);

    // Décalage relatif — plus parlant qu'un second fuseau technique.
    const delta = visitor !== null && reference !== null ? visitor - reference : null;
    const where = visitor !== null ? `${zone} · ${offsetLabel(visitor)}` : zone;

    if (delta === null || delta === 0) {
      return `Horaires affichés dans ton fuseau (${where}). Le groupe annonce l'heure de l'événement en ${REFERENCE_LABEL}.`;
    }

    return (
      `Horaires affichés dans ton fuseau (${where}) — soit ${shiftLabel(delta)} ` +
      `par rapport à l'heure annoncée par le groupe (${REFERENCE_LABEL}).`
    );
  }, [zone, startsAt]);

  if (!content) return null;

  return (
    <p
      className={cn(
        "mb-4 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{content}</span>
    </p>
  );
}