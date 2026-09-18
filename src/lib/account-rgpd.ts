/**
 * HASHCODE REBOOT — RGPD : export et suppression de compte par le membre (#64).
 *
 * - Export : le membre récupère l'intégralité de ses données (profil,
 *   progression ateliers, RSVP, emails reçus, brouillon, événements analytics
 *   liés). Fonctions pures → testées dans tests/account-rgpd.test.cjs.
 * - Suppression : soft-delete (deletedAt, même convention que l'admin) +
 *   blacklist anti-relance + révocation de toutes les sessions + suppression
 *   du brouillon de profilage. Confirmation explicite obligatoire.
 */

/** Mot exact à saisir pour confirmer la suppression (sensible à la casse). */
export const DELETE_CONFIRM_WORD = "SUPPRIMER";

/** Plafond d'événements analytics inclus dans l'export (anti-abus). */
export const EXPORT_ANALYTICS_MAX = 500;

/** Version du format d'export (pour d'éventuelles migrations futures). */
export const EXPORT_FORMAT = "hashcode-reboot-export-v1";

/** true uniquement si le corps vaut exactement { confirm: "SUPPRIMER" }. */
export function isDeleteConfirmed(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return (body as Record<string, unknown>).confirm === DELETE_CONFIRM_WORD;
}

export interface ExportRelations {
  rsvps: unknown[];
  enrollments: unknown[];
  submissions: unknown[];
  quizAttempts: unknown[];
  emailLogs: unknown[];
  sessions: unknown[];
  draft: unknown | null;
  analytics: unknown[];
  analyticsTruncated: boolean;
}

/** Assemble le payload d'export (JSON-sérialisable, téléchargé par le membre). */
export function buildExportPayload(
  member: Record<string, unknown>,
  relations: ExportRelations,
): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    format: EXPORT_FORMAT,
    member,
    rsvps: relations.rsvps,
    enrollments: relations.enrollments,
    submissions: relations.submissions,
    quizAttempts: relations.quizAttempts,
    emailLogs: relations.emailLogs,
    sessions: relations.sessions,
    draft: relations.draft,
    analytics: relations.analytics,
    analyticsTruncated: relations.analyticsTruncated,
  };
}
