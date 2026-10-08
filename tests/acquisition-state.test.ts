/**
 * Machine à états session d'acquisition (#158).
 *
 * Contrairement aux tests `.cjs` miroirs du dépôt (logique réimplémentée),
 * ces tests importent le VRAI code TS via tsx : ils vérifient réellement
 * deriveState × canTransition, sans risque de dérive miroir.
 *
 * Run: tsx --test tests/acquisition-state.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ACQUISITION_STATES,
  TERMINAL_STATES,
  canTransition,
  deriveState,
  profileStatusToState,
  type AcquisitionState,
} from "../src/lib/acquisition-state";

// ── deriveState : table d'états ─────────────────────────────────────

describe("deriveState — socle (aucune preuve → VISITOR)", () => {
  test("entrée vide → VISITOR", () => {
    assert.equal(deriveState({}), "VISITOR");
    assert.equal(
      deriveState({ member: null, draft: null, analytics: [] }),
      "VISITOR",
    );
  });

  test("consent seul (bandeau cookies pré-inscription) → SESSION_STARTED", () => {
    assert.equal(
      deriveState({ consent: { choice: "granted" } }),
      "SESSION_STARTED",
    );
  });

  test("analytics page view seule → SESSION_STARTED", () => {
    assert.equal(
      deriveState({ analytics: [{ type: "reboot_page_view" }] }),
      "SESSION_STARTED",
    );
  });
});

describe("deriveState — diagnostic et capture", () => {
  test("profiling_started → DIAGNOSTIC", () => {
    assert.equal(
      deriveState({ analytics: [{ type: "profiling_started" }] }),
      "DIAGNOSTIC",
    );
  });

  test("brouillon abandonné (sans completedAt, relance envoyée ou non) → DIAGNOSTIC", () => {
    assert.equal(
      deriveState({ draft: { completedAt: null, relanceSentAt: null } }),
      "DIAGNOSTIC",
    );
    assert.equal(
      deriveState({
        draft: {
          completedAt: null,
          relanceSentAt: "2026-09-01T00:00:00.000Z",
        },
      }),
      "DIAGNOSTIC",
    );
  });

  test("Member PENDING existant → LEAD_CAPTURED (prime sur le brouillon)", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "PENDING" },
        draft: { completedAt: null, relanceSentAt: null },
      }),
      "LEAD_CAPTURED",
    );
  });

  test("WAITLIST → LEAD_CAPTURED (capturé, en attente de triage)", () => {
    assert.equal(
      deriveState({ member: { profileStatus: "WAITLIST" } }),
      "LEAD_CAPTURED",
    );
  });

  test("draft completedAt (preuve aveugle) sans Member → LEAD_CAPTURED", () => {
    assert.equal(
      deriveState({ draft: { completedAt: new Date() } }),
      "LEAD_CAPTURED",
    );
  });

  test("profil_generated sans Member → LEAD_CAPTURED", () => {
    assert.equal(
      deriveState({ analytics: [{ type: "profil_generated" }] }),
      "LEAD_CAPTURED",
    );
  });
});

describe("deriveState — qualification (snapshot acq-*)", () => {
  test("statut qualification reflété tel quel", () => {
    assert.equal(
      deriveState({ qualification: { status: "QUALIFIED" } }),
      "QUALIFIED",
    );
    assert.equal(
      deriveState({ qualification: { status: "DISQUALIFIED" } }),
      "DISQUALIFIED",
    );
    assert.equal(
      deriveState({ qualification: { status: "INSUFFICIENT_DATA" } }),
      "INSUFFICIENT_DATA",
    );
  });

  test("ligne orientation (status NULL) ignorée → retombe sur la capture", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "PENDING" },
        qualification: { status: null },
      }),
      "LEAD_CAPTURED",
    );
  });

  test("REJECTED prime sur un snapshot QUALIFIED (décision humaine)", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "REJECTED" },
        qualification: { status: "QUALIFIED" },
      }),
      "DISQUALIFIED",
    );
  });
});

describe("deriveState — conversion, handoff, bounce", () => {
  test("APPROVED → CONVERSION (prime sur la qualification)", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "APPROVED" },
        qualification: { status: "INSUFFICIENT_DATA" },
      }),
      "CONVERSION",
    );
  });

  test("JOINED → HANDOFF (prime sur APPROVED)", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "APPROVED", communityStatus: "JOINED" },
      }),
      "HANDOFF",
    );
  });

  test("EXPIRED → HANDOFF_FAILED", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "PENDING", invitationStatus: "EXPIRED" },
      }),
      "HANDOFF_FAILED",
    );
  });

  test("BOUNCED terminal : prime sur JOINED + APPROVED", () => {
    assert.equal(
      deriveState({
        member: {
          profileStatus: "APPROVED",
          communityStatus: "JOINED",
          invitationStatus: "BOUNCED",
        },
      }),
      "BOUNCED",
    );
  });
});

describe("deriveState — accept/refuse inertes (hors machine)", () => {
  test("ACCEPTED sans jonction → pas d'état dédié (retombe capture)", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "PENDING", invitationStatus: "ACCEPTED" },
      }),
      "LEAD_CAPTURED",
    );
  });

  test("REFUSED → pas d'état dédié (retombe capture)", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "PENDING", invitationStatus: "REFUSED" },
      }),
      "LEAD_CAPTURED",
    );
  });

  test("INVITED seul (sans APPROVED) → pas d'état dédié", () => {
    assert.equal(
      deriveState({
        member: { profileStatus: "PENDING", invitationStatus: "INVITED" },
      }),
      "LEAD_CAPTURED",
    );
  });
});

// ── canTransition ───────────────────────────────────────────────────

describe("canTransition — chaîne nominale et idempotence", () => {
  test("tout état boucle sur lui-même (rejouable)", () => {
    for (const s of ACQUISITION_STATES) {
      assert.equal(canTransition(s, s), true, s);
    }
  });

  test("chaîne avant VISITOR → … → HANDOFF", () => {
    const chain: AcquisitionState[] = [
      "VISITOR",
      "SESSION_STARTED",
      "DIAGNOSTIC",
      "LEAD_CAPTURED",
      "QUALIFIED",
      "CONVERSION",
      "HANDOFF",
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      assert.equal(canTransition(chain[i], chain[i + 1]), true);
    }
  });

  test("overrides admin : fast-track et repêchage", () => {
    assert.equal(canTransition("LEAD_CAPTURED", "CONVERSION"), true);
    assert.equal(canTransition("DISQUALIFIED", "CONVERSION"), true);
    assert.equal(canTransition("INSUFFICIENT_DATA", "CONVERSION"), true);
    assert.equal(canTransition("CONVERSION", "DISQUALIFIED"), true);
    assert.equal(canTransition("CONVERSION", "LEAD_CAPTURED"), true);
    assert.equal(canTransition("HANDOFF_FAILED", "CONVERSION"), true);
    assert.equal(canTransition("HANDOFF_FAILED", "HANDOFF"), true);
  });

  test("retours incohérents refusés", () => {
    assert.equal(canTransition("LEAD_CAPTURED", "VISITOR"), false);
    assert.equal(canTransition("LEAD_CAPTURED", "SESSION_STARTED"), false);
    assert.equal(canTransition("LEAD_CAPTURED", "DIAGNOSTIC"), false);
    assert.equal(canTransition("QUALIFIED", "LEAD_CAPTURED"), false);
    assert.equal(canTransition("CONVERSION", "DIAGNOSTIC"), false);
    assert.equal(canTransition("CONVERSION", "QUALIFIED"), false);
    assert.equal(canTransition("SESSION_STARTED", "LEAD_CAPTURED"), false);
  });
});

describe("canTransition — terminaux", () => {
  test("BOUNCED : rien n'en sort", () => {
    for (const s of ACQUISITION_STATES) {
      if (s === "BOUNCED") continue;
      assert.equal(canTransition("BOUNCED", s), false, `BOUNCED → ${s}`);
    }
  });

  test("BOUNCED : cible depuis tout état non terminal (webhook)", () => {
    for (const s of ACQUISITION_STATES) {
      if (s === "BOUNCED" || s === "HANDOFF") continue;
      assert.equal(canTransition(s, "BOUNCED"), true, `${s} → BOUNCED`);
    }
    assert.equal(canTransition("HANDOFF", "BOUNCED"), false);
  });

  test("HANDOFF : rien n'en sort (sauf soi-même)", () => {
    for (const s of ACQUISITION_STATES) {
      if (s === "HANDOFF") continue;
      assert.equal(canTransition("HANDOFF", s), false, `HANDOFF → ${s}`);
    }
  });

  test("aucun état accept/refuse dans l'union (hors machine)", () => {
    const names = [...ACQUISITION_STATES];
    assert.ok(!names.includes("ACCEPTED" as AcquisitionState));
    assert.ok(!names.includes("REFUSED" as AcquisitionState));
    assert.deepEqual(TERMINAL_STATES, ["BOUNCED", "HANDOFF"]);
  });
});

// ── profileStatusToState ────────────────────────────────────────────

describe("profileStatusToState — projection garde admin", () => {
  test("APPROVED → CONVERSION, REJECTED → DISQUALIFIED", () => {
    assert.equal(profileStatusToState("APPROVED"), "CONVERSION");
    assert.equal(profileStatusToState("REJECTED"), "DISQUALIFIED");
  });

  test("PENDING / WAITLIST → LEAD_CAPTURED (repli sûr)", () => {
    assert.equal(profileStatusToState("PENDING"), "LEAD_CAPTURED");
    assert.equal(profileStatusToState("WAITLIST"), "LEAD_CAPTURED");
    assert.equal(profileStatusToState("???"), "LEAD_CAPTURED");
  });
});

// ── Câblage (assertions sur texte source, sans exécution) ───────────

const ROOT = path.join(__dirname, "..");
const read = (p: string): string =>
  fs.readFileSync(path.join(ROOT, p), "utf8");

describe("câblage #158 — gardes et preuves", () => {
  test("PATCH /api/members/[id] garde via canTransition + ValidationError", () => {
    const src = read("src/app/api/members/[id]/route.ts");
    assert.ok(src.includes("canTransition"));
    assert.ok(src.includes("deriveState"));
    assert.ok(src.includes("profileStatusToState"));
    assert.ok(src.includes("Transition de statut illégale"));
  });

  test("POST /api/members/bulk garde approve/waitlist/reject (mappings inchangés)", () => {
    const src = read("src/app/api/members/bulk/route.ts");
    assert.ok(src.includes("canTransition"));
    for (const a of ['"approve"', '"invite"', '"waitlist"', '"reject"']) {
      assert.ok(src.includes(a), `action ${a} manquante`);
    }
    assert.ok(src.includes('data.profileStatus = "APPROVED"'));
    assert.ok(src.includes('data.profileStatus = "WAITLIST"'));
    assert.ok(src.includes('data.profileStatus = "REJECTED"'));
  });

  test("complétions écrivent ProfilingDraft.completedAt (best-effort)", () => {
    for (const f of [
      "src/app/api/members/route.ts",
      "src/app/api/account/complete-profile/route.ts",
    ]) {
      assert.ok(f && read(f).includes("completedAt"), f);
    }
  });

  test("aucune migration, aucune écriture BOUNCED hors webhook", () => {
    const lib = read("src/lib/acquisition-state.ts");
    assert.ok(!lib.includes("prisma"));
    assert.ok(!lib.includes("db."));
    // Le commentaire pré-existant de bulk ("Ne pas écraser
    // ACCEPTED/REFUSED/BOUNCED/EXPIRED") mentionne BOUNCED en lecture :
    // on n'interdit que les ÉCRITURES (littéral entre guillemets).
    const patch = read("src/app/api/members/[id]/route.ts");
    const bulk = read("src/app/api/members/bulk/route.ts");
    assert.ok(!patch.includes('"BOUNCED"'));
    assert.ok(!bulk.includes('"BOUNCED"'));
  });

  test("aucun CJK dans les fichiers touchés (plage U+3000-U+9FFF)", () => {
    const files = [
      "src/lib/acquisition-state.ts",
      "src/app/api/members/[id]/route.ts",
      "src/app/api/members/bulk/route.ts",
      "src/app/api/members/route.ts",
      "src/app/api/account/complete-profile/route.ts",
      "tests/acquisition-state.test.ts",
      "tests/profiling.test.cjs",
    ];
    const CJK = new RegExp("[\\u3000-\\u9FFF]");
    const bad = files.filter((f) => CJK.test(read(f)));
    assert.deepEqual(bad, [], "CJK détecté");
  });
});
