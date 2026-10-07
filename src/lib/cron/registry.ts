/**
 * Registre unique des tâches planifiées (crons) — UNIQUE source de vérité.
 *
 * Pourquoi ce fichier existe : la liste des crons était dupliquée à l'identique
 * dans `dashboard/route.ts` et `cron-health/route.ts`. Ajouter un cron exigeait
 * de modifier les deux, sinon le tableau de santé mentait. Désormais tout part
 * d'ici : le dashboard affiche `CRON_HEALTH`, et le crontab du conteneur `cron`
 * est généré depuis `CRON_JOBS` + `CRON_COMMANDS` (voir
 * `scripts/generate-crontab.ts`).
 *
 * Fuseau horaire : toutes les heures ci-dessous sont en Africa/Porto-Novo
 * (le crontab généré pose `TZ=Africa/Porto-Novo`).
 *
 * Règles d'ordre (ne pas les casser sans réfléchir) :
 * - `backup` (pg_dump) tourne dans la nuit, AVANT `collect-metrics`.
 * - `collect-metrics` tourne AVANT `email-alerts` (jamais à la même heure) :
 *   les alertes de délivrabilité lisent les métriques du jour précédent.
 * - `event-reminders` tourne toutes les 15 min mais garde `expectedEveryH: 1` :
 *   cette valeur sert à la détection de panne, et un seuil quotidien
 *   déclencherait de fausses alertes.
 *
 * Secrets : CRON_SECRET ne doit JAMAIS apparaître ici ni dans le crontab
 * généré. Les crons HTTP passent par le wrapper `call-cron <slug>` du
 * conteneur, qui lit le secret depuis un fichier (variable d'environnement
 * ou secret Docker) et le transmet en en-tête `Authorization: Bearer`.
 */

export type CronJob = {
  /** Segment d'URL sous /api/cron/ — ex. "collect-metrics". */
  slug: string;
  label: string;
  /** Expression cron à 5 champs, heure Africa/Porto-Novo. */
  schedule: string;
  /** Seuil de détection de panne (heures) ; null = pas de heartbeat attendu. */
  expectedEveryH: number | null;
  /** AnalyticsEvent.type écrit par le job (null si aucun heartbeat). */
  eventKey: string | null;
};

export type CronCommand = {
  slug: string;
  label: string;
  /** Expression cron à 5 champs, heure Africa/Porto-Novo. */
  schedule: string;
  /** Commande shell brute, exécutée par crond dans le conteneur cron. */
  command: string;
};

export type CronHealthRow = {
  key: string;
  label: string;
  expectedEveryH: number | null;
};

/**
 * Ce qui est RÉELLEMENT planifié (jobs HTTP).
 * Ordre = ordre d'affichage du dashboard pour les 5 lignes santé.
 */
export const CRON_JOBS: readonly CronJob[] = [
  {
    slug: "relance",
    label: "Relance profils (J+7)",
    schedule: "0 7 * * *",
    expectedEveryH: 24,
    eventKey: "cron_relance",
  },
  {
    slug: "email-alerts",
    label: "Alertes délivrabilité",
    // Après collect-metrics (qui tourne à 4h30) : les alertes lisent les
    // métriques du jour précédent, jamais à la même heure.
    schedule: "30 6 * * *",
    expectedEveryH: 24,
    eventKey: "cron_email_alerts",
  },
  {
    slug: "admin-alerts",
    label: "Alertes admin (Discord)",
    // Quotidien 7h45, après relance (7h00) et email-alerts (6h30) : les
    // vérifications portent sur les dernières 24h glissantes.
    schedule: "45 7 * * *",
    expectedEveryH: 25,
    eventKey: "cron_admin_alerts",
  },
  {
    slug: "collect-metrics",
    label: "Collecte métriques",
    // Après le backup de 3h, avant email-alerts de 6h30 (dépendance lue plus haut).
    schedule: "30 4 * * *",
    expectedEveryH: 24,
    eventKey: "cron_collect_metrics",
  },
  {
    slug: "event-reminders",
    label: "Relances événements (J-3/J-1/H-1)",
    // Toutes les 15 min (fenêtres J-3/J-1/H-1), mais expectedEveryH reste à 1 :
    // c'est un seuil de détection de panne, pas la fréquence réelle.
    // NOTE : la détection suppose que la route écrit un AnalyticsEvent de ce
    // type à chaque passage (heartbeat visible au dashboard).
    schedule: "*/15 * * * *",
    expectedEveryH: 1,
    eventKey: "cron_event_reminders",
  },
  {
    slug: "keepalive",
    label: "Ping de santé",
    // Ping de santé. base
    // est un conteneur `postgres` local (cf. compose.yml) : ce job devient
    // alors inutile — on le garde planifié en attendant une décision explicite
    // de suppression, car il est inoffensif (simple SELECT 1).
    // Pas de heartbeat (eventKey null) : invisible au tableau de santé.
    schedule: "*/10 * * * *",
    expectedEveryH: null,
    eventKey: null,
  },
  {
    slug: "health-alert",
    label: "Alerte santé (Discord)",
    // Vérifie la santé de l'app (DB + mail) et notifie Discord si l'état
    // est `degraded` ou `down`. Même cadence que keepalive, sans heartbeat :
    // invisible au tableau de santé (eventKey null). La route est silencieuse
    // quand tout est OK — aucun spam Discord.
    schedule: "*/10 * * * *",
    expectedEveryH: null,
    eventKey: null,
  },
];

/**
 * Ce qui est RÉELLEMENT planifié (commandes shell, pas HTTP).
 */
export const CRON_COMMANDS: readonly CronCommand[] = [
  {
    slug: "backup",
    label: "Sauvegarde Postgres (pg_dump)",
    // Dans la nuit, AVANT collect-metrics (4h30) pour ne jamais charger la
    // base pendant la collecte. Les `%` sont échappés (`\%`) : cron les
    // interpréterait sinon comme des sauts de ligne.
    schedule: "0 3 * * *",
    command:
      'pg_dump --dbname="$DATABASE_URL" -Fc -f /backups/hashcode-$(date +\\%Y\\%m\\%d-\\%H\\%M).dump',
  },
];

/**
 * Actions admin manuelles (pas des crons) : elles n'ont ni schedule ni
 * heartbeat, mais le dashboard les affiche avec `expectedEveryH: null`
 * (statut "manual" / "never"). Liste dédiée, concaténée ci-dessous —
 * ne jamais les écrire en dur à côté.
 */
export const CRON_MANUAL: readonly CronHealthRow[] = [
  { key: "admin_announce_dashboard", label: "Annonce espace (manuel)", expectedEveryH: null },
  { key: "admin_invite_relance", label: "Relance invitations (manuel)", expectedEveryH: null },
  { key: "admin_import_invite", label: "Import invitations (manuel)", expectedEveryH: null },
];

/**
 * Ce que le dashboard affiche : les 5 premières lignes sont DÉRIVÉES de
 * `CRON_JOBS` via `eventKey` (jobs avec heartbeat), suivies des actions
 * manuelles. Ordre figé (l'UI admin en dépend) :
 * relance, email_alerts, admin_alerts, collect_metrics, event_reminders,
 * puis les 3 manuels.
 */
export const CRON_HEALTH: readonly CronHealthRow[] = [
  ...CRON_JOBS.flatMap((j) =>
    j.eventKey === null
      ? []
      : [{ key: j.eventKey, label: j.label, expectedEveryH: j.expectedEveryH }],
  ),
  ...CRON_MANUAL,
];

/**
 * Rend le contenu complet du crontab à partir du registre.
 * Pure et déterministe : même ordre à chaque appel (ordre du registre),
 * aucun secret interpolé. Utilisée par `scripts/generate-crontab.ts`.
 */
export function renderCrontab(): string {
  // Garde-fou : deux tâches ne doivent jamais partager un slug, sinon
  // `--check` deviendrait ambigu et le debug `crontab -l` illisible.
  const seen = new Set<string>();
  for (const t of [...CRON_COMMANDS, ...CRON_JOBS]) {
    if (seen.has(t.slug)) throw new Error(`Slug cron dupliqué : ${t.slug}`);
    seen.add(t.slug);
  }

  const lines: string[] = [
    "# GÉNÉRÉ AUTOMATIQUEMENT — ne pas éditer à la main.",
    "# Source : src/lib/cron/registry.ts",
    "# Régénérer : node --import tsx scripts/generate-crontab.ts --out <fichier>",
    "# Fuseau horaire : Africa/Porto-Novo (TZ ci-dessous).",
    `# Tâches commande : ${CRON_COMMANDS.map((c) => c.slug).join(", ")}`,
    `# Tâches HTTP (via wrapper call-cron, secret lu depuis un fichier) : ${CRON_JOBS.map((j) => j.slug).join(", ")}`,
    "TZ=Africa/Porto-Novo",
    "",
  ];
  // Commandes d'abord (backup nocturne), puis jobs HTTP dans l'ordre du registre.
  for (const c of CRON_COMMANDS) {
    lines.push(`${c.schedule} ${c.command}  # ${c.label} (${c.slug})`);
  }
  for (const j of CRON_JOBS) {
    // Le secret n'est JAMAIS sur la ligne : `call-cron` le lit depuis un fichier.
    lines.push(`${j.schedule} call-cron ${j.slug}  # ${j.label}`);
  }
  lines.push("");
  return lines.join("\n");
}
