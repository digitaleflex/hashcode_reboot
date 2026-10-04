/**
 * Filtre « période » de la barre de filtres de /evenements.
 *
 * Isolé de `public-events.tsx` (composant « use client ») pour être
 * vérifiable et réutilisable : c'est de la logique pure, sans React ni DOM.
 *
 * Les bornes sont calculées en HEURE LOCALE, comme le reste de l'affichage,
 * pour que « cette semaine » corresponde à la semaine vue par le visiteur.
 */

export type EventPeriod = "all" | "week" | "month";

/**
 * L'événement tombe-t-il dans la période demandée ?
 *
 * « Cette semaine » = semaine calendaire **lundi → dimanche**, convention
 * française. Deux bugs corrigés ici :
 *
 *  1. la borne était calculée à partir du jour de la SEMAINE DE L'ÉVÉNEMENT
 *     (`start.getDay()`), ce qui produisait une fenêtre glissante de 7 jours
 *     décalée au lieu de la semaine courante ;
 *  2. la semaine démarrait le DIMANCHE (convention anglo-saxonne), alors que
 *     la semaine française commence le lundi.
 *
 * `getDay()` renvoie 0 pour dimanche et 6 pour lundi : le décalage vers le
 * lundi de la semaine en cours vaut donc `(getDay() + 6) % 7`.
 */
export function matchesPeriod(startsAt: string, period: EventPeriod, now = new Date()): boolean {
  if (period === "all") return true;

  const start = new Date(startsAt);

  if (period === "week") {
    const offsetToMonday = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offsetToMonday,
      0,
      0,
      0,
      0,
    );
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return start >= startOfWeek && start <= endOfWeek;
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return start >= startOfMonth && start <= endOfMonth;
}