/**
 * Registre des templates d'email HASHCODE REBOOT.
 *
 * Source de vérité pour : la clé stable utilisée par le code d'envoi, le
 * libellé admin, la catégorie (qui détermine si l'édition est autorisée) et
 * les variables réellement interpolées par chaque template.
 *
 * `editable` est DÉRIVÉ de la catégorie (jamais stocké) : impossible de
 * déverrouiller par accident un template porteur de secret d'authentification.
 *
 * Chaque variable porte DEUX valeurs :
 *  - `sample`  : jeton unique, utilisé uniquement au seed pour retrouver la
 *                valeur dans le HTML généré et la remplacer par {{variable}}.
 *                Jamais affiché.
 *  - `preview` : valeur lisible, utilisée pour l'aperçu admin.
 */

/** Union interne : les catégories valides d'un template. */
type TemplateCategory = "marketing" | "notification" | "code";

export interface TemplateVariable {
  /** Nom utilisé dans le contenu : {{firstName}}. */
  key: string;
  label: string;
  /** Jeton unique servant à la substitution inverse lors du seed. */
  sample: string;
  /** Valeur lisible pour l'aperçu. */
  preview: string;
  kind: "text" | "url";
}

export interface TemplateDefinition {
  key: string;
  name: string;
  category: TemplateCategory;
  /** À quoi sert ce mail — affiché dans l'admin. */
  description: string;
  /** Fonction d'envoi correspondante dans src/lib/mail.ts. */
  source: string;
  /**
   * Variables du template. Vide pour les templates verrouillés : leur corps est
   * figé à titre d'aperçu (valeurs d'exemple incluses), il ne sert jamais à
   * envoyer.
   */
  variables: TemplateVariable[];
}

/** Seule catégorie éditable : les autres portent des secrets/liens d'auth. */
const EDITABLE_CATEGORIES: readonly TemplateCategory[] = ["marketing"];

/** Base d'exemple : sert à rendre les URLs dérivées reconnaissables au seed. */
export const SEED_BASE = "https://zzseed.example";

export const SEED_FIRST_NAME = "ZzfirstNameZz";

const V = (key: string, label: string, sample: string, preview: string, kind: "text" | "url" = "text"): TemplateVariable => ({
  key,
  label,
  sample,
  preview,
  kind,
});

const FIRST_NAME = V("firstName", "Prénom", SEED_FIRST_NAME, "Awa");

export const TEMPLATE_REGISTRY: readonly TemplateDefinition[] = [
  // ── Marketing : éditables ───────────────────────────────────────────────
  {
    key: "welcome",
    name: "Bienvenue (profil validé)",
    category: "marketing",
    description: "Envoyé quand un profil passe en validé.",
    source: "sendWelcomeEmail",
    variables: [FIRST_NAME, V("archetype", "Archétype", "ZzArchetypeZz", "Builder Nocturne")],
  },
  {
    key: "invitation",
    name: "Invitation WhatsApp",
    category: "marketing",
    description: "Invitation personnelle à rejoindre le groupe WhatsApp officiel.",
    source: "sendInvitationEmail",
    variables: [
      FIRST_NAME,
      V("dashboardUrl", "Lien de l'espace membre", `${SEED_BASE}/zzdashboard`, "https://joinhashcode.com/dashboard", "url"),
    ],
  },
  {
    key: "waitlist",
    name: "Liste d'attente (inscription reçue)",
    category: "marketing",
    description: "Accusé de réception quand le profil part en validation.",
    source: "sendWaitlistEmail",
    variables: [FIRST_NAME],
  },
  {
    key: "engagement",
    name: "Engagement (n'a pas encore rejoint)",
    category: "marketing",
    description: "Relance des membres invités qui ne sont pas encore entrés dans la communauté.",
    source: "sendEngagementEmail",
    variables: [
      FIRST_NAME,
      V(
        "joinUrl",
        "Lien communauté",
        `${SEED_BASE}/login?next=%2Fapi%2Fcommunity%2Fjoin`,
        "https://joinhashcode.com/login?next=%2Fapi%2Fcommunity%2Fjoin",
        "url",
      ),
    ],
  },
  {
    key: "relance",
    name: "Relance profil abandonné",
    category: "marketing",
    description: "Relance d'un membre qui a quitté le questionnaire en cours.",
    source: "sendRelanceEmail",
    variables: [
      FIRST_NAME,
      V("resumeUrl", "Lien de reprise", `${SEED_BASE}/?resume=1`, "https://joinhashcode.com/?resume=1", "url"),
    ],
  },
  {
    key: "dashboard_invite",
    name: "Invitation espace membre",
    category: "marketing",
    description: "Ouvre l'accès à l'espace membre.",
    source: "sendDashboardInviteEmail",
    variables: [
      FIRST_NAME,
      V("url", "Lien de l'espace membre", `${SEED_BASE}/zzurl`, "https://joinhashcode.com/dashboard", "url"),
      // Dérivé de NEXT_PUBLIC_SITE_URL → `${base}/login` (cf. getLoginUrlForEmail).
      V("loginUrl", "Lien de connexion", `${SEED_BASE}/login`, "https://joinhashcode.com/login", "url"),
    ],
  },
  {
    key: "rejoin",
    name: "Retour (rejoin)",
    category: "marketing",
    description: "Invitation à construire (ou reprendre) son profil.",
    source: "sendRejoinEmail",
    variables: [
      FIRST_NAME,
      V("url", "Lien d'action", `${SEED_BASE}/zzurl`, "https://joinhashcode.com/", "url"),
    ],
  },
  {
    key: "invitation_actions",
    name: "Invitation avec accepter / refuser",
    category: "marketing",
    description: "Invitation portant deux actions : accepter ou refuser.",
    source: "sendInvitationWithActions",
    variables: [
      FIRST_NAME,
      V("acceptUrl", "Lien accepter", `${SEED_BASE}/zzaccept`, "https://joinhashcode.com/invite/accept?t=8f3c2a", "url"),
      V("refuseUrl", "Lien refuser", `${SEED_BASE}/zzrefuse`, "https://joinhashcode.com/invite/refuse?t=8f3c2a", "url"),
    ],
  },
  {
    key: "invite_relance",
    name: "Relance d'invitation",
    category: "marketing",
    description: "Relance quand l'invitation n'a pas encore été acceptée.",
    source: "sendInviteRelanceEmail",
    variables: [
      FIRST_NAME,
      V("acceptUrl", "Lien accepter", `${SEED_BASE}/zzaccept`, "https://joinhashcode.com/invite/accept?t=8f3c2a", "url"),
    ],
  },

  // ── Verrouillés : liens et secrets d'authentification ───────────────────
  {
    key: "status_change_approved",
    name: "Statut — profil validé",
    category: "notification",
    description: "Notification de changement de statut vers validé. VERROUILLÉ.",
    source: "sendStatusChangeEmail",
    variables: [],
  },
  {
    key: "status_change_waitlist",
    name: "Statut — liste d'attente",
    category: "notification",
    description: "Notification de passage en liste d'attente. VERROUILLÉ.",
    source: "sendStatusChangeEmail",
    variables: [],
  },
  {
    key: "status_change_rejected",
    name: "Statut — refusé",
    category: "notification",
    description: "Notification de refus de candidature. VERROUILLÉ.",
    source: "sendStatusChangeEmail",
    variables: [],
  },
  {
    key: "verification_link",
    name: "Vérification email (lien 1 clic)",
    category: "code",
    description: "Lien de vérification d'adresse email. VERROUILLÉ (lien d'authentification).",
    source: "sendVerificationLinkEmail",
    variables: [],
  },
  {
    key: "magic_link",
    name: "Lien de connexion (magic link + code)",
    category: "code",
    description: "Code et lien de connexion. VERROUILLÉ (secret d'authentification).",
    source: "sendMagicLinkEmail",
    variables: [],
  },
  {
    key: "accept_notification",
    name: "Notification interne — invitation acceptée",
    category: "notification",
    description: "Alerte interne quand un membre accepte son invitation. VERROUILLÉ.",
    source: "sendAcceptNotificationEmail",
    variables: [],
  },
  {
    key: "refuse_notification",
    name: "Notification interne — invitation refusée",
    category: "notification",
    description: "Alerte interne quand un membre refuse son invitation. VERROUILLÉ.",
    source: "sendRefuseNotificationEmail",
    variables: [],
  },
  {
    key: "bounced_alert",
    name: "Alerte bounce (interne)",
    category: "notification",
    description: "Alerte interne quand une adresse email bounce. VERROUILLÉ.",
    source: "sendBouncedNotificationEmail",
    variables: [],
  },
  {
    key: "event_notification",
    name: "Annonce d'événement",
    category: "notification",
    description: "Annonce d'un événement aux membres ciblés. VERROUILLÉ.",
    source: "sendEventNotificationEmail",
    variables: [],
  },
] as const;

export function getTemplateDefinition(key: string): TemplateDefinition | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.key === key);
}

/** L'édition est-elle autorisée pour cette catégorie ? */
export function isCategoryEditable(category: string): boolean {
  return (EDITABLE_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Variables autorisées pour un template créé depuis l'admin (donc absent du
 * registre). Sans jeu de repli, un tel template refuserait toute variable,
 * y compris {{firstName}} que son gabarit de départ contient.
 */
export const CUSTOM_TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  FIRST_NAME,
  V("email", "Email du destinataire", "zzseed@example.test", "awa@example.com"),
];

/** Variables à utiliser pour une clé : registre si connue, sinon repli. */
export function getTemplateVariables(key: string): readonly TemplateVariable[] {
  return getTemplateDefinition(key)?.variables ?? CUSTOM_TEMPLATE_VARIABLES;
}

/** Valeurs d'exemple (jetons uniques) — seed + vérification de fidélité. */
export function sampleValues(def: TemplateDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of def.variables) out[v.key] = v.sample;
  return out;
}

/** Valeurs lisibles — aperçu admin. */
export function previewValues(def: TemplateDefinition): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of def.variables) out[v.key] = v.preview;
  return out;
}
