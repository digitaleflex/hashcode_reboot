/**
 * HASHCODE REBOOT — Boucle comportementale (M5).
 *
 * Transforme l'activité observée en `ObservedSignals` consommés par
 * `buildLayeredProfile` (M2) : OBSERVE → RE-SCORE.
 *
 * Deux couches :
 *  - `toObservedSignals` : pure, déterministe, testée (compteurs → signaux) ;
 *  - `loadObservedSignals` : adaptateur DB fin (requêtes minimales, select
 *    restreints). Toute erreur remonte à l'appelant.
 *
 * Aucune migration, aucune écriture : lecture seule.
 */

import { db } from "@/lib/db";
import type { ObservedSignals } from "@/lib/profiling/layers";

/** Compteurs bruts lus en base (entrée de la fonction pure). */
export interface ObservedSignalInput {
  workshopsStarted: number;
  workshopsCompleted: number;
  eventsJoined: number;
  mentoringRequested: boolean;
  invitationClicks: number;
  invitationAccepted: boolean;
  invitationSent: boolean;
  /** ISO dates d'activité (toutes sources confondues), pour lastActivityAt. */
  activityDates: (string | Date | null | undefined)[];
}

/** Normalise des compteurs bruts en signaux observés (pure). */
export function toObservedSignals(input: ObservedSignalInput): ObservedSignals {
  const norm = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

  const dates = input.activityDates
    .map((d) => (d instanceof Date ? d : d ? new Date(d) : null))
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .map((d) => d.toISOString())
    .sort();
  const lastActivityAt = dates.length > 0 ? dates[dates.length - 1] : null;

  const recosAccepted =
    input.invitationAccepted || input.invitationClicks > 0
      ? Math.max(1, norm(input.invitationClicks))
      : 0;
  const recosIgnored =
    input.invitationSent && !input.invitationAccepted && input.invitationClicks === 0
      ? 1
      : 0;

  return {
    workshopsStarted: norm(input.workshopsStarted),
    workshopsCompleted: norm(input.workshopsCompleted),
    eventsJoined: norm(input.eventsJoined),
    mentoringRequested: input.mentoringRequested,
    recosAccepted,
    recosIgnored,
    lastActivityAt,
  };
}

/**
 * Charge les signaux observés d'un membre (lecture seule).
 * Requêtes minimales, champs restreints, en parallèle.
 */
export async function loadObservedSignals(
  memberId: string,
): Promise<ObservedSignals> {
  const [member, enrollments, rsvps, submissions, mentorships] =
    await Promise.all([
      db.member.findUnique({
        where: { id: memberId },
        select: {
          invitedAt: true,
          acceptedAt: true,
          joinedAt: true,
          invitationClicks: true,
          mentorContactedAt: true,
        },
      }),
      db.workshopEnrollment.findMany({
        where: { memberId },
        select: { status: true, enrolledAt: true },
      }),
      db.eventRsvp.findMany({
        where: { memberId, status: "going" },
        select: { createdAt: true },
      }),
      db.workshopSubmission.findMany({
        where: { memberId, status: "APPROVED" },
        select: { submittedAt: true },
      }),
      db.mentorship.count({
        where: { menteeId: memberId, status: { in: ["ACTIVE", "PAUSED", "ENDED"] } },
      }),
    ]);

  if (!member) throw new Error("member-not-found");

  const completedEnrollments = enrollments.filter(
    (e) => e.status === "completed",
  ).length;

  return toObservedSignals({
    workshopsStarted: enrollments.length,
    // Inscriptions terminées OU au moins un livrable approuvé = complétion.
    workshopsCompleted: Math.max(
      completedEnrollments,
      submissions.length > 0 ? 1 : 0,
    ),
    eventsJoined: rsvps.length,
    mentoringRequested: mentorships > 0 || member.mentorContactedAt !== null,
    invitationClicks: member.invitationClicks ?? 0,
    invitationAccepted: member.acceptedAt !== null || member.joinedAt !== null,
    invitationSent: member.invitedAt !== null,
    activityDates: [
      ...enrollments.map((e) => e.enrolledAt),
      ...rsvps.map((r) => r.createdAt),
      ...submissions.map((s) => s.submittedAt),
      member.joinedAt,
    ],
  });
}
