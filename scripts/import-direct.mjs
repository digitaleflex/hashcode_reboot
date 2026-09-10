/**
 * Import direct des anciens membres — script autonome (pas d'imports TS).
 *
 * Usage:
 *   node scripts/import-direct.mjs --dry-run    # Analyse seule
 *   node scripts/import-direct.mjs --send        # Import + envoi emails
 *   node scripts/import-direct.mjs --send --force # Force même si TESTING=1
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import crypto from "crypto";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

// ── Prisma ───────────────────────────────────────────────────────────────
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ── bcrypt (pour hash OTP) ───────────────────────────────────────────────
const bcrypt = require("bcryptjs");
const SALT_ROUNDS = 12;

// ── CSV files ────────────────────────────────────────────────────────────
const CSV_FILES = [
  "Formulaire d'inscription pour HashCode Informatique (réponses) - Réponses au formulaire 1.csv",
  "Rejoignez innoveCode!   (réponses) - Réponses au formulaire 1.csv",
];

// ── OTP ──────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_TTL_MS = 72 * 60 * 60 * 1000; // 72h pour l'invitation

function generateOtp() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(crypto.randomInt(min, max + 1));
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

// ── CSV Parser ───────────────────────────────────────────────────────────
function parseCsvLine(line, sep = ",") {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep || ch === ";") { fields.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function detectSeparator(lines) {
  let c = 0, t = 0;
  for (const l of lines.slice(0, 5)) { c += (l.match(/,/g)||[]).length; t += (l.match(/\t/g)||[]).length; }
  return t > c ? "\t" : ",";
}

// ── Mappings ─────────────────────────────────────────────────────────────
function mapLevel(r) {
  const s = (r||"").toLowerCase();
  if (s.includes("expert") || s.includes("avanc")) return "advanced";
  if (s.includes("inter")) return "practicing";
  return "beginner";
}
function mapCountry(r) {
  const s = (r||"").trim().toLowerCase();
  const m = {
    "côte d'ivoire":"CI","cote d'ivoire":"CI","ivoire":"CI",
    "sénégal":"SN","senegal":"SN","bénin":"BJ","benin":"BJ",
    "cameroun":"CM","mali":"ML","niger":"NE","burkina faso":"BF","burkina":"BF",
    "togo":"TG","congo":"CG","république du congo":"CG","republique du congo":"CG",
    "rdc":"CD","république démocratique du congo":"CD","republique democratique du congo":"CD",
    "tunisie":"TN","maroc":"MA","algérie":"DZ","algerie":"DZ",
    "guinée":"GN","guinee":"GN","gabon":"GA",
  };
  return m[s] ?? "";
}
function mapDomain(r) {
  const s = (r||"").toLowerCase();
  if (s.includes("cyber") || s.includes("sécurit") || s.includes("securit")) return "cybersecurity";
  if (s.includes("ai") || s.includes("machine learning") || s.includes("intelligence") || s.includes("data")) return "ai";
  return "web";
}

// ── Parse CSVs ───────────────────────────────────────────────────────────
function parseCsv1(filePath) {
  const lines = readFileSync(filePath, "utf-8").split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
  const sep = detectSeparator(lines);
  const hdr = parseCsvLine(lines[0], sep);
  let eI=-1,nI=-1,pI=-1,cI=-1,lI=-1,dI=-1;
  for (let i=0;i<hdr.length;i++) {
    const h = hdr[i].toLowerCase();
    if (h.includes("email")||h.includes("e-mail")||h.includes("adresse")) eI=i;
    if (h.includes("nom complet")) nI=i;
    if (h.includes("whatsapp")||h.includes("téléphone")||h.includes("tel")) pI=i;
    if (h.includes("pays")) cI=i;
    if (h.includes("niveau")) lI=i;
    if (h.includes("technolog")||h.includes("spécialisation")||h.includes("domaine")) dI=i;
  }
  const members = [];
  for (let i=1;i<lines.length;i++) {
    const f = parseCsvLine(lines[i], sep);
    const email = (f[eI]||"").toLowerCase().trim();
    if (!email||!email.includes("@")) continue;
    members.push({
      email,
      firstName: ((f[nI]||"").trim().split(/\s+/)[0]) || email.split("@")[0],
      phone: (f[pI]||"").trim() || null,
      country: mapCountry(f[cI]||""),
      level: mapLevel(f[lI]||""),
      domain: mapDomain(f[dI]||""),
      source: "hashcode_informatique",
    });
  }
  return members;
}

function parseCsv2(filePath) {
  const lines = readFileSync(filePath, "utf-8").split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
  const sep = detectSeparator(lines);
  const hdr = parseCsvLine(lines[0], sep);
  let eI=-1,nI=-1,pI=-1,cI=-1,dI=-1;
  for (let i=0;i<hdr.length;i++) {
    const h = hdr[i].toLowerCase();
    if (h.includes("email")||h.includes("e-mail")||h.includes("adresse")) eI=i;
    if (h.includes("nom complet")||h.includes("nom")) nI=i;
    if (h.includes("whatsapp")||h.includes("téléphone")||h.includes("numéro")) pI=i;
    if (h.includes("pays")) cI=i;
    if (h.includes("domaine")||h.includes("expertise")) dI=i;
  }
  const members = [];
  for (let i=1;i<lines.length;i++) {
    const f = parseCsvLine(lines[i], sep);
    const email = (f[eI]||"").toLowerCase().trim();
    if (!email||!email.includes("@")) continue;
    members.push({
      email,
      firstName: ((f[nI]||"").trim().split(/\s+/)[0]) || email.split("@")[0],
      phone: (f[pI]||"").trim() || null,
      country: mapCountry(f[cI]||""),
      level: "beginner",
      domain: mapDomain(f[dI]||""),
      source: "innovecode",
    });
  }
  return members;
}

// ── .env parser (autonome, sans dépendance) ───────────────────────────────
try {
  const envContent = readFileSync(join(ROOT, ".env"), "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
} catch { /* .env optionnel — vars déjà dans l'environnement */ }

// ── Send email via Resend API (simple HTTP) ──────────────────────────────
async function sendViaResend(to, subject, html, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Send email via Brevo API (simple HTTP) ───────────────────────────────
async function sendViaBrevo(to, subject, html, text) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_EMAIL_FROM;
  if (!apiKey || !from) return false;
  const emailMatch = from.match(/<([^>]+)>/);
  const fromEmail = emailMatch ? emailMatch[1] : from;
  const fromName = from.replace(/<[^>]+>/, "").trim() || "HASHCODE REBOOT";
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Send email avec stratégie EMAIL_PROVIDER (brevo prioritaire si défini) ─
async function sendEmail(to, subject, html, text) {
  const brevoFirst = process.env.EMAIL_PROVIDER === "brevo";
  const first = brevoFirst ? sendViaBrevo : sendViaResend;
  const second = brevoFirst ? sendViaResend : sendViaBrevo;
  const firstName = brevoFirst ? "Brevo" : "Resend";
  const secondName = brevoFirst ? "Resend" : "Brevo";

  if (await first(to, subject, html, text)) return { ok: true, via: firstName };
  // Fallback systématique vers l'autre provider
  if (await second(to, subject, html, text)) {
    console.log(`     ℹ️  Fallback ${firstName} → ${secondName} pour ${to}`);
    return { ok: true, via: secondName };
  }
  console.log(`     ⚠️  Échec envoi (${firstName}+${secondName}) à ${to}`);
  return { ok: false, via: null };
}

// ── Email template (invitation avec Accepter/Refuser) ────────────────────
function buildRejoinEmail(firstName, acceptUrl, refuseUrl) {
  const name = (firstName || "toi").trim();
  const safeName = name.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const safeAcceptUrl = acceptUrl.replace(/&/g,"&amp;").replace(/"/g,"&quot;");
  const safeRefuseUrl = (refuseUrl || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;");
  const subject = "Tu es invite a rejoindre HASHCODE REBOOT";
  const text = [
    `Bonjour ${name},`,
    "",
    "Tu es invite a rejoindre la communaute HASHCODE REBOOT.",
    "",
    "Clique sur Accepter :",
    acceptUrl,
    "",
    "Si tu ne souhaites pas rejoindre, clique sur Refuser :",
    refuseUrl,
    "",
    "L'equipe HASHCODE",
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#0A0A0A;"><div style="max-width:600px;margin:32px auto;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden;"><div style="background:#C5F441;font-size:0;height:3px;"></div><div style="padding:28px 32px;"><div style="font-size:24px;font-weight:800;font-style:italic;color:#F8FAFC;text-align:center;">HASHCODE</div><div style="font-size:12px;font-weight:700;letter-spacing:4px;color:#C5F441;text-align:center;margin:6px 0 0 0;">REBOOT</div><div style="padding:24px 0;"><div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C5F441;margin:0 0 12px 0;">INVITATION</div><h1 style="margin:0 0 12px 0;font-size:24px;color:#F8FAFC;">${safeName}, tu es invite.</h1><p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#F8FAFC;">La communaute HASHCODE REBOOT est active et on t'invite a nous rejoindre. Des sessions pratiques, du networking et une communaute de passionnes t'attendent.</p><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><a href="${safeAcceptUrl}" style="display:inline-block;padding:14px 32px;background:#C5F441;color:#0A0A0A;text-decoration:none;font-size:16px;font-weight:800;border-radius:8px;">Accepter l'invitation</a></td></tr></table>${safeRefuseUrl ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px;"><tr><td align="center"><a href="${safeRefuseUrl}" style="display:inline-block;padding:12px 24px;border:1px solid #333B1E;color:#94A3B8;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px;">Refuser</a></td></tr></table>` : ""}<p style="margin:16px 0 0 0;font-size:12px;color:#64748B;text-align:center;">Tu recois cet email car tu as fait partie de la communaute HASHCODE.</p></div><div style="border-top:1px solid #262626;padding-top:16px;"><p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">HASHCODE · REBOOT</p></div></div></body></html>`;
  return { subject, html, text };
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const mode = process.argv.includes("--send") ? "send" : "dry-run";
  const force = process.argv.includes("--force");

  console.log(`\n📥 Import des anciens membres — mode: ${mode}\n`);

  // Parse
  const csv1 = parseCsv1(join(ROOT, CSV_FILES[0]));
  const csv2 = parseCsv2(join(ROOT, CSV_FILES[1]));
  console.log(`  CSV1 (HashCode Informatique): ${csv1.length} membres`);
  console.log(`  CSV2 (innoveCode): ${csv2.length} membres`);

  // Merge + dedup
  const all = [...csv1, ...csv2];
  const seen = new Set();
  const unique = [];
  for (const m of all) {
    if (!seen.has(m.email)) { seen.add(m.email); unique.push(m); }
  }
  console.log(`\n  Total: ${all.length} → ${unique.length} uniques (${all.length - unique.length} doublons)\n`);

  // Check existing
  const existing = await prisma.member.findMany({
    where: { email: { in: unique.map(m => m.email) } },
    select: { email: true, profileStatus: true },
  });
  const existSet = new Set(existing.map(e => e.email));
  const toCreate = unique.filter(m => !existSet.has(m.email));
  const alreadyExist = unique.filter(m => existSet.has(m.email));

  console.log(`  Nouveaux à créer: ${toCreate.length}`);
  console.log(`  Déjà en DB:       ${alreadyExist.length}`);
  if (alreadyExist.length > 0) {
    console.log(`  → ${alreadyExist.map(m => `${m.email} (${m.source})`).join(", ")}\n`);
  }

  if (toCreate.length === 0) {
    console.log(`  ✅ Rien à faire — tous les membres existent déjà.\n`);
    await prisma.$disconnect();
    return;
  }

  // Preview
  console.log(`  Aperçu:`);
  for (const m of toCreate.slice(0, 10)) {
    console.log(`    ${m.email.padEnd(35)} | ${m.firstName.padEnd(12)} | ${m.phone || "-".padEnd(15)} | ${(m.country||"-").padEnd(3)} | ${m.level.padEnd(11)} | ${m.domain.padEnd(14)} | ${m.source}`);
  }
  if (toCreate.length > 10) console.log(`    ... et ${toCreate.length - 10} autres`);
  console.log();

  if (mode === "dry-run") {
    console.log(`  💡 Pour lancer l'import + envoi d'emails, relance avec --send\n`);
    await prisma.$disconnect();
    return;
  }

  // ── SEND MODE ──────────────────────────────────────────────────────
  if (process.env.TESTING === "1" && !force) {
    console.log(`  ⚠️  TESTING=1 détecté — import bloqué. Passer --force pour forcer.\n`);
    await prisma.$disconnect();
    return;
  }

  const SEND_DELAY_MS = 250;
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";

  let created = 0, sent = 0, failed = [];

  for (const m of toCreate) {
    try {
      // Create member
      const member = await prisma.member.create({
        data: {
          email: m.email,
          firstName: m.firstName,
          phone: m.phone,
          primaryDomain: m.domain,
          level: m.level,
          goal: "",
          profileStatus: "PENDING",
          communityStatus: "NOT_INVITED",
          invitationStatus: "INVITED",
          invitedAt: new Date(),
          accessLane: "immediate",
          country: m.country,
          availability: "5-10h",
          learningStyle: "practice",
          source: m.source,
        },
      });
      created++;

      // Generate OTP + session
      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);
      await prisma.memberSession.create({
        data: {
          memberId: member.id,
          otpHash,
          expiresAt,
          ip: null,
          userAgent: "admin-import-old-members",
        },
      });

      // Send email
      const acceptUrl = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&code=${encodeURIComponent(otp)}&next=${encodeURIComponent("/dashboard")}`;
      const refuseUrl = `${base.replace(/\/$/, "")}/api/invite/refuse?email=${encodeURIComponent(member.email)}&token=${encodeURIComponent(otp)}`;
      const { subject, html, text } = buildRejoinEmail(m.firstName, acceptUrl, refuseUrl);
      const { ok, via } = await sendEmail(m.email, subject, html, text);
      if (ok) sent++;
      else failed.push(m.email);

      // Update invitation status
      if (ok) {
        await prisma.member.update({
          where: { id: member.id },
          data: { invitationStatus: "INVITED", invitedAt: new Date() },
        });
      }

      console.log(`  ✅ ${m.email} (${m.source}) — email ${ok ? `envoyé via ${via}` : "échoué"}`);
      await new Promise(r => setTimeout(r, SEND_DELAY_MS));
    } catch (e) {
      failed.push(m.email);
      console.log(`  ❌ ${m.email}: ${e.message}`);
    }
  }

  // Audit
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: "admin_import_old_members",
        ref: `created=${created} sent=${sent} failed=${failed.length} skipped=${alreadyExist.length}`,
        value: created,
      },
    });
  } catch {}

  console.log(`\n  ✅ Terminé!`);
  console.log(`     Créés:          ${created}`);
  console.log(`     Emails envoyés: ${sent}`);
  console.log(`     Échoués:        ${failed.length}`);
  console.log(`     Ignorés:        ${alreadyExist.length}`);
  if (failed.length) console.log(`     ❌ ${failed.join(", ")}`);
  console.log();

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
