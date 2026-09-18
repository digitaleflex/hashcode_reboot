/**
 * HASHCODE REBOOT — fuseaux horaires des événements.
 *
 * POURQUOI CE MODULE EXISTE
 *
 * Les envois d'email formataient `startsAt` SANS option `timeZone` :
 * `event.startsAt.toLocaleDateString("fr-FR", { … })`. Le fuseau utilisé était
 * donc celui du processus. En local, c'est celui de la machine ; sur Vercel,
 * c'est **UTC**. Résultat : un membre béninois (UTC+1) recevait
 * « samedi 19 septembre à 19:00 » par email pour un atelier annoncé à 20:00,
 * alors que la page web, elle, affichait la bonne heure (fuseau du navigateur).
 * Email et web se contredisaient.
 *
 * COMMENT LE FUSEAU EST DÉTERMINÉ
 *
 * À partir de `Member.country` (code ISO 3166-1 alpha-2, collecté au
 * profilage). C'est une approximation assumée : elle ne dépend d'aucune donnée
 * absente côté serveur, et elle est suffisante pour cette communauté —
 * aucun des fuseaux représentés n'observe l'heure d'été.
 *
 * Un membre qui voyage gardera donc le fuseau de son pays de résidence. C'est
 * un compromis documenté : la seule façon de faire mieux serait de stocker la
 * zone IANA réellement annoncée par le navigateur au moment du profilage.
 *
 * Le libellé de référence (UTC+1) est par ailleurs annoncé dans la description
 * des événements : chaque membre peut ainsi comprendre un éventuel écart.
 */

/** Fuseau de référence de la communauté : UTC+1, sans heure d'été. */
export const REFERENCE_TIME_ZONE = "Africa/Porto-Novo";

/** Libellé lisible du fuseau de référence, tel qu'annoncé aux membres. */
export const REFERENCE_LABEL = "UTC+1";

/**
 * Pays (ISO 3166-1 alpha-2) → zone IANA.
 *
 * Table statique, volontairement limitée aux zones vérifiables : une entrée
 * fausse est plus nuisible qu'une absence, car l'absence déclenche un
 * avertissement (voir `zoneForCountry`) qu'on peut corriger, tandis qu'une
 * entrée fausse décale silencieusement les notifications.
 *
 * Les zones européennes et américaines portent leur heure d'été : `Intl` la
 * gère seul à partir de la zone IANA, rien à faire ici.
 */
const COUNTRY_TIME_ZONE: Readonly<Record<string, string>> = {
  // ── UTC+0 — Afrique de l'Ouest ─────────────────────────────────────────
  BF: "Africa/Ouagadougou",
  CI: "Africa/Abidjan",
  GH: "Africa/Accra",
  GM: "Africa/Banjul",
  GN: "Africa/Conakry",
  GW: "Africa/Bissau",
  LR: "Africa/Monrovia",
  ML: "Africa/Bamako",
  MR: "Africa/Nouakchott",
  SH: "Atlantic/St_Helena",
  SL: "Africa/Freetown",
  SN: "Africa/Dakar",
  ST: "Africa/Sao_Tome",
  TG: "Africa/Lome",

  // ── UTC+1 — Afrique centrale & Maghreb ─────────────────────────────────
  AO: "Africa/Luanda",
  BJ: "Africa/Porto-Novo",
  CD: "Africa/Kinshasa",
  CF: "Africa/Bangui",
  CG: "Africa/Brazzaville",
  CM: "Africa/Douala",
  DZ: "Africa/Algiers",
  GA: "Africa/Libreville",
  GQ: "Africa/Malabo",
  MA: "Africa/Casablanca",
  NE: "Africa/Niamey",
  NG: "Africa/Lagos",
  TD: "Africa/Ndjamena",
  TN: "Africa/Tunis",

  // ── UTC+1 — Europe (heure d'été gérée par la zone IANA) ────────────────
  AD: "Europe/Andorra",
  AL: "Europe/Tirane",
  AT: "Europe/Vienna",
  BA: "Europe/Sarajevo",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin",
  DK: "Europe/Copenhagen",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  HR: "Europe/Zagreb",
  HU: "Europe/Budapest",
  IT: "Europe/Rome",
  LI: "Europe/Vaduz",
  LU: "Europe/Luxembourg",
  MC: "Europe/Monaco",
  ME: "Europe/Podgorica",
  MK: "Europe/Skopje",
  MT: "Europe/Malta",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  PL: "Europe/Warsaw",
  RS: "Europe/Belgrade",
  SE: "Europe/Stockholm",
  SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava",
  SM: "Europe/San_Marino",
  VA: "Europe/Vatican",

  // ── UTC+2 ──────────────────────────────────────────────────────────────
  BG: "Europe/Sofia",
  BI: "Africa/Bujumbura",
  CY: "Asia/Nicosia",
  EE: "Europe/Tallinn",
  EG: "Africa/Cairo",
  FI: "Europe/Helsinki",
  GR: "Europe/Athens",
  IL: "Asia/Jerusalem",
  JO: "Asia/Amman",
  LB: "Asia/Beirut",
  LT: "Europe/Vilnius",
  LV: "Europe/Riga",
  LY: "Africa/Tripoli",
  MD: "Europe/Chisinau",
  MW: "Africa/Blantyre",
  MZ: "Africa/Maputo",
  RO: "Europe/Bucharest",
  RW: "Africa/Kigali",
  SY: "Asia/Damascus",
  UA: "Europe/Kyiv",
  ZA: "Africa/Johannesburg",
  ZM: "Africa/Lusaka",
  ZW: "Africa/Harare",

  // ── UTC+3 ──────────────────────────────────────────────────────────────
  BH: "Asia/Bahrain",
  BY: "Europe/Minsk",
  ET: "Africa/Addis_Ababa",
  IQ: "Asia/Baghdad",
  KE: "Africa/Nairobi",
  KW: "Asia/Kuwait",
  QA: "Asia/Qatar",
  RU: "Europe/Moscow",
  SA: "Asia/Riyadh",
  SO: "Africa/Mogadishu",
  TZ: "Africa/Dar_es_Salaam",
  UG: "Africa/Kampala",
  YE: "Asia/Aden",

  // ── Amériques ──────────────────────────────────────────────────────────
  BR: "America/Sao_Paulo",
  CA: "America/Toronto",
  CU: "America/Havana",
  DO: "America/Santo_Domingo",
  GF: "America/Cayenne",
  GP: "America/Guadeloupe",
  HT: "America/Port-au-Prince",
  MQ: "America/Martinique",
  US: "America/New_York",

  // ── Océan Indien / autres ──────────────────────────────────────────────
  MG: "Indian/Antananarivo",
  MU: "Indian/Mauritius",
  RE: "Indian/Reunion",
  SC: "Indian/Mahe",
  KM: "Indian/Comoro",
  DJ: "Africa/Djibouti",
  ER: "Africa/Asmara",
  SD: "Africa/Khartoum",
  SS: "Africa/Juba",
};

/** Zones déjà signalées comme non mappées, pour ne pas noyer les logs. */
const warnedCountries = new Set<string>();

/**
 * Zone IANA d'un pays. Repli sur le fuseau de référence si le pays est absent
 * ou inconnu — avec un avertissement unique par pays, pour pouvoir étendre la
 * table sans attendre qu'un membre se plaigne d'une heure fausse.
 */
export function zoneForCountry(country: string | null | undefined): string {
  const code = country?.trim().toUpperCase();
  if (!code) return REFERENCE_TIME_ZONE;

  const zone = COUNTRY_TIME_ZONE[code];
  if (zone) return zone;

  if (!warnedCountries.has(code)) {
    warnedCountries.add(code);
    console.warn(
      `[events-timezone] Pays sans fuseau mappé : « ${code} » — ` +
        `repli sur ${REFERENCE_TIME_ZONE} (${REFERENCE_LABEL}). ` +
        `Ajouter l'entrée dans COUNTRY_TIME_ZONE.`,
    );
  }
  return REFERENCE_TIME_ZONE;
}

/** true si la zone est exploitable par Intl (sinon Intl lève un RangeError). */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalise une zone : une zone invalide retombe sur la référence plutôt que
 * de faire échouer l'envoi d'email.
 */
export function safeTimeZone(zone: string | null | undefined): string {
  if (!zone) return REFERENCE_TIME_ZONE;
  return isValidTimeZone(zone) ? zone : REFERENCE_TIME_ZONE;
}

// Un DateTimeFormat est coûteux à construire : on le mémoïse par zone.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const clockFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(zone: string): Intl.DateTimeFormat {
  let f = dateFormatters.get(zone);
  if (!f) {
    // Mêmes options que l'affichage web (voir public-events.tsx,
    // formatEventDate) : l'email doit rendre exactement la même chaîne.
    f = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: zone,
    });
    dateFormatters.set(zone, f);
  }
  return f;
}

function clockFormatter(zone: string): Intl.DateTimeFormat {
  let f = clockFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: zone,
    });
    clockFormatters.set(zone, f);
  }
  return f;
}

/** « samedi 19 septembre » dans la zone donnée. */
export function formatEventDate(date: Date, zone: string): string {
  return dateFormatter(safeTimeZone(zone)).format(date);
}

/** « 20:00 » dans la zone donnée. */
export function formatClock(date: Date, zone: string): string {
  return clockFormatter(safeTimeZone(zone)).format(date);
}

/**
 * « samedi 19 septembre à 20:00 » — même format que l'affichage web, mais
 * calculé dans la zone du destinataire au lieu de celle du serveur.
 */
export function formatEventMoment(date: Date, zone: string): string {
  const z = safeTimeZone(zone);
  return `${formatEventDate(date, z)} à ${formatClock(date, z)}`;
}

/**
 * Précision ajoutée à l'email uniquement quand le destinataire lit une heure
 * DIFFÉRENTE de celle annoncée au groupe.
 *
 * La comparaison porte sur l'heure réellement affichée à l'instant de
 * l'événement, pas sur l'identifiant de zone : `Africa/Douala` (Cameroun) et
 * `Africa/Porto-Novo` (Bénin) sont deux zones distinctes mais donnent la même
 * heure — comparer les identifiants aurait ajouté une note inutile. Inversement
 * `Europe/Paris` partage l'offset UTC+1 en hiver mais pas en été : comparer les
 * horloges à la date de l'événement est le seul test correct.
 */
export function localTimeNote(date: Date, zone: string): string | null {
  const z = safeTimeZone(zone);
  if (formatClock(date, z) === formatClock(date, REFERENCE_TIME_ZONE)) return null;
  return (
    `Heure affichée dans ton fuseau local. ` +
    `Le groupe annonce les horaires en ${REFERENCE_LABEL}.`
  );
}
