/**
 * Tests unitaires — normalisation des événements Brevo.
 *
 * Régression : le handler comparait `hardBounce`/`clicked`/`invalid`/`sent`
 * alors que Brevo envoie `hard_bounce`/`click`/`invalid_email`/`request`.
 * Bounces et plaintes étaient donc ignorés silencieusement.
 *
 * Run: npx tsx --test tests/brevo-events.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { normalizeBrevoEvent } from "../src/lib/brevo-events";

const ROUTE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src/app/api/webhooks/brevo/route.ts",
);

describe("normalizeBrevoEvent — payloads réels Brevo (snake_case)", () => {
  test("événements d'envoi et d'engagement", () => {
    assert.equal(normalizeBrevoEvent("request"), "sent");
    assert.equal(normalizeBrevoEvent("delivered"), "delivered");
    assert.equal(normalizeBrevoEvent("opened"), "opened");
    assert.equal(normalizeBrevoEvent("unique_opened"), "opened");
    assert.equal(normalizeBrevoEvent("click"), "clicked");
    assert.equal(normalizeBrevoEvent("deferred"), "deferred");
  });

  test("bounces et erreurs", () => {
    assert.equal(normalizeBrevoEvent("hard_bounce"), "hardBounce");
    assert.equal(normalizeBrevoEvent("soft_bounce"), "softBounce");
    assert.equal(normalizeBrevoEvent("invalid_email"), "invalid");
    assert.equal(normalizeBrevoEvent("blocked"), "blocked");
    assert.equal(normalizeBrevoEvent("error"), "error");
  });

  test("plainte et désinscription", () => {
    assert.equal(normalizeBrevoEvent("spam"), "complaint");
    assert.equal(normalizeBrevoEvent("unsubscribe"), "unsubscribed");
  });
});

describe("normalizeBrevoEvent — alias internes (camelCase)", () => {
  test("les anciens noms restent acceptés", () => {
    assert.equal(normalizeBrevoEvent("sent"), "sent");
    assert.equal(normalizeBrevoEvent("delivered"), "delivered");
    assert.equal(normalizeBrevoEvent("opened"), "opened");
    assert.equal(normalizeBrevoEvent("clicked"), "clicked");
    assert.equal(normalizeBrevoEvent("softBounce"), "softBounce");
    assert.equal(normalizeBrevoEvent("hardBounce"), "hardBounce");
    assert.equal(normalizeBrevoEvent("invalid"), "invalid");
    assert.equal(normalizeBrevoEvent("deferred"), "deferred");
    assert.equal(normalizeBrevoEvent("complaint"), "complaint");
    assert.equal(normalizeBrevoEvent("unsubscribed"), "unsubscribed");
    assert.equal(normalizeBrevoEvent("blocked"), "blocked");
    assert.equal(normalizeBrevoEvent("error"), "error");
  });

  test("casse et espaces ignorés", () => {
    assert.equal(normalizeBrevoEvent("  HARD_BOUNCE  "), "hardBounce");
    assert.equal(normalizeBrevoEvent("HardBounce"), "hardBounce");
    assert.equal(normalizeBrevoEvent("CLICK"), "clicked");
  });
});

describe("normalizeBrevoEvent — événements ignorés ou inconnus", () => {
  test("ouvertures proxy (Apple MPP) ignorées", () => {
    assert.equal(normalizeBrevoEvent("proxy_open"), null);
    assert.equal(normalizeBrevoEvent("unique_proxy_open"), null);
  });

  test("événements marketing sans effet", () => {
    assert.equal(normalizeBrevoEvent("contact_deleted"), null);
    assert.equal(normalizeBrevoEvent("contact_updated"), null);
    assert.equal(normalizeBrevoEvent("contact_added_to_list"), null);
  });

  test("entrées invalides", () => {
    assert.equal(normalizeBrevoEvent(undefined), null);
    assert.equal(normalizeBrevoEvent(null), null);
    assert.equal(normalizeBrevoEvent(42), null);
    assert.equal(normalizeBrevoEvent({ event: "click" }), null);
    assert.equal(normalizeBrevoEvent(""), null);
    assert.equal(normalizeBrevoEvent("   "), null);
  });
});

describe("handler Brevo — câblage de la normalisation", () => {
  const src = readFileSync(ROUTE_PATH, "utf8");

  test("le handler passe par normalizeBrevoEvent avant le switch", () => {
    assert.match(src, /normalizeBrevoEvent\(payload\.event\)/);
    assert.match(src, /const event: BrevoWebhookEvent = \{ \.\.\.payload, event: eventType \}/);
  });

  test("un événement normalisé inconnu répond 200 sans écrire d'EmailEvent", () => {
    // Bloc d'ignorance : 200 + `ignored`, avant tout logEvent.
    assert.match(src, /return NextResponse\.json\(\{ ok: true, ignored: payload\.event \}\)/);
  });

  test("le handler ne compare plus les noms bruts Brevo (snake_case)", () => {
    assert.doesNotMatch(src, /payload\.event === "(hard_bounce|soft_bounce|invalid_email|click|request)"/);
  });
});
