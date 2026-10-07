/**
 * HASHCODE REBOOT — alertes admin (#119) : pic d'inscriptions + exports tronqués.
 *
 * Principe : comme `src/lib/email-alerts.ts`, les seuils vivent en dur
 * (DEFAULT) avec surcharge par variable d'environnement. Et comme
 * `src/lib/discord.ts`, une alerte ne doit JAMAIS faire échouer l'appelant :
 * `runAdminAlertCheck()` absorbe toute erreur (requête comme envoi Discord)
 * et retourne toujours un verdict.
 *
 * Découpage :
 * - `checkAdminAlerts()` — vérifications pures, SANS effet de bord. Utilisée
 *   par la route cron (avec notification) ET par GET /api/admin/dashboard
 *   (sans notification : un simple affichage ne doit jamais spammer Discord).
 * - `runAdminAlertCheck()` — `checkAdminAlerts()` + un `sendDiscordAlert()`
 *   par alerte, réservée à la route cron.
 *
 * Source des exports tronqués : les routes d'export écrivent un AnalyticsEvent
 * { type: "community_cta_clicked", ref: "admin-export-<csv|json>:N/total" }
 * (voir src/app/api/export/route.ts et src/app/api/export/json/route.ts).
 * Le ref porte déjà exported (N) et total — aucun changement émetteur requis.
 */

import { db } from "@/lib/db";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import { DISCORD_COLOR_WARN, sendDiscordAlert } from "@/lib/discord";

/** Multiplicateur du pic : alerte si dernières 24h >= MULTIPLIER × 24h précédentes. */
export const DEFAULT_SIGNUP_MULTIPLIER = 3;
/** Seuil absolu : en dessous, jamais d'alerte même si le ratio explose. */
export const DEFAULT_SIGNUP_MIN = 10;

function readSignupThresholds(): { multiplier: number; min: number } {
  const rawMultiplier = Number(process.env.ADMIN_ALERT_SIGNUP_MULTIPLIER);
  const rawMin = Number(process.env.ADMIN_ALERT_SIGNUP_MIN);
  return {
    multiplier:
      Number.isFinite(rawMultiplier) && rawMultiplier > 0
        ? rawMultiplier
        : DEFAULT_SIGNUP_MULTIPLIER,
    min: Number.isFinite(rawMin) && rawMin > 0 ? Math.floor(rawMin) : DEFAULT_SIGNUP_MIN,
  };
}

export interface AdminAlert {
  /** Clé stable (ex. "signup-spike", "export-truncated-<id>"). */
  key: string;
  title: string;
  detail: string;
  /** Couleur Discord de l'embed (toujours WARN pour l'instant). */
  color: number;
}

/** Parse `admin-export-<csv|json>:N/total`. Retourne null si inattendu. */
export function parseExportRef(
  ref: string | null,
): { format: string; exported: number; total: number } | null {
  if (!ref) return null;
  const m = /^admin-export-(csv|json):(\d+)\/(\d+)$/.exec(ref.trim());
  if (!m) return null;
  return { format: m[1], exported: Number(m[2]), total: Number(m[3]) };
}

/**
 * Vérifie les seuils admin, SANS notifier. Ne lance jamais d'exception
 * (une section dashboard en échec ne doit pas bloquer les autres).
 */
export async function checkAdminAlerts(now: Date = new Date()): Promise<AdminAlert[]> {
  try {
    const alerts: AdminAlert[] = [];
    const [signupAlert, exportAlerts] = await Promise.all([
      checkSignupSpike(now).catch(() => null),
      checkTruncatedExports(now).catch((): AdminAlert[] => []),
    ]);
    if (signupAlert) alerts.push(signupAlert);
    alerts.push(...exportAlerts);
    return alerts;
  } catch {
    return [];
  }
}

/**
 * Exécute les vérifications ET notifie Discord (une alerte = un embed).
 * Réservée au cron — ne jamais l'appeler depuis une route d'affichage.
 * Ne lance jamais d'exception (le helper Discord est déjà safe, ceinture
 * et bretelles ici pour les requêtes Prisma).
 */
export async function runAdminAlertCheck(now: Date = new Date()): Promise<{
  alerts: AdminAlert[];
}> {
  const alerts = await checkAdminAlerts(now);
  for (const alert of alerts) {
    try {
      await sendDiscordAlert({
        title: alert.title,
        description: alert.detail,
        color: alert.color,
      });
    } catch {
      /* ignore — une alerte ne casse jamais le cron */
    }
  }
  return { alerts };
}

/** Pic d'inscriptions : dernières 24h vs 24h précédentes (membres non supprimés). */
async function checkSignupSpike(now: Date): Promise<AdminAlert | null> {
  const { multiplier, min } = readSignupThresholds();
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prev24hStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [last24h, prev24h] = await Promise.all([
    withPrismaRetry(() =>
      db.member.count({
        where: { deletedAt: null, createdAt: { gte: last24hStart, lt: now } },
      }),
    ),
    withPrismaRetry(() =>
      db.member.count({
        where: { deletedAt: null, createdAt: { gte: prev24hStart, lt: last24hStart } },
      }),
    ),
  ]);

  if (last24h < min) return null;
  // Base nulle : le seul minimum absolu fait foi (pas de ratio calculable).
  if (prev24h > 0 && last24h < multiplier * prev24h) return null;

  return {
    key: "signup-spike",
    title: "Pic d'inscriptions",
    detail:
      `${last24h} inscription(s) sur les dernières 24h ` +
      `contre ${prev24h} sur les 24h précédentes ` +
      `(seuils : min=${min}, ×${multiplier}).`,
    color: DISCORD_COLOR_WARN,
  };
}

/** Exports tronqués : un AnalyticsEvent `admin-export-*` avec exported < total. */
async function checkTruncatedExports(now: Date): Promise<AdminAlert[]> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const events = await withPrismaRetry(() =>
    db.analyticsEvent.findMany({
      where: {
        type: "community_cta_clicked",
        createdAt: { gte: since },
        ref: { startsWith: "admin-export-" },
      },
      select: { id: true, ref: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );

  const alerts: AdminAlert[] = [];
  for (const e of events) {
    const parsed = parseExportRef(e.ref);
    if (!parsed) continue;
    if (parsed.exported >= parsed.total) continue;
    alerts.push({
      key: `export-truncated-${e.id}`,
      title: "Export tronqué",
      detail:
        `Export ${parsed.format} partiel : ${parsed.exported}/${parsed.total} ` +
        `lignes exportées le ${e.createdAt.toISOString()} ` +
        `(plafond MAX_EXPORT atteint).`,
      color: DISCORD_COLOR_WARN,
    });
  }
  return alerts;
}
