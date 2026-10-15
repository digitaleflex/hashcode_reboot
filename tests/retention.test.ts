/**
 * Rétention #153 — politique pure, sans DB.
 * Run: tsx --test tests/retention.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  RETENTION,
  purgeCutoffs,
  purgeExpired,
  type PurgeDb,
} from "../src/lib/retention";

const NOW = new Date("2026-10-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

function fakeDb(calls: string[]): PurgeDb {
  const table = (name: string, count: number) => ({
    deleteMany: async (args: unknown) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return { count };
    },
  });
  return {
    profilingDraft: table("drafts", 2),
    analyticsEvent: table("analytics", 5),
    memberEmailLog: table("emailLogs", 3),
    emailProviderMetric: table("metrics", 7),
  };
}

describe("politique : durées versionnées", () => {
  test("bornes saines (jamais de purge agressive par défaut)", () => {
    assert.ok(RETENTION.draftCompletedDays >= 30, "convertis : grâce support");
    assert.ok(RETENTION.draftAbandonedRelancedDays >= 90, "abandonnés : relance J+7 intouchable");
    assert.ok(RETENTION.analyticsDays >= 365, "mesures : 13 mois CNIL");
  });

  test("cutoffs cohérents avec now injecté", () => {
    const cut = purgeCutoffs(NOW);
    assert.equal(
      cut.draftsCompletedBefore.getTime(),
      daysAgo(RETENTION.draftCompletedDays).getTime(),
    );
    assert.ok(cut.draftsAbandonedBefore < cut.draftsCompletedBefore);
    assert.ok(cut.eventsBefore < cut.draftsAbandonedBefore);
  });
});

describe("purgeExpired : périmètre strict", () => {
  test("requêtes ciblées (jamais de deleteMany sans where)", async () => {
    const calls: string[] = [];
    const counts = await purgeExpired(fakeDb(calls), NOW);
    assert.deepEqual(counts, {
      drafts: 4,
      analytics: 5,
      emailLogs: 3,
      providerMetrics: 7,
    });
    assert.equal(calls.length, 5);
    for (const c of calls) {
      assert.ok(c.includes('"where"'), `deleteMany ciblé : ${c}`);
    }
    const draftsCalls = calls.filter((c) => c.startsWith("drafts:"));
    assert.equal(draftsCalls.length, 2, "convertis ET abandonnés-relancés");
    // Abandonnés éligibles relance préservés : completedAt NULL + relanceSentAt NULL exclus.
    assert.ok(
      draftsCalls.some((c) => c.includes('"completedAt":null')),
      "clause abandonnés explicite",
    );
    // Métriques purgées au jour métrique, pas au createdAt (backfills).
    assert.ok(
      calls.some((c) => c.startsWith("metrics:") && c.includes('"date"')),
      "métriques au champ date",
    );
  });
});
