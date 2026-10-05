/**
 * D03 — Taxonomie des catégories sémantiques d'email.
 *
 * Source unique de vérité, importée par :
 *  - les producteurs : `src/lib/mail.ts` (les 14 wrappers d'envoi)
 *  - les consommateurs : `/api/email-stats`, `/api/admin/dashboard`
 *
 * ⚠️ À NE PAS confondre avec `SendEmailInput.category` de `mail.ts`, qui est une
 * taxonomie de ROUTAGE provider (`marketing` | `transactional` | `notification`
 * | `code`). Les deux partageaient historiquement le même nom.
 *
 * Contexte : la catégorie était devinée par `includes()` sur le SUJET de l'email.
 * « On t'attend sur HASHCODE — rejoins le groupe » (sendEngagementEmail) et
 * « On t'attend toujours — rejoins HASHCODE REBOOT » (sendInviteRelanceEmail)
 * matchaient tous deux "t'attend" → `engagement` ; aucun sujet ne contenait
 * "reprend"/"termin" → la branche `relance` était INATTEIGNABLE. Le tunnel de
 * relance de `/api/email-stats` et `/api/admin/dashboard` affichait donc des 0
 * qui semblaient être de vraies mesures.
 *
 * Chaque wrapper déclare désormais sa catégorie : elle n'est plus devinée.
 */
export const EMAIL_SEMANTIC_CATEGORIES = [
  /** Bienvenue, premier email après inscription approuvée. */
  "welcome",
  /** Invitation à rejoindre la communauté. */
  "invitation",
  /** Membre en liste d'attente. */
  "waitlist",
  /** Engagement / rappel générique. */
  "engagement",
  /** Relance d'un profil de profilage abandonné (draft ProfilingDraft, J+7). */
  "profil_abandon",
  /** Rappel : l'espace membre est en ligne. */
  "dashboard_invite",
  /** Rejoindre après une période d'absence. */
  "rejoin",
  /** Relance d'une invitation non cliquée (J+7). */
  "invite_relance",
  /** Annonce d'un événement. */
  "event",
  /** Rappel d'événement (J−3 / J−1 / H−1). */
  "event_rappel",
  /** Vérification d'adresse email. */
  "verification",
  /** Code de connexion / lien 1-clic. */
  "code_connexion",
  /** Changement de statut de profil (APPROVED / WAITLIST / REJECTED). */
  "status_change",
  /** Notification interne à l'équipe (bounce…). */
  "notification",
] as const;

export type EmailSemanticCategory = (typeof EMAIL_SEMANTIC_CATEGORIES)[number];

/**
 * Catégorie d'un email de relance de PROFIL (draft de profilage abandonné).
 *
 * C'est celle qui alimente le tunnel de conversion
 * `ProfilingDraft` → email envoyé → profil complété. Avant D03, le tunnel
 * filtrait `category: "relance"`, une valeur qu'aucun wrapper ne produisait
 * réellement → `relanceSent`/`relanceOpened`/`relanceClicked` à 0 en permanence.
 */
export const PROFILE_RELANC_CATEGORY = "profil_abandon" satisfies EmailSemanticCategory;

/**
 * Catégorie d'un email de relance d'INVITATION (invitation non cliquée, J+7).
 * Distincte de `PROFILE_RELANC_CATEGORY` : les deux tunnels sont séparés.
 */
export const INVITE_RELANC_CATEGORY = "invite_relance" satisfies EmailSemanticCategory;

/**
 * Libellés français pour l'interface admin.
 *
 * ⚠️ Ces chaînes devraient vivre dans `messages/*.json` : les pages admin
 * n'utilisent pas encore `next-intl` (voir tâche D22). Centralisées ici pour
 * éviter la duplication constatée dans `EmailEngagement.tsx` et
 * `MarketingGraphs.tsx`, qui avaient chacune leur propre `CATEGORY_LABEL`.
 *
 * Module sans dépendance serveur : importable depuis un composant client.
 */
export const EMAIL_CATEGORY_LABELS: Record<string, string> = {
  welcome: "Bienvenue",
  invitation: "Invitation",
  waitlist: "Waitlist",
  engagement: "Engagement",
  profil_abandon: "Relance profil",
  dashboard_invite: "Espace membre",
  rejoin: "Rejoindre",
  invite_relance: "Relance invitation",
  event: "Événement",
  event_rappel: "Rappel événement",
  verification: "Vérification email",
  code_connexion: "Code de connexion",
  status_change: "Changement de statut",
  notification: "Notification interne",
  other: "Autre",
};