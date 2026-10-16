/**
 * Dictionnaire analytics (#156) — cohérence émetteurs/dashboard, sans DB.
 * Run: tsx --test tests/analytics-dictionary.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

import {
  EVENT_TYPES,
  SERVER_ONLY_EVENT_TYPES,
  analyticsRefSchema,
  analyticsSessionIdSchema,
} from "../src/lib/analytics";

const ALL = new Set<string>([...EVENT_TYPES, ...SERVER_ONLY_EVENT_TYPES]);

function grepTrackTypes(): string[] {
  const out = execSync(
    `grep -rhoE 'track\\(\\{[^}]*type: "[a-z_]+"' src --include="*.ts" --include="*.tsx" || true`,
    { cwd: process.cwd() },
  ).toString();
  return [...out.matchAll(/type: "([a-z_]+)"/g)].map((m) => m[1]);
}

function grepDashboardTypes(): string[] {
  const out = execSync(
    `grep -rhoE 'type: "[a-z_.]+"' src/app/api/admin/dashboard/route.ts src/app/api/stats/route.ts || true`,
    { cwd: process.cwd() },
  ).toString();
  return [...out.matchAll(/type: "([a-z_.]+)"/g)]
    .map((m) => m[1])
    .filter((t) => t.includes("_") || t.includes("."));
}

describe("émetteurs ⊆ dictionnaire", () => {
  test("chaque track() utilise un type catalogué", () => {
    const used = grepTrackTypes();
    assert.ok(used.length > 5, `assez d'appels pour être significatif (${used.length})`);
    for (const t of new Set(used)) {
      assert.ok(ALL.has(t), `type émis hors dictionnaire : ${t}`);
    }
  });
});

describe("dashboard ⊆ dictionnaire", () => {
  test("chaque type lu existe au catalogue", () => {
    const used = grepDashboardTypes().filter((t) => !t.startsWith("email."));
    for (const t of new Set(used)) {
      assert.ok(ALL.has(t), `type lu hors dictionnaire : ${t}`);
    }
  });
});

describe("garde anti-PII ref/sessionId", () => {
  test("légitimes acceptés", () => {
    for (const v of ["q-email", "hero", "community-join", "insufficient_data:local", "alerts=0", "s_abc123"]) {
      assert.ok(analyticsRefSchema.safeParse(v).success, v);
      assert.ok(analyticsSessionIdSchema.safeParse(v).success, v);
    }
  });

  test("PII-shaped rejetés (email, espaces, contrôles)", () => {
    for (const v of ["a@x.y", "Jean Dupont", "x\ny", "a b@c", "06 12 34 56 78"]) {
      assert.ok(!analyticsRefSchema.safeParse(v).success, `ref rejetée : ${JSON.stringify(v)}`);
      assert.ok(!analyticsSessionIdSchema.safeParse(v).success, `session rejetée : ${JSON.stringify(v)}`);
    }
  });
});
