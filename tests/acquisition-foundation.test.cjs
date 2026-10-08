/**
 * Acquisition Foundation (#210) — miroir pur, runner node --test.
 *
 * Run: node --test tests/acquisition-foundation.test.cjs
 *
 * Miroirs (logique pure re-implémentée — .cjs ne peut pas importer TS) :
 *  - normalizeSource from src/lib/acquisition.ts
 *  - normalizeConsentEmail / pickLatestConsent / CONSENT_PURPOSES /
 *    CONSENT_CHOICES from src/lib/consents.ts
 *  - isServerEventType / toServerEventData from src/lib/analytics.ts
 *    (listes EXTRAITES de la source : le test suit automatiquement
 *    l'allowlist ; si la source change, les extractions changent aussi
 *    et les invariants restent vérifiés).
 * Assertions sur texte source (fs, sans exécution) :
 *  - toute écriture serveur analytics passe par la validation
 *  - les 4 routes publiques d'acquisition ont Zod + bodyLimit +
 *    blockIfTesting + rate-limit
 *  - idempotence : pattern maison présent là où un double-submit
 *    créerait un doublon
 *  - aucune dépendance au schéma JoinHashCode externe
 *    (User/Profile/Path/Progress/Evidence/Mentoring — Better Auth
 *    User local OK)
 *  - aucun CJK dans les fichiers touchés
 */

"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** Extrait les littéraux "..." d'un `export const NAME = [...] as const`. */
function extractStringArray(src, constName) {
  const m = src.match(
    new RegExp("export const " + constName + " = \\[([\\s\\S]*?)\\] as const"),
  );
  assert.ok(m, constName + " introuvable dans src/lib/analytics.ts");
  return m[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
}

// ── Miroirs ───────────────────────────────────────────────────────

const SOURCE_ALIASES = {
  "": "direct",
  "(direct)": "direct",
  "(none)": "direct",
  "n/a": "direct",
  na: "direct",
  none: "direct",
  null: "direct",
  undefined: "direct",
  unknown: "direct",
};

function normalizeSource(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return "direct";
  return SOURCE_ALIASES[v] ?? v;
}

const ANONYMOUS_CONSENT_EMAIL = "anonymous";

function normalizeConsentEmail(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v || ANONYMOUS_CONSENT_EMAIL;
}

function pickLatestConsent(rows) {
  let latest = null;
  for (const r of rows) {
    if (!latest || new Date(r.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
      latest = r;
    }
  }
  return latest;
}

function toServerEventDataMirror(input, allowed) {
  if (!allowed.has(input.type)) {
    throw new Error("Unknown server analytics event type: " + input.type);
  }
  return {
    type: input.type,
    sessionId: input.sessionId ?? null,
    memberId: input.memberId ?? null,
    ref: input.ref ?? null,
    value: input.value ?? null,
  };
}

// ── Sources ───────────────────────────────────────────────────────

const analyticsSrc = read("src/lib/analytics.ts");
const EVENT_TYPES = extractStringArray(analyticsSrc, "EVENT_TYPES");
const SERVER_ONLY = extractStringArray(analyticsSrc, "SERVER_ONLY_EVENT_TYPES");
const SERVER_UNION = new Set([...EVENT_TYPES, ...SERVER_ONLY]);

// ── Tests ─────────────────────────────────────────────────────────

describe("normalizeSource (miroir src/lib/acquisition.ts)", () => {
  test("alias vides et variantes -> direct", () => {
    for (const raw of ["", "  ", "(direct)", "(none)", "n/a", "NA", "none", "NULL", "undefined", "unknown"]) {
      assert.equal(normalizeSource(raw), "direct", JSON.stringify(raw));
    }
    assert.equal(normalizeSource(null), "direct");
    assert.equal(normalizeSource(undefined), "direct");
    assert.equal(normalizeSource(42), "direct");
  });

  test("lowercase + trim, valeurs réelles conservées", () => {
    assert.equal(normalizeSource("  WhatsApp/Post?reboot  "), "whatsapp/post?reboot");
    assert.equal(normalizeSource("UTM_SOURCE"), "utm_source");
  });

  test("parité source : les alias existent dans src/lib/acquisition.ts", () => {
    const src = read("src/lib/acquisition.ts");
    for (const alias of Object.keys(SOURCE_ALIASES)) {
      assert.ok(src.includes('"' + alias + '"'), "alias manquant en source : " + alias);
    }
  });
});

describe("consents (miroir src/lib/consents.ts)", () => {
  test("normalizeConsentEmail : vide -> anonymous, trim + lowercase", () => {
    assert.equal(normalizeConsentEmail(""), "anonymous");
    assert.equal(normalizeConsentEmail(undefined), "anonymous");
    assert.equal(normalizeConsentEmail(null), "anonymous");
    assert.equal(normalizeConsentEmail("  Awa@Example.COM "), "awa@example.com");
  });

  test("pickLatestConsent : dernier createdAt gagne (append-only)", () => {
    const rows = [
      { email: "a@x.y", purpose: "cookies", createdAt: "2026-01-01T00:00:00.000Z" },
      { email: "a@x.y", purpose: "cookies", createdAt: "2026-02-01T00:00:00.000Z" },
    ];
    assert.equal(pickLatestConsent(rows), rows[1]);
    assert.equal(pickLatestConsent([]), null);
  });

  test("parité source : purposes, choices, marqueur anonyme", () => {
    const src = read("src/lib/consents.ts");
    for (const p of ["cookies", "contact", "profiling"]) {
      assert.ok(src.includes('"' + p + '"'), "purpose manquant : " + p);
    }
    for (const c of ["granted", "withdrawn"]) {
      assert.ok(src.includes('"' + c + '"'), "choice manquant : " + c);
    }
    assert.ok(src.includes('"anonymous"'), "marqueur anonymous manquant");
    assert.ok(src.includes("pickLatestConsent"), "pickLatestConsent manquant");
  });
});

describe("allowlist analytics (extraite de src/lib/analytics.ts)", () => {
  test("EVENT_TYPES couvre le funnel public + acquisition", () => {
    for (const t of [
      "reboot_page_view",
      "reboot_cta_clicked",
      "profiling_started",
      "profiling_completed",
      "profil_generated",
      "whatsapp_join_clicked",
      "community_cta_clicked",
      "status_change_email_sent",
      "event_interest",
      "event_rsvp",
    ]) {
      assert.ok(EVENT_TYPES.includes(t), "type public manquant : " + t);
    }
  });

  test("SERVER_ONLY couvre les écritures serveur réelles", () => {
    for (const t of [
      "admin_invite",
      "profile_completed_by_member",
      "onboarding_email_budget_blocked",
      "admin_import",
      "admin_bulk_action",
      "admin_member_update",
      "cron_relance",
      "cron_event_reminders",
    ]) {
      assert.ok(SERVER_ONLY.includes(t), "type serveur manquant : " + t);
    }
  });

  test("listes disjointes, union sans doublon", () => {
    const overlap = EVENT_TYPES.filter((t) => SERVER_ONLY.includes(t));
    assert.deepEqual(overlap, []);
    assert.equal(SERVER_UNION.size, EVENT_TYPES.length + SERVER_ONLY.length);
  });

  test("toServerEventData (miroir) : valide normalisé, inconnu rejeté", () => {
    assert.deepEqual(
      toServerEventDataMirror({ type: "admin_invite", memberId: "m1" }, SERVER_UNION),
      { type: "admin_invite", sessionId: null, memberId: "m1", ref: null, value: null },
    );
    assert.throws(
      () => toServerEventDataMirror({ type: "rogue_type" }, SERVER_UNION),
      /Unknown server analytics event type/,
    );
  });

  test("source expose isServerEventType + toServerEventData avec garde", () => {
    assert.ok(analyticsSrc.includes("export function isServerEventType"));
    assert.ok(analyticsSrc.includes("export function toServerEventData"));
    assert.ok(analyticsSrc.includes("Unknown server analytics event type"));
  });

  test("toute écriture serveur utilise un type de l'union validée", () => {
    const files = walk(path.join(ROOT, "src"), []);
    const unknown = [];
    const unvalidated = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      if (!src.includes("db.analyticsEvent.create")) continue;
      if (f.endsWith("src/app/api/analytics/route.ts")) {
        // Route publique : validée par z.enum(EVENT_TYPES), pas de littéral.
        assert.ok(src.includes("z.enum(EVENT_TYPES)"), "POST /api/analytics sans z.enum");
        continue;
      }
      // Chaque site doit passer par le validateur.
      const sites = src.split("db.analyticsEvent.create").slice(1);
      for (const site of sites) {
        const window = site.slice(0, 600);
        const lit = window.match(/type:\s*(d\.type|"[^"]+")/);
        assert.ok(lit, "type introuvable près d'un create : " + f);
        if (lit[1] === "d.type") continue; // déjà validé par Zod en amont
        if (!window.includes("toServerEventData")) {
          unvalidated.push(f + " :: " + lit[1]);
        }
        const t = lit[1].slice(1, -1);
        if (!SERVER_UNION.has(t)) unknown.push(f + " :: " + t);
      }
    }
    assert.deepEqual(unvalidated, [], "écritures non validées");
    assert.deepEqual(unknown, [], "types hors union");
  });
});

describe("gardes des écritures publiques d'acquisition", () => {
  const routes = [
    "src/app/api/members/route.ts",
    "src/app/api/consents/route.ts",
    "src/app/api/profiling/draft/route.ts",
    "src/app/api/account/phone/route.ts",
  ];
  for (const r of routes) {
    test(r + " : Zod + bodyLimit + blockIfTesting + rateLimit", () => {
      const src = read(r);
      // Zod direct (z.object/...) ou schéma partagé (consentBodySchema, ...).
      assert.ok(/z\.|Schema/.test(src) && src.includes("safeParse"), r + " sans schéma Zod");
      assert.ok(src.includes("bodyLimit"), r + " sans bodyLimit");
      assert.ok(src.includes("blockIfTesting"), r + " sans blockIfTesting");
      assert.ok(src.includes("rateLimit"), r + " sans rateLimit");
    });
  }
});

describe("idempotence (pattern maison, rien de générique)", () => {
  test("members POST : pré-check email + course P2002 -> 200 duplicate", () => {
    const src = read("src/app/api/members/route.ts");
    assert.ok(src.includes("findUnique"), "pré-check findUnique manquant");
    assert.ok(src.includes("P2002"), "garde course P2002 manquante");
    assert.ok(src.includes("duplicate"), "forme duplicate manquante");
  });

  test("draft : upsert where email (rejouable sans doublon)", () => {
    const src = read("src/app/api/profiling/draft/route.ts");
    assert.ok(src.includes("profilingDraft.upsert"), "upsert manquant");
    assert.ok(src.includes("where: { email: emailLower }"), "clé upsert email manquante");
  });

  test("phone : remplissage unique, jamais d'écrasement", () => {
    const src = read("src/app/api/account/phone/route.ts");
    assert.ok(src.includes("!member.phone"), "garde fill-once manquante");
    assert.ok(src.includes("verifyPhoneFillTicket"), "ticket HMAC manquant");
  });

  test("consents : append-only, lecture = dernière ligne", () => {
    const src = read("src/app/api/consents/route.ts");
    assert.ok(src.includes("consent.create"), "create manquant");
    assert.ok(!src.includes("consent.update"), "update interdit (append-only)");
    assert.ok(!src.includes("consent.upsert"), "upsert interdit (append-only)");
    assert.ok(src.includes('orderBy: { createdAt: "desc" }'), "lecture latest manquante");
  });

  test("lots : anti-doublon MemberEmailLog avant/après envoi", () => {
    const src = read("src/lib/member-email-log.ts");
    assert.ok(src.includes("memberIdsWithEmailLog"), "exclusion préalable manquante");
    assert.ok(src.includes("logMemberEmail"), "journalisation manquante");
  });
});

describe("statuts acquisition (schéma)", () => {
  test("statuts et défauts conformes au contrat", () => {
    const schema = read("prisma/schema.prisma");
    assert.ok(schema.includes('profileStatus   String @default("PENDING")'));
    assert.ok(schema.includes('communityStatus String @default("NOT_INVITED")'));
    assert.ok(schema.includes('invitationStatus String    @default("NOT_INVITED")'));
    assert.ok(schema.includes("email     String  @unique"));
    assert.ok(schema.includes("email          String    @unique"));
  });
});

describe("non-dépendance au schéma JoinHashCode externe", () => {
  const scope = [
    "src/lib/analytics.ts",
    "src/lib/acquisition.ts",
    "src/lib/consents.ts",
    "src/lib/member-email-log.ts",
    "src/app/api/members/route.ts",
    "src/app/api/consents/route.ts",
    "src/app/api/profiling/draft/route.ts",
    "src/app/api/account/phone/route.ts",
    "src/app/api/account/complete-profile/route.ts",
    "src/app/api/community/join/route.ts",
  ];
  test("aucune référence User/Profile/Path/Progress/Evidence/Mentoring externe", () => {
    const bad = [];
    const re = /db\.(user|profile|path|progress|evidence|mentoring|mentorship|workshop)\b/;
    for (const f of scope) {
      if (re.test(read(f))) bad.push(f);
    }
    assert.deepEqual(bad, [], "références externes JoinHashCode");
  });

  test("schéma : pas de modèle Profile/Path/Progress/Evidence externe ; User local = Better Auth", () => {
    const schema = read("prisma/schema.prisma");
    for (const m of ["model Profile ", "model Path ", "model Progress ", "model Evidence "]) {
      assert.ok(!schema.includes(m), "modèle externe inattendu : " + m);
    }
    assert.ok(schema.includes("model User {"), "model User Better Auth attendu");
    assert.ok(schema.includes("Better Auth"), "contexte Better Auth attendu");
  });
});

describe("hygiène fichiers touchés", () => {
  test("aucun CJK", () => {
    const files = [
      "src/lib/analytics.ts",
      "src/lib/onboarding-emails.ts",
      "src/app/api/members/route.ts",
      "src/app/api/members/import/route.ts",
      "src/app/api/members/bulk/route.ts",
      "src/app/api/members/[id]/route.ts",
      "src/app/api/members/[id]/invite/route.ts",
      "src/app/api/consents/route.ts",
      "src/app/api/profiling/draft/route.ts",
      "src/app/api/account/phone/route.ts",
      "src/app/api/account/complete-profile/route.ts",
      "src/app/api/community/join/route.ts",
      "src/app/api/invite/relance/route.ts",
      "src/app/api/export/route.ts",
      "src/app/api/export/json/route.ts",
      "src/app/api/admin/announce-dashboard/route.ts",
      "src/app/api/admin/import-invite/route.ts",
      "src/app/api/admin/logout/route.ts",
      "src/app/api/cron/relance/route.ts",
      "src/app/api/cron/collect-metrics/route.ts",
      "src/app/api/cron/activation-relance/route.ts",
      "src/app/api/cron/admin-alerts/route.ts",
      "src/app/api/cron/email-alerts/route.ts",
      "src/app/api/cron/event-reminders/route.ts",
      "docs/acquisition-contracts.md",
      "tests/acquisition-foundation.test.cjs",
    ];
    const bad = files.filter((f) => /[\u3000-\u9FFF]/.test(read(f)));
    assert.deepEqual(bad, [], "CJK détecté");
  });
});
