/**
 * Unit tests — pipeline onboarding par etape (#106).
 * No server required, runs in < 1 second.
 *
 * Run:  node --test tests/pipeline-stage.test.cjs
 *
 * Mirrors (re-implemented pure logic — .cjs can't import TS):
 *  - stage filter in src/app/api/members/route.ts (GET liste, ?stage=) :
 *    pending -> {profileStatus:PENDING, deletedAt:null},
 *    approved -> {profileStatus:APPROVED, deletedAt:null},
 *    invited -> {communityStatus:INVITED, deletedAt:null},
 *    active -> {communityStatus:JOINED, deletedAt:null},
 *    absent/vide -> {deletedAt:null} sans etape, invalide -> 422.
 *  - Compteurs PipelineStages.tsx : GET /api/members?stage=<s>&pageSize=1,
 *    total lu sur le champ `total` de la reponse.
 * If the sources change, update the mirrors below accordingly.
 *
 * Coverage:
 *  - mapping: 4 etapes, absent/vide ignore, invalide rejete (422),
 *    accessLane jamais utilise, WAITLIST/REJECTED hors funnel
 *  - compteurs: extraction du total, URL par etape, reponse sans total rejetee
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── Mirror of the ?stage= filter (src/app/api/members/route.ts GET) ──

const STAGE_WHERE = {
  pending: { profileStatus: "PENDING" },
  approved: { profileStatus: "APPROVED" },
  invited: { communityStatus: "INVITED" },
  active: { communityStatus: "JOINED" },
};

function buildStageWhere(stageParam) {
  const where = { deletedAt: null };
  if (stageParam === null || stageParam === undefined || stageParam === "") {
    return where;
  }
  const clause = STAGE_WHERE[stageParam];
  if (!clause) {
    const err = new Error(
      "stage invalide : pending|approved|invited|active attendu.",
    );
    err.status = 422;
    err.code = "INVALID_PAYLOAD";
    throw err;
  }
  return { ...where, ...clause };
}

// ── Mirror of the counters (PipelineStages.tsx) ──

function stageCountUrl(stage) {
  return `/api/members?stage=${stage}&pageSize=1`;
}

function extractTotal(data) {
  if (!data || typeof data.total !== "number") {
    throw new Error("counts failed");
  }
  return data.total;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("?stage= mapping", () => {
  test("pending -> {profileStatus:PENDING} + {deletedAt:null}", () => {
    assert.deepEqual(buildStageWhere("pending"), {
      deletedAt: null,
      profileStatus: "PENDING",
    });
  });

  test("approved -> {profileStatus:APPROVED} + {deletedAt:null}", () => {
    assert.deepEqual(buildStageWhere("approved"), {
      deletedAt: null,
      profileStatus: "APPROVED",
    });
  });

  test("invited -> {communityStatus:INVITED} + {deletedAt:null}", () => {
    assert.deepEqual(buildStageWhere("invited"), {
      deletedAt: null,
      communityStatus: "INVITED",
    });
  });

  test("active -> {communityStatus:JOINED} + {deletedAt:null}", () => {
    assert.deepEqual(buildStageWhere("active"), {
      deletedAt: null,
      communityStatus: "JOINED",
    });
  });

  test("absent / vide -> pas de filtre etape, deletedAt:null conserve", () => {
    assert.deepEqual(buildStageWhere(null), { deletedAt: null });
    assert.deepEqual(buildStageWhere(undefined), { deletedAt: null });
    assert.deepEqual(buildStageWhere(""), { deletedAt: null });
  });

  test("valeur invalide -> 422 INVALID_PAYLOAD", () => {
    for (const bad of ["waitlist", "rejected", "all", "PENDING", "joined", "lane"]) {
      assert.throws(() => buildStageWhere(bad), (e) => {
        assert.equal(e.status, 422);
        assert.equal(e.code, "INVALID_PAYLOAD");
        return true;
      }, `stage=${bad} doit etre rejete en 422`);
    }
  });

  test("WAITLIST/REJECTED hors funnel (pas de mapping)", () => {
    assert.ok(!("waitlist" in STAGE_WHERE));
    assert.ok(!("rejected" in STAGE_WHERE));
  });

  test("accessLane jamais utilise comme etape", () => {
    for (const s of Object.keys(STAGE_WHERE)) {
      assert.ok(!("accessLane" in buildStageWhere(s)), s);
    }
  });
});

describe("compteurs pipeline", () => {
  test("URL par etape : pageSize=1", () => {
    for (const s of ["pending", "approved", "invited", "active"]) {
      assert.equal(stageCountUrl(s), `/api/members?stage=${s}&pageSize=1`);
    }
  });

  test("extraction du total (champ total)", () => {
    assert.equal(extractTotal({ total: 12 }), 12);
    assert.equal(extractTotal({ total: 0 }), 0);
  });

  test("reponse sans total numerique rejetee", () => {
    assert.throws(() => extractTotal({}), /counts failed/);
    assert.throws(() => extractTotal({ total: "12" }), /counts failed/);
    assert.throws(() => extractTotal(null), /counts failed/);
  });
});
