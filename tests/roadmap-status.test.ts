/**
 * Roadmap pilotée données (#234) — dérivation pure.
 * Run: tsx --test tests/roadmap-status.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { deriveRoadmapLive } from "../src/lib/roadmap-status";

describe("deriveRoadmapLive : seule la vivacité est pilotée", () => {
  test("vide → tout éteint (jamais de promesse non sourcée)", () => {
    assert.deepEqual(deriveRoadmapLive({ missionsPublished: 0, workshopsPublished: 0 }), {
      challenges: false,
      workshops: false,
      projects: false,
      mentoring: false,
      registry: false,
    });
  });

  test("missions publiées → challenges vivant seul", () => {
    const r = deriveRoadmapLive({ missionsPublished: 2, workshopsPublished: 0 });
    assert.equal(r.challenges, true);
    assert.equal(r.workshops, false);
  });

  test("ateliers publiés → workshops vivant", () => {
    const r = deriveRoadmapLive({ missionsPublished: 0, workshopsPublished: 1 });
    assert.equal(r.challenges, false);
    assert.equal(r.workshops, true);
  });

  test("éditoriaux jamais vivants (pas de source)", () => {
    const r = deriveRoadmapLive({ missionsPublished: 9, workshopsPublished: 9 });
    assert.equal(r.projects, false);
    assert.equal(r.mentoring, false);
    assert.equal(r.registry, false);
  });
});
