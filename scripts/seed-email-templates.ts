#!/usr/bin/env node
/**
 * Seed des templates d'email depuis le code RÉEL (src/lib/mail.ts).
 *
 * Principe : on n'écrit aucun contenu à la main. On appelle chaque fonction
 * d'envoi avec des valeurs-jetons uniques, en interceptant `fetch` pour
 * capturer le HTML réellement produit, puis on remplace les jetons par
 * `{{variable}}`. Le HTML stocké est donc, par construction, identique à
 * l'email envoyé aujourd'hui.
 *
 * Le script VÉRIFIE ensuite sa propre fidélité : il re-rend chaque template
 * avec les mêmes valeurs et compare au HTML capturé, octet par octet.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/seed-email-templates.ts
 *   node --env-file=.env --import tsx scripts/seed-email-templates.ts --force
 *
 * Sans `--force`, les templates déjà en base ne sont PAS réécrits (les
 * modifications faites dans l'admin sont préservées) : seuls les manquants sont
 * créés.
 *
 * Les templates verrouillés (catégories `notification` / `code`) sont stockés
 * avec des valeurs d'exemple figées : ils ne servent qu'à l'aperçu, jamais à
 * l'envoi.
 */

import { PrismaClient } from "@prisma/client";
import {
  SEED_BASE,
  SEED_FIRST_NAME,
  TEMPLATE_REGISTRY,
  sampleValues,
} from "@/lib/email-templates/registry";
import { encodeFromSample, renderEmailTemplate } from "@/lib/email-templates/render";

const FORCE = process.argv.includes("--force");
const SEED_TO = "zzseed@example.test";
/** Base réelle utilisée pour les templates verrouillés (aperçu réaliste). */
const REAL_SITE_URL = "https://joinhashcode.com";

// ── 1) Interception réseau : on capture sans rien envoyer ─────────────────
interface Capture {
  subject: string;
  html: string;
  to: string;
}
let captures: Capture[] = [];

function installFetchMock() {
  const g = globalThis as unknown as { fetch: unknown };
  g.fetch = async (_url: unknown, init?: { body?: unknown }) => {
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const html = String(body.htmlContent ?? body.html ?? "");
      const subject = String(body.subject ?? "");
      const to = Array.isArray(body.to)
        ? String(body.to[0]?.email ?? body.to[0] ?? "")
        : String(body.to ?? "");
      if (html) captures.push({ subject, html, to });
    } catch {
      /* un corps illisible ne doit pas casser le seed */
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "zzseed-message-id" }),
      text: async () => "",
      headers: new Headers(),
    };
  };
}

// ── 2) Découpage coquille / corps ────────────────────────────────────────
// Repères structurels de emailShell() — le corps est le fragment `inner`.
const HEADER_END = "</table></td></tr>";
const FOOTER_START = '<tr><td style="padding:0 32px 28px 32px;background-color:#141414;">';
const PREHEADER_OPEN =
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">';

function splitShell(html: string, subject: string): { preheader: string; inner: string } {
  const headerEnd = html.indexOf(HEADER_END);
  const footerStart = html.indexOf(FOOTER_START);
  if (headerEnd < 0 || footerStart < 0 || footerStart <= headerEnd) {
    throw new Error("Structure d'email inattendue : repères de coquille introuvables.");
  }
  const inner = html.slice(headerEnd + HEADER_END.length, footerStart);

  const phStart = html.indexOf(PREHEADER_OPEN);
  let preheader = "";
  if (phStart >= 0) {
    const after = html.slice(phStart + PREHEADER_OPEN.length);
    const end = after.indexOf("</div>");
    preheader = end >= 0 ? after.slice(0, end) : "";
  }
  // Certains templates passent le sujet comme preheader : on garde tel quel.
  if (!preheader) preheader = subject;
  return { preheader, inner };
}

/** Garde-fou : chaque variable déclarée doit être réellement présente. */
function assertAllVariablesUsed(
  def: { key: string; variables: Array<{ key: string; sample: string }> },
  rendered: string,
) {
  const missing = def.variables.filter((v) => !rendered.includes(v.sample));
  if (missing.length > 0) {
    throw new Error(
      `[${def.key}] variables déclarées mais absentes du rendu : ` +
        missing.map((v) => `${v.key} (${v.sample})`).join(", "),
    );
  }
}

// ── 3) Arguments d'exemple par template ──────────────────────────────────
type MailModule = typeof import("@/lib/mail");

function buildSampleCall(
  key: string,
  mail: MailModule,
  def: (typeof TEMPLATE_REGISTRY)[number],
): () => Promise<unknown> {
  if (def.category === "marketing") {
    const v = sampleValues(def);
    switch (key) {
      case "welcome":
        return () => mail.sendWelcomeEmail({ to: SEED_TO, firstName: v.firstName, archetype: v.archetype });
      case "invitation":
        return () => mail.sendInvitationEmail({ to: SEED_TO, firstName: v.firstName, dashboardUrl: v.dashboardUrl });
      case "waitlist":
        return () => mail.sendWaitlistEmail({ to: SEED_TO, firstName: v.firstName });
      case "engagement":
        return () => mail.sendEngagementEmail({ to: SEED_TO, firstName: v.firstName });
      case "relance":
        return () => mail.sendRelanceEmail({ to: SEED_TO, firstName: v.firstName });
      case "dashboard_invite":
        return () => mail.sendDashboardInviteEmail({ to: SEED_TO, firstName: v.firstName, url: v.url });
      case "rejoin":
        return () => mail.sendRejoinEmail({ to: SEED_TO, firstName: v.firstName, url: v.url });
      case "invitation_actions":
        return () =>
          mail.sendInvitationWithActions({
            to: SEED_TO,
            firstName: v.firstName,
            acceptUrl: v.acceptUrl,
            refuseUrl: v.refuseUrl,
          });
      case "invite_relance":
        return () => mail.sendInviteRelanceEmail({ to: SEED_TO, firstName: v.firstName, acceptUrl: v.acceptUrl });
      default:
        throw new Error(`Aucun appel d'exemple pour ${key}`);
    }
  }

  // Templates verrouillés : valeurs lisibles, stockées telles quelles (aperçu).
  const name = "Awa";
  const eventPayload = {
    title: "Atelier Web : premier composant",
    description: "Session pratique, en ligne.",
    startsAt: new Date("2030-03-12T18:00:00.000Z"),
    endsAt: new Date("2030-03-12T19:30:00.000Z"),
    location: "En ligne",
    type: "workshop",
    domain: "web",
    level: "beginner",
  };
  switch (key) {
    case "status_change_approved":
      return () => mail.sendStatusChangeEmail({ to: SEED_TO, firstName: name, newStatus: "APPROVED", archetypeLabel: "Builder Nocturne" });
    case "status_change_waitlist":
      return () => mail.sendStatusChangeEmail({ to: SEED_TO, firstName: name, newStatus: "WAITLIST" });
    case "status_change_rejected":
      return () => mail.sendStatusChangeEmail({ to: SEED_TO, firstName: name, newStatus: "REJECTED" });
    case "verification_link":
      return () => mail.sendVerificationLinkEmail({ to: SEED_TO, firstName: name, url: "https://joinhashcode.com/verify?t=8f3c2a" });
    case "magic_link":
      return () => mail.sendMagicLinkEmail({ to: SEED_TO, firstName: name, code: "135790", url: "https://joinhashcode.com/login?t=8f3c2a" });
    case "accept_notification":
      return () => mail.sendAcceptNotificationEmail({ adminEmail: SEED_TO, memberName: name, memberEmail: "awa@example.com" });
    case "refuse_notification":
      return () => mail.sendRefuseNotificationEmail({ adminEmail: SEED_TO, memberName: name, memberEmail: "awa@example.com", reason: "Indisponible cette saison" });
    case "bounced_alert":
      return () => mail.sendBouncedNotificationEmail({ adminEmail: SEED_TO, memberEmail: "awa@example.com" });
    case "event_notification":
      return () => mail.sendEventNotificationEmail({ to: SEED_TO, firstName: name, event: eventPayload, rsvpUrl: "https://joinhashcode.com/evenements" });
    default:
      throw new Error(`Aucun appel d'exemple pour ${key}`);
  }
}

// ── 4) Programme principal ───────────────────────────────────────────────
async function main() {
  // Doit être posé AVANT le chargement de mail.ts (URLs dérivées de l'env).
  process.env.NEXT_PUBLIC_SITE_URL = SEED_BASE;
  installFetchMock();

  const mail = await import("@/lib/mail");
  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let verified = 0;

  for (const def of TEMPLATE_REGISTRY) {
    captures = [];
    // Marketing : jetons uniques (nécessaires à la substitution inverse).
    // Verrouillés : valeurs réalistes, donc URL de production — sinon l'aperçu
    // afficherait une adresse de test.
    process.env.NEXT_PUBLIC_SITE_URL = def.category === "marketing" ? SEED_BASE : REAL_SITE_URL;
    const call = buildSampleCall(def.key, mail, def);
    await call();

    const cap = captures[captures.length - 1];
    if (!cap) throw new Error(`[${def.key}] aucune capture : l'envoi n'a rien produit.`);

    const { preheader, inner } = splitShell(cap.html, cap.subject);

    let bodyHtml: string;
    let subject: string = cap.subject;
    let storedPreheader: string = preheader;

    if (def.category === "marketing") {
      assertAllVariablesUsed(def, cap.html);
      bodyHtml = encodeFromSample(inner, def.variables);
      subject = encodeFromSample(cap.subject, def.variables);
      storedPreheader = encodeFromSample(preheader, def.variables);

      // Vérification de fidélité : re-rendu identique au HTML capturé ?
      const re = renderEmailTemplate(
        { subject, preheader: storedPreheader, bodyHtml },
        def.variables,
        sampleValues(def),
      );
      if (re.html !== cap.html) {
        throw new Error(
          `[${def.key}] FIDÉLITÉ ROMPUE : le rendu diffère du HTML réel ` +
            `(capturé ${cap.html.length} octets, rendu ${re.html.length}).`,
        );
      }
      if (re.subject !== cap.subject) {
        throw new Error(`[${def.key}] sujet non fidèle après substitution.`);
      }
      verified++;
    } else {
      // Verrouillés : corps figé, valeurs d'exemple en clair.
      bodyHtml = inner;
    }

    const existing = await prisma.emailTemplate.findUnique({ where: { key: def.key } });
    if (!existing) {
      await prisma.emailTemplate.create({
        data: { key: def.key, name: def.name, category: def.category, subject, preheader: storedPreheader, bodyHtml },
      });
      created++;
      console.info(`  + ${def.key} (${def.category})`);
    } else if (FORCE) {
      await prisma.emailTemplate.update({
        where: { key: def.key },
        data: { name: def.name, subject, preheader: storedPreheader, bodyHtml, version: { increment: 1 } },
      });
      updated++;
      console.info(`  ~ ${def.key} réécrit (--force)`);
    } else {
      skipped++;
      console.info(`  = ${def.key} déjà présent (conservé)`);
    }
  }

  // Nettoyage : le mock évite l'envoi, mais le tracking a pu écrire en base.
  const ev = await prisma.emailEvent.deleteMany({ where: { email: { contains: "zzseed" } } });
  const log = await prisma.memberEmailLog.deleteMany({ where: { email: { contains: "zzseed" } } });
  await prisma.$disconnect();

  console.info(
    `\nSeed terminé : ${created} créés, ${updated} réécrits, ${skipped} conservés. ` +
      `${verified} templates marketing vérifiés byte-à-byte. ` +
      `Nettoyage : ${ev.count} EmailEvent, ${log.count} MemberEmailLog.`,
  );
}

main().catch((err) => {
  console.error("\nSEED ÉCHOUÉ :", err instanceof Error ? err.message : err);
  process.exit(1);
});
