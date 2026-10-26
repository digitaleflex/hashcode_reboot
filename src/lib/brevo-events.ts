/**
 * Normalisation des événements Brevo → vocabulaire interne.
 *
 * Brevo n'envoie pas les noms documentés dans le handler historique :
 * le payload contient du snake_case (`hard_bounce`, `soft_bounce`,
 * `invalid_email`, `click`, `spam`, `request`, `unsubscribe`) alors que
 * le switch comparait du camelCase (`hardBounce`, `clicked`, `invalid`,
 * `complaint`, `sent`).
 *
 * Conséquence avant cette normalisation : les bounces, les plaintes spam
 * et les clics étaient silencieusement ignorés (branche `default`), donc
 * aucun membre n'était passé en BOUNCED/blacklisté.
 *
 * Les alias camelCase restent acceptés (payloads de test, anciens
 * webhooks). La casse est ignorée.
 *
 * `proxy_open` / `unique_proxy_open` sont volontairement ignorés :
 * ce sont des ouvertures simulées (Apple Mail Privacy Protection), pas
 * une preuve d'engagement. Ne pas s'abonner à ces événements côté Brevo.
 *
 * Doc : https://developers.brevo.com/docs/how-to-use-webhooks
 */

export type BrevoEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "softBounce"
  | "hardBounce"
  | "invalid"
  | "deferred"
  | "complaint"
  | "unsubscribed"
  | "blocked"
  | "error";

/**
 * Clés en minuscules pour rendre la normalisation insensible à la casse.
 * Valeur `null` = événement Brevo connu mais volontairement non traité.
 */
const EVENT_MAP: Readonly<Record<string, BrevoEventType | null>> = {
  // Noms internes historiques (camelCase).
  sent: "sent",
  delivered: "delivered",
  opened: "opened",
  clicked: "clicked",
  softbounce: "softBounce",
  hardbounce: "hardBounce",
  invalid: "invalid",
  deferred: "deferred",
  complaint: "complaint",
  unsubscribed: "unsubscribed",
  blocked: "blocked",
  error: "error",

  // Payloads réels Brevo (snake_case).
  request: "sent",
  click: "clicked",
  hard_bounce: "hardBounce",
  soft_bounce: "softBounce",
  invalid_email: "invalid",
  spam: "complaint",
  unsubscribe: "unsubscribed",
  // Première ouverture : même traitement que `opened`. Brevo peut envoyer
  // les deux si le webhook est abonné aux deux — ne s'abonner qu'à
  // `opened` pour éviter les doublons d'EmailEvent.
  unique_opened: "opened",

  // Ouvertures proxy (MPP) — aucun engagement réel.
  proxy_open: null,
  unique_proxy_open: null,
};

/**
 * Convertit un nom d'événement Brevo brut en type interne.
 *
 * @returns le type interne, ou `null` si l'événement est inconnu ou
 *          volontairement ignoré (ouvertures proxy, événements marketing
 *          non pertinents).
 */
export function normalizeBrevoEvent(raw: unknown): BrevoEventType | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return EVENT_MAP[key] ?? null;
}
