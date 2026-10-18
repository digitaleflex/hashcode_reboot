/**
 * Fusion de doublons (#103) — exécuteur transactionnel.
 *
 * Utilisé UNIQUEMENT par POST /api/admin/duplicates/merge (paire choisie
 * par un humain ; AMBIGU exige `acknowledgeAmbiguous`). Règles :
 *   - loser et winner actifs, distincts (vérifié par la route) ;
 *   - conflits d'unicité : les lignes du perdant en doublon sont SUPPRIMÉES
 *     (même personne, le gagnant garde les siennes) ;
 *   - scalaires : comble les trous du gagnant, n'écrase jamais ;
 *   - perdant : soft-delete + note traçable (pas de perte silencieuse) ;
 *   - blacklist jamais touchée ; auth Better Auth hors périmètre
 *     (le login par email du perdant tombe en 401 après soft-delete) ;
 *   - rejouer après fusion → perdant deleted → erreur LOSER_GONE (409 route).
 */
import type { PrismaClient } from "@prisma/client";
import { mergeFillValues } from "./dedup";

type Db = Pick<
  PrismaClient,
  | "member"
  | "memberSession"
  | "eventRsvp"
  | "memberEmailLog"
  | "memberNote"
  | "workshopSubmission"
  | "workshopQuizAttempt"
  | "workshopEnrollment"
  | "missionAssignment"
  | "missionSubmission"
  | "mentorship"
  | "consent"
  | "qualification"
  | "analyticsEvent"
  | "profilingDraft"
  | "emailEvent"
> & {
  $transaction<T>(ops: Promise<T>[]): Promise<T[]>;
};

export interface MergeSummary {
  moved: Record<string, number>;
  deletedConflicts: Record<string, number>;
  filled: string[];
  loserId: string;
  winnerId: string;
}

export async function mergeMembers(
  db: Db,
  loserId: string,
  winnerId: string,
): Promise<MergeSummary> {
  const [loser, winner] = await Promise.all([
    db.member.findUnique({ where: { id: loserId } }),
    db.member.findUnique({ where: { id: winnerId } }),
  ]);
  if (!loser || loser.deletedAt) throw new Error("LOSER_GONE");
  if (!winner || winner.deletedAt) throw new Error("WINNER_GONE");

  const deletedConflicts: Record<string, number> = {};
  const moved: Record<string, number> = {};

  // Conflits d'unicité : supprime les lignes du perdant déjà présentes
  // chez le gagnant (même personne → pas de perte utile).
  const dropDupes = async (
    table: string,
    loserKeys: Set<string>,
    winnerKeys: Set<string>,
    ids: Map<string, string>,
  ): Promise<void> => {
    const dupIds = [...ids.entries()]
      .filter(([, k]) => winnerKeys.has(k))
      .map(([id]) => id);
    void loserKeys;
    if (dupIds.length === 0) return;
    if (table === "eventRsvp") {
      deletedConflicts.eventRsvp = (
        await db.eventRsvp.deleteMany({ where: { id: { in: dupIds } } })
      ).count;
    } else if (table === "workshopEnrollment") {
      deletedConflicts.workshopEnrollment = (
        await db.workshopEnrollment.deleteMany({ where: { id: { in: dupIds } } })
      ).count;
    } else if (table === "workshopSubmission") {
      deletedConflicts.workshopSubmission = (
        await db.workshopSubmission.deleteMany({ where: { id: { in: dupIds } } })
      ).count;
    } else if (table === "missionSubmission") {
      deletedConflicts.missionSubmission = (
        await db.missionSubmission.deleteMany({ where: { id: { in: dupIds } } })
      ).count;
    } else if (table === "mentorship") {
      deletedConflicts.mentorship = (
        await db.mentorship.deleteMany({ where: { id: { in: dupIds } } })
      ).count;
    }
  };

  const loserRsvps = await db.eventRsvp.findMany({
    where: { memberId: loserId },
    select: { id: true, eventId: true },
  });
  const winnerEventIds = new Set(
    (
      await db.eventRsvp.findMany({ where: { memberId: winnerId }, select: { eventId: true } })
    ).map((r) => r.eventId),
  );
  await dropDupes(
    "eventRsvp",
    new Set(),
    winnerEventIds,
    new Map(loserRsvps.map((r) => [r.id, r.eventId])),
  );

  const loserEnrolls = await db.workshopEnrollment.findMany({
    where: { memberId: loserId },
    select: { id: true, workshopId: true },
  });
  const winnerWorkshopIds = new Set(
    (
      await db.workshopEnrollment.findMany({
        where: { memberId: winnerId },
        select: { workshopId: true },
      })
    ).map((r) => r.workshopId),
  );
  await dropDupes(
    "workshopEnrollment",
    new Set(),
    winnerWorkshopIds,
    new Map(loserEnrolls.map((r) => [r.id, r.workshopId])),
  );

  const loserWSubs = await db.workshopSubmission.findMany({
    where: { memberId: loserId },
    select: { id: true, deliverableId: true, attempt: true },
  });
  const winnerWSubs = new Set(
    (
      await db.workshopSubmission.findMany({
        where: { memberId: winnerId },
        select: { deliverableId: true, attempt: true },
      })
    ).map((r) => `${r.deliverableId}#${r.attempt}`),
  );
  await dropDupes(
    "workshopSubmission",
    new Set(),
    winnerWSubs,
    new Map(loserWSubs.map((r) => [r.id, `${r.deliverableId}#${r.attempt}`])),
  );

  const loserMSubs = await db.missionSubmission.findMany({
    where: { memberId: loserId },
    select: { id: true, missionId: true, attempt: true },
  });
  const winnerMSubs = new Set(
    (
      await db.missionSubmission.findMany({
        where: { memberId: winnerId },
        select: { missionId: true, attempt: true },
      })
    ).map((r) => `${r.missionId}#${r.attempt}`),
  );
  await dropDupes(
    "missionSubmission",
    new Set(),
    winnerMSubs,
    new Map(loserMSubs.map((r) => [r.id, `${r.missionId}#${r.attempt}`])),
  );

  // Mentorat : collision après réassignation (loser→winner sur chaque rôle).
  const loserMent = await db.mentorship.findMany({
    where: { OR: [{ mentorId: loserId }, { menteeId: loserId }] },
    select: { id: true, mentorId: true, menteeId: true, status: true },
  });
  const winnerMent = new Set(
    (
      await db.mentorship.findMany({
        where: { OR: [{ mentorId: winnerId }, { menteeId: winnerId }] },
        select: { mentorId: true, menteeId: true, status: true },
      })
    ).map((r) => `${r.mentorId}#${r.menteeId}#${r.status}`),
  );
  await dropDupes(
    "mentorship",
    new Set(),
    winnerMent,
    new Map(
      loserMent.map((r) => [
        r.id,
        `${r.mentorId === loserId ? winnerId : r.mentorId}#${r.menteeId === loserId ? winnerId : r.menteeId}#${r.status}`,
      ]),
    ),
  );

  // Réassignations (transaction : tout ou rien). Les updateMany retournent
  // { count } → compteurs exacts déplacés.
  const tx = await db.$transaction([
    db.memberSession.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.eventRsvp.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.memberEmailLog.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.memberNote.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.workshopSubmission.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.workshopQuizAttempt.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.workshopEnrollment.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.missionAssignment.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.missionSubmission.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.mentorship.updateMany({ where: { mentorId: loserId }, data: { mentorId: winnerId } }),
    db.mentorship.updateMany({ where: { menteeId: loserId }, data: { menteeId: winnerId } }),
    db.consent.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.consent.updateMany({ where: { email: loser.email }, data: { email: winner.email } }),
    db.qualification.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.analyticsEvent.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.emailEvent.updateMany({ where: { memberId: loserId }, data: { memberId: winnerId } }),
    db.emailEvent.updateMany({ where: { email: loser.email }, data: { email: winner.email } }),
  ]);
  const tables = [
    "memberSession",
    "eventRsvp",
    "memberEmailLog",
    "memberNote",
    "workshopSubmission",
    "workshopQuizAttempt",
    "workshopEnrollment",
    "missionAssignment",
    "missionSubmission",
    "mentorshipAsMentor",
    "mentorshipAsMentee",
    "consentByMember",
    "consentByEmail",
    "qualification",
    "analyticsEvent",
    "emailEventByMember",
    "emailEventByEmail",
  ];
  tables.forEach((t, i) => {
    moved[t] = (tx[i] as { count: number }).count;
  });

  // Brouillon : re-clé vers le gagnant sauf s'il en a déjà un.
  const winnerDraft = await db.profilingDraft.findUnique({ where: { email: winner.email } });
  if (winnerDraft) {
    const d = await db.profilingDraft.deleteMany({ where: { email: loser.email } });
    deletedConflicts.profilingDraft = d.count;
  } else {
    const u = await db.profilingDraft.updateMany({
      where: { email: loser.email },
      data: { email: winner.email },
    });
    moved.profilingDraft = u.count;
  }

  // Champs comblés (jamais d'écrasement) + tags admin unis + soft-delete
  // traçable du perdant. Tags AUTO `tags` exclus (régénérables par le moteur).
  const fill = mergeFillValues(
    winner as unknown as Record<string, unknown>,
    loser as unknown as Record<string, unknown>,
  );
  const parseTags = (v: unknown): string[] => {
    if (typeof v !== "string" || !v.trim()) return [];
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const unionTags = [
    ...new Set([...parseTags(winner.customTags), ...parseTags(loser.customTags)]),
  ].slice(0, 20);
  const currentTags = parseTags(winner.customTags);
  const tagsChanged =
    unionTags.length !== currentTags.length ||
    unionTags.some((t, i) => t !== currentTags[i]);
  await db.member.update({
    where: { id: winnerId },
    data: { ...fill, ...(tagsChanged ? { customTags: JSON.stringify(unionTags) } : {}) },
  });
  const keptNote =
    typeof winner.adminNote === "string" && winner.adminNote.trim() ? winner.adminNote : null;
  await db.member.update({
    where: { id: loserId },
    data: {
      deletedAt: new Date(),
      adminNote: [keptNote, `Fusionné dans ${winnerId} (${winner.email}).`]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 2000),
    },
  });

  return {
    moved,
    deletedConflicts,
    filled: Object.keys(fill),
    loserId,
    winnerId,
  };
}
