/**
 * Suivi activation — premier challenge (issue #120, version SIMPLE v1).
 *
 * DÉFINITIONS (validées) :
 * - premier challenge = au moins 1 WorkshopSubmission (TOUT statut confondu),
 *   date = MIN(submittedAt) du membre.
 * - dénominateur du taux = membres profileStatus APPROVED + deletedAt null.
 * - pas de moteur COMPLETED : seule la présence d'une soumission compte.
 *
 * Pur + requêtes Prisma. Aucune dépendance au cycle de requête.
 */

import { db } from "@/lib/db";

export interface ActivationRate {
  rate: number;
  activated: number;
  eligible: number;
}

export interface ActivationCurvePoint {
  date: string; // "YYYY-MM-DD" (UTC)
  count: number;
}

export interface InactiveMember {
  id: string;
  firstName: string;
  email: string;
  /** ISO de Member.createdAt. */
  since: string;
  /** Jours entiers depuis createdAt. */
  daysInactive: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Date du premier challenge par membre (MIN submittedAt, tout statut).
 * Retourne memberId -> date de première soumission.
 */
export async function getFirstChallengeDates(): Promise<Map<string, Date>> {
  const groups = await db.workshopSubmission.groupBy({
    by: ["memberId"],
    _min: { submittedAt: true },
  });
  const out = new Map<string, Date>();
  for (const g of groups) {
    if (g._min.submittedAt) out.set(g.memberId, g._min.submittedAt);
  }
  return out;
}

/** Taux d'activation : membres éligibles ayant soumis au moins 1 challenge. */
export async function getActivationRate(): Promise<ActivationRate> {
  const eligibleIds = await db.member.findMany({
    where: { profileStatus: "APPROVED", deletedAt: null },
    select: { id: true },
  });
  const eligible = eligibleIds.length;
  if (eligible === 0) return { rate: 0, activated: 0, eligible: 0 };
  const activatedGroups = await db.workshopSubmission.groupBy({
    by: ["memberId"],
    where: { memberId: { in: eligibleIds.map((m) => m.id) } },
  });
  const activated = activatedGroups.length;
  return {
    rate: eligible > 0 ? round2((activated / eligible) * 100) : 0,
    activated,
    eligible,
  };
}

/**
 * Membres inactifs depuis 7+ jours : APPROVED + deletedAt null +
 * createdAt <= J-7 + AUCUNE soumission. Les plus anciens d'abord (max 50).
 */
export async function getInactive7d(now: Date = new Date()): Promise<InactiveMember[]> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.member.findMany({
    where: {
      profileStatus: "APPROVED",
      deletedAt: null,
      createdAt: { lte: cutoff },
      workshopSubmissions: { none: {} },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
    select: { id: true, firstName: true, email: true, createdAt: true },
  });
  return rows.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    email: m.email,
    since: m.createdAt.toISOString(),
    daysInactive: Math.max(
      0,
      Math.floor((now.getTime() - m.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    ),
  }));
}

/**
 * Courbe d'activation : nombre de premiers challenges par jour sur les
 * `days` derniers jours (aujourd'hui inclus). Jours vides remplis à 0 côté JS.
 */
export async function getActivationCurve(days = 30): Promise<ActivationCurvePoint[]> {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
  const now = new Date();
  const todayKey = dayKey(now);

  // Démarre à J-(safeDays-1) 00:00 UTC pour couvrir exactement `safeDays` jours.
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));

  const groups = await db.workshopSubmission.groupBy({
    by: ["memberId"],
    _min: { submittedAt: true },
    where: { submittedAt: { gte: start } },
  });

  const counts = new Map<string, number>();
  for (const g of groups) {
    const first = g._min.submittedAt;
    if (!first) continue;
    const key = dayKey(first);
    if (key < dayKey(start) || key > todayKey) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const curve: ActivationCurvePoint[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < safeDays; i++) {
    const key = dayKey(cursor);
    curve.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return curve;
}
