/**
 * Dates FR pour l'espace admin (#220).
 *
 * Règle : jamais de date ambiguë. Les listes affichent jour + mois + ANNÉE +
 * heure + fuseau court ("UTC+1") ; les détails ajoutent les secondes.
 * Le fuseau est celui du NAVIGATEUR de l'admin (toLocaleString) — pas celui
 * du serveur. Entrée invalide → "—" (jamais "Invalid Date" à l'écran).
 */

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ligne de liste : "12 oct. 2026, 14:05 UTC+1". */
export function formatShortFr(iso: string): string {
  const d = safeDate(iso);
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Détail : "12/10/2026, 14:05:32 UTC+1" (format fr-FR complet + fuseau). */
export function formatFullFr(iso: string): string {
  const d = safeDate(iso);
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}
