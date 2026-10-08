import { NextRequest, NextResponse } from "next/server";
import { isCronAuthed } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { withPrismaRetry } from "@/lib/prisma-extensions";
import { sendEventReminderEmail } from "@/lib/email/builders";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";
import {
  getBudget,
  planBatch,
  type EmailBudget,
  type EmailProvider,
} from "@/lib/email-budget";
import { zoneForCountry } from "@/lib/events-timezone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/event-reminders — relances automatiques avant chaque événement.
 *
 * 3 relances par événement :
 *   J−3 (4320 min) : « Dans 3 jours — [titre] »
 *   J−1 (1440 min) : « Demain — [titre] »
 *   H−1 (60 min)   : « C'est dans 1 heure ! » + bouton lien Meet
 *
 * Conçu pour être appelé toutes les 15 minutes via cron-job.org :
 *   GET https://<app>.vercel.app/api/cron/event-reminders
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Idempotence : EventReminderLog(eventId, offsetMinutes) — contrainte unique.
 * Les envois individuels sont tracés dans MemberEmailLog (anti-doublon relance).
 * Quota : chaque envoi passe par planBatch → garde-fou Brevo/Resend.
 *
 * Le cron ne notifie PAS les événements passés, annulés, ou dont notifiedAt
 * est null (jamais annoncé — la notification initiale est un geste admin).
 *
 * Perf (un seul passage DB par run, pas par événement) :
 *   - verrou consultatif pg_advisory_xact_lock → runs qui se chevauchent sérialisés
 *   - membres APPROVED chargés UNE fois avant la boucle
 *   - logs EventReminderLog existants chargés en UNE requête (findMany)
 *   - budgets email calculés UNE fois, réutilisés par tous les planBatch
 *   - EventReminderLog écrits en UN createMany final
 */

const OFFSETS = [
  { minutes: 4320, label: "J-3" },
  { minutes: 1440, label: "J-1" },
  { minutes: 60, label: "H-1" },
] as const;

const OFFSET_MINUTES = OFFSETS.map((o) => o.minutes);

/** Clé fixe de sérialisation des runs de ce cron (verrou consultatif Postgres). */
const ADVISORY_LOCK_KEY = 123456;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET && !process.env.CRON_SECRET_PREVIOUS) {
    return NextResponse.json(
      { ok: false, error: "event-reminders non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  if (!isCronAuthed(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();

  // ── Sérialise les runs qui se chevauchent (cron toutes les 15 min) ──────
  // pg_advisory_xact_lock est libéré automatiquement en fin de transaction,
  // y compris sur erreur. Le try/finally garantit le nettoyage best-effort
  // restant (unlock explicite = no-op si déjà libéré).
  await db.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`,
  );
  try {
    // ── 1) Événements à venir, déjà annoncés, non annulés ──────────────────
    // Perf-7 : retry auto sur erreurs transient (pool épuisé, timeout).
    const events = await withPrismaRetry(() =>
      db.event.findMany({
        where: {
          startsAt: { gt: now },
          status: { not: "cancelled" },
          notifiedAt: { not: null },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          location: true,
          url: true,
          domain: true,
          level: true,
        },
      }),
    );

    // ── 2) Idempotence batchée : existants en UNE requête ──────────────────
    const existingLogs =
      events.length > 0
        ? await withPrismaRetry(() =>
            db.eventReminderLog.findMany({
              where: {
                eventId: { in: events.map((e) => e.id) },
                offsetMinutes: { in: [...OFFSET_MINUTES] },
              },
              select: { eventId: true, offsetMinutes: true },
            }),
          )
        : [];
    const alreadyLogged = new Set(
      existingLogs.map((l) => `${l.eventId}:${l.offsetMinutes}`),
    );

    // ── 3) Membres ciblés — UNE SEULE requête pour tout le run ────────────
    // (même filtre que la notification initiale).
    const members = await withPrismaRetry(() =>
      db.member.findMany({
        where: { profileStatus: "APPROVED", deletedAt: null },
        select: { id: true, email: true, firstName: true, country: true },
      }),
    );
    const membersTotal = members.length;
    // Pré-construit une fois : évite members.map(m => m.id) à chaque itération.
    const allMemberIds = members.map((m) => m.id);

    // ── 4) Budgets email mis en cache pour tout le run ────────────────────
    const [brevoBudget, resendBudget] = await Promise.all([
      withPrismaRetry(() => getBudget("brevo", now)),
      withPrismaRetry(() => getBudget("resend", now)),
    ]);
    const budgets: Record<EmailProvider, EmailBudget> = {
      brevo: brevoBudget,
      resend: resendBudget,
    };

    // Anti-doublon MemberEmailLog : un seul appel par kind nécessaire
    // (le kind ne dépend que de l'offset, pas de l'événement).
    const sentByKind = new Map<string, Set<string>>();

    const rsvpUrl =
      (process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com") +
      "/dashboard/agenda";

    let remindersSent = 0;
    let remindersSkipped = 0;
    let sentTotal = 0;

    // Écriture différée : collectés pendant la boucle, UN createMany final.
    const pendingLogs: {
      eventId: string;
      offsetMinutes: number;
      recipientCount: number;
      sentCount: number;
    }[] = [];

    for (const event of events) {
      for (const offset of OFFSETS) {
        const triggerAt = new Date(
          event.startsAt.getTime() - offset.minutes * 60_000,
        );
        // Pas encore temps d'envoyer cette relance.
        if (now < triggerAt) continue;

        // Idempotence : déjà envoyé ?
        if (alreadyLogged.has(`${event.id}:${offset.minutes}`)) {
          remindersSkipped++;
          continue;
        }

        // Anti-doublon : ne pas re-notifier un membre qui a déjà reçu cette
        // relance ( MemberEmailLog avec kind "relance_event_[offset]" ).
        const kind = `relance_event_${offset.label}` as const;
        let alreadySent = sentByKind.get(kind);
        if (!alreadySent) {
          alreadySent = await withPrismaRetry(() =>
            memberIdsWithEmailLog(allMemberIds, kind),
          );
          sentByKind.set(kind, alreadySent);
        }
        const targets = members.filter((m) => !alreadySent.has(m.id));

        if (targets.length === 0) {
          // Tous les membres ont déjà reçu cette relance — marquer quand même.
          pendingLogs.push({
            eventId: event.id,
            offsetMinutes: offset.minutes,
            recipientCount: 0,
            sentCount: 0,
          });
          remindersSent++;
          continue;
        }

        // Garde-fou : plan de lot (budgets pré-chargés, aucune requête ici).
        const plan = await planBatch({
          category: "notification",
          requested: targets.length,
          budgets,
        });

        let sent = 0;
        const chunkSize = plan.batchSize || 10;
        const queue = targets.slice(0, plan.allowed);

        for (let i = 0; i < queue.length; i += chunkSize) {
          const chunk = queue.slice(i, i + chunkSize);
          const results = await Promise.allSettled(
            chunk.map((member) =>
              sendEventReminderEmail({
                to: member.email,
                firstName: member.firstName,
                event: {
                  title: event.title,
                  startsAt: event.startsAt,
                  location: event.location,
                  url: event.url,
                },
                rsvpUrl,
                offsetLabel: offset.label,
                timeZone: zoneForCountry(member.country),
                forceProvider: plan.provider,
              }),
            ),
          );

          for (let j = 0; j < results.length; j++) {
            const r = results[j];
            const member = chunk[j];
            if (r.status === "fulfilled" && r.value.ok) {
              sent++;
              try {
                await logMemberEmail({
                  memberId: member.id,
                  email: member.email,
                  kind,
                  provider: r.value.provider,
                  providerId: r.value.id,
                });
              } catch {
                /* best-effort */
              }
            }
          }

          // Pacing entre chunks.
          if (i + chunkSize < queue.length && plan.delayMs > 0) {
            await new Promise((r) => setTimeout(r, plan.delayMs));
          }
        }

        sentTotal += sent;
        remindersSent++;

        // Tracer le passage (idempotence) — écriture différée en fin de run.
        pendingLogs.push({
          eventId: event.id,
          offsetMinutes: offset.minutes,
          recipientCount: targets.length,
          sentCount: sent,
        });
      }
    }

    // ── 5) Écriture batchée des logs de relance ───────────────────────────
    // skipDuplicates : ceinture + bretelles avec la contrainte unique
    // (eventId, offsetMinutes) si deux runs sérialisés se chevauchent.
    if (pendingLogs.length > 0) {
      await withPrismaRetry(() =>
        db.eventReminderLog.createMany({
          data: pendingLogs,
          skipDuplicates: true,
        }),
      );
    }

    // Heartbeat : sans cette ligne, le tableau de santé admin affiche
    // « Relances événements » en `never` en permanence — même quand le cron
    // tourne parfaitement — et HealthAlertsBanner le remonte comme cron stale.
    // Même défaut que les 3 autres crons, qui écrivent toutes leur clé `cron_*`.
    // Best-effort : un échec ici ne doit pas faire échouer l'envoi des relances.
    try {
      await withPrismaRetry(() =>
        db.analyticsEvent.create({
          data: {
            type: "cron_event_reminders",
            ref: `checked=${events.length} sent=${sentTotal} batches=${remindersSent}`,
            value: sentTotal,
          },
        }),
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ok: true,
      checked: events.length,
      remindersSent,
      remindersSkipped,
      membersTotal,
      sentTotal,
    });
  } finally {
    try {
      await db.$executeRawUnsafe(
        `SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`,
      );
    } catch {
      /* déjà libéré en fin de transaction — ignore */
    }
  }
}
