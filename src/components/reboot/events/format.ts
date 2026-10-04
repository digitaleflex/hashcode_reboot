/**
 * Formatage des dates d'événements.
 *
 * Tout est formaté en heure LOCALE du visiteur (`fr-FR`), exactement comme
 * l'ancienne implémentation : les horaires affichés (19:00) ne doivent pas
 * bouger. Aucune conversion de fuseau ici.
 */

const LOCALE = "fr-FR";

export function startDate(startsAt: string): Date {
  return new Date(startsAt);
}

/** Jour calendaire local, minuit — base des groupings et badges. */
export function dayKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Clé de regroupement — une entrée par jour local. */
export function groupKey(startsAt: string): string {
  return dayKey(startsAt);
}

/** "19:00" */
export function formatTime(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "19:00 — 21:00", ou "19:00" si pas de fin. */
export function formatTimeRange(startsAt: string, endsAt: string | null): string {
  const start = formatTime(startsAt);
  if (!endsAt) return start;
  const end = formatTime(endsAt);
  return end === start ? start : `${start} — ${end}`;
}

/** "2h", "2h30", "45min". null si la durée est absente ou incohérente. */
export function formatDuration(startsAt: string, endsAt: string | null): string | null {
  if (!endsAt) return null;
  const diffMin = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
  );
  if (diffMin <= 0) return null;
  if (diffMin < 60) return `${diffMin}min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "DIMANCHE" (majuscules, pour le rail de date desktop). */
export function formatWeekdayUpper(startsAt: string): string {
  return new Date(startsAt)
    .toLocaleDateString(LOCALE, { weekday: "long" })
    .toUpperCase();
}

/** "04" */
export function formatDayNumber(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString(LOCALE, { day: "2-digit" });
}

/** "OCTOBRE" */
export function formatMonthUpper(startsAt: string): string {
  return new Date(startsAt)
    .toLocaleDateString(LOCALE, { month: "long" })
    .toUpperCase();
}

/** "oct." — compact pour le bandeau mobile. */
export function formatMonthShort(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString(LOCALE, { month: "short" });
}

/** "2026" */
export function formatYear(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString(LOCALE, { year: "numeric" });
}

/** "DIM. 04 OCT." — bandeau de date mobile. */
export function formatDayBadge(startsAt: string): string {
  const weekday = new Date(startsAt)
    .toLocaleDateString(LOCALE, { weekday: "short" })
    .replace(".", "")
    .toUpperCase();
  const month = formatMonthShort(startsAt)
    .replace(".", "")
    .toUpperCase();
  return `${weekday}. ${formatDayNumber(startsAt)} ${month}.`;
}

/** "dimanche 4 octobre 2026" — libellé accessible du groupe. */
export function formatFullDate(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Nombre de jours calendaires locaux entre aujourd'hui et l'événement. */
export function daysFromToday(startsAt: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(startsAt);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

/** "AUJOURD'HUI" | "DEMAIN" | null */
export function relativeDayBadge(startsAt: string): string | null {
  const diff = daysFromToday(startsAt);
  if (diff === 0) return "AUJOURD'HUI";
  if (diff === 1) return "DEMAIN";
  return null;
}

/** "5 événements" / "1 événement" — accord correct, zéro pluriel cassé. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count > 1 ? (plural ?? `${singular}s`) : singular}`;
}

/** "2 interested count" → "12 intéressés". */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
