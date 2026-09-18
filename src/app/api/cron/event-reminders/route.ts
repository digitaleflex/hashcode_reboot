import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEventReminderEmail } from "@/lib/mail";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";
import { planBatch } from "@/lib/email-budget";
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
 */

const OFFSETS = [
  { minutes: 4320, label: "J-3" },
  { minutes: 1440, label: "J-1" },
  { minutes: 60, label: "H-1" },
] as const;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "event-reminders non configuré (CRON_SECRET manquant)" },
      { status: 401 },
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();

  // ── 1) Événements à venir, déjà annoncés, non annulés ──────────────────
  const events = await db.event.findMany({
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
  });

  let remindersSent = 0;
  let remindersSkipped = 0;
  let membersTotal = 0;
  let sentTotal = 0;

  for (const event of events) {
    const rsvpUrl =
      (process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com") +
      "/dashboard/agenda";

    for (const offset of OFFSETS) {
      const triggerAt = new Date(
        event.startsAt.getTime() - offset.minutes * 60_000,
      );
      // Pas encore temps d'envoyer cette relance.
      if (now < triggerAt) continue;

      // Idempotence : déjà envoyé ?
      const existing = await db.eventReminderLog.findUnique({
        where: {
          eventId_offsetMinutes: {
            eventId: event.id,
            offsetMinutes: offset.minutes,
          },
        },
      });
      if (existing) {
        remindersSkipped++;
        continue;
      }

      // Membres ciblés (même filtre que la notification initiale).
      const members = await db.member.findMany({
        where: { profileStatus: "APPROVED", deletedAt: null },
        select: { id: true, email: true, firstName: true, country: true },
      });

      membersTotal += members.length;

      // Anti-doublon : ne pas re-notifier un membre qui a déjà reçu cette
      // relance ( MemberEmailLog avec kind "relance_event_[offset]" ).
      const kind = `relance_event_${offset.label}` as const;
      const alreadySent = await memberIdsWithEmailLog(
        members.map((m) => m.id),
        kind,
      );
      const targets = members.filter((m) => !alreadySent.has(m.id));

      if (targets.length === 0) {
        // Tous les membres ont déjà reçu cette relance — marquer quand même.
        await db.eventReminderLog.create({
          data: {
            eventId: event.id,
            offsetMinutes: offset.minutes,
            recipientCount: 0,
            sentCount: 0,
          },
        });
        remindersSent++;
        continue;
      }

      // Garde-fou : plan de lot (adaptatif, quota Brevo/Resend).
      const plan = await planBatch({
        category: "notification",
        requested: targets.length,
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

      // Tracer le passage (idempotence).
      await db.eventReminderLog.create({
        data: {
          eventId: event.id,
          offsetMinutes: offset.minutes,
          recipientCount: targets.length,
          sentCount: sent,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: events.length,
    remindersSent,
    remindersSkipped,
    membersTotal,
    sentTotal,
  });
}
