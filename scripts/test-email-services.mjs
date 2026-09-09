// HASHCODE REBOOT — Test rapide des services email (Resend + Brevo).
// Usage : node scripts/test-email-services.mjs
//
// Ce script :
//   1. Vérifie que les clés API sont présentes dans .env
//   2. Vérifie que la clé Resend est valide (GET /v3/domains)
//   3. Tente un envoi réel via Resend à delivered@resend.dev (sandbox Resend)
//   4. Vérifie que la clé Brevo est valide (GET /v3/account)
//   5. Tente un envoi réel via Brevo (si possible)
//
// Aucune valeur sensible n'est loggée.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse .env simple (pas de dépendance externe)
const envPath = resolve(__dirname, "..", ".env");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("❌ .env introuvable :", envPath);
  process.exit(1);
}
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
}

const RESEND_API_KEY = env.RESEND_API_KEY;
const BREVO_API_KEY = env.BREVO_API_KEY;
const EMAIL_FROM = env.EMAIL_FROM;
const BREVO_EMAIL_FROM = env.BREVO_EMAIL_FROM;

console.log("────────────────────────────────────────────────────");
console.log("🧪 HASHCODE REBOOT — Test des services email");
console.log("────────────────────────────────────────────────────\n");

// Résumé config
console.log("📋 Config (.env) :");
console.log(`   RESEND_API_KEY     : ${RESEND_API_KEY ? "✅ présente" : "❌ absente"}`);
console.log(`   EMAIL_FROM         : ${EMAIL_FROM || "❌ absent"}`);
console.log(`   BREVO_API_KEY      : ${BREVO_API_KEY ? "✅ présente" : "❌ absente"}`);
console.log(`   BREVO_EMAIL_FROM   : ${BREVO_EMAIL_FROM || "❌ absent"}\n`);

let totalOk = 0;
let totalFailed = 0;
const results = [];

// ─── 1. Resend : GET /v3/domains (vérifier la clé) ──────────────────
async function testResend() {
  if (!RESEND_API_KEY) {
    return { provider: "Resend", step: "key-check", ok: false, reason: "RESEND_API_KEY absente" };
  }
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        provider: "Resend",
        step: "key-check",
        ok: false,
        reason: `HTTP ${res.status} (clé invalide ou expirée ?)`,
      };
    }
    const data = await res.json();
    const domainCount = data.data?.length ?? 0;
    return { provider: "Resend", step: "key-check", ok: true, detail: `${domainCount} domaine(s) configuré(s)` };
  } catch (e) {
    return { provider: "Resend", step: "key-check", ok: false, reason: e.message };
  }
}

// ─── 2. Resend : envoi réel à delivered@resend.dev (sandbox) ────────
async function testResendSend() {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return { provider: "Resend", step: "send-test", ok: false, reason: "config absente" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: ["delivered@resend.dev"],
        subject: "[HASHCODE TEST] Vérification Resend",
        html: "<p>Si tu reçois cet email, Resend fonctionne ✅</p>",
        text: "Si tu reçois cet email, Resend fonctionne.",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        provider: "Resend",
        step: "send-test",
        ok: false,
        reason: `HTTP ${res.status} — ${errBody.slice(0, 200)}`,
      };
    }
    const data = await res.json();
    return {
      provider: "Resend",
      step: "send-test",
      ok: true,
      detail: `id=${data.id ?? "?"} (vérifier delivered@resend.dev dans le dashboard Resend)`,
    };
  } catch (e) {
    return { provider: "Resend", step: "send-test", ok: false, reason: e.message };
  }
}

// ─── 3. Brevo : GET /v3/account (vérifier la clé) ───────────────────
async function testBrevo() {
  if (!BREVO_API_KEY) {
    return { provider: "Brevo", step: "key-check", ok: false, reason: "BREVO_API_KEY absente" };
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": BREVO_API_KEY, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        provider: "Brevo",
        step: "key-check",
        ok: false,
        reason: `HTTP ${res.status} (clé invalide ou expirée ?)`,
      };
    }
    const data = await res.json();
    return {
      provider: "Brevo",
      step: "key-check",
      ok: true,
      detail: `compte OK, email=${data.email ?? "?"}, plan=${data.plan?.[0]?.type ?? "?"}`,
    };
  } catch (e) {
    return { provider: "Brevo", step: "key-check", ok: false, reason: e.message };
  }
}

// ─── 4. Brevo : envoi réel à un email sandbox ───────────────────────
async function testBrevoSend() {
  if (!BREVO_API_KEY || !BREVO_EMAIL_FROM) {
    return { provider: "Brevo", step: "send-test", ok: false, reason: "config absente" };
  }
  // Extraire email du format "Nom <email@domaine>"
  const match = BREVO_EMAIL_FROM.match(/<([^>]+)>/);
  const fromEmail = match ? match[1] : BREVO_EMAIL_FROM;
  const fromName = BREVO_EMAIL_FROM.replace(/<[^>]+>/, "").trim() || "HASHCODE";
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: "delivered@resend.dev" }], // sandbox accepts this
        subject: "[HASHCODE TEST] Vérification Brevo",
        htmlContent: "<p>Si tu reçois cet email, Brevo fonctionne ✅</p>",
        textContent: "Si tu reçois cet email, Brevo fonctionne.",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        provider: "Brevo",
        step: "send-test",
        ok: false,
        reason: `HTTP ${res.status} — ${errBody.slice(0, 200)}`,
      };
    }
    const data = await res.json();
    return {
      provider: "Brevo",
      step: "send-test",
      ok: true,
      detail: `messageId=${data.messageId ?? "?"}`,
    };
  } catch (e) {
    return { provider: "Brevo", step: "send-test", ok: false, reason: e.message };
  }
}

// ─── Run ────────────────────────────────────────────────────────────
console.log("🧪 Lancement des tests…\n");

const tests = [
  { name: "Resend — clé valide", fn: testResend },
  { name: "Resend — envoi réel", fn: testResendSend },
  { name: "Brevo — clé valide", fn: testBrevo },
  { name: "Brevo — envoi réel", fn: testBrevoSend },
];

for (const t of tests) {
  const r = await t.fn();
  const icon = r.ok ? "✅" : "❌";
  const detail = r.ok ? r.detail : r.reason;
  console.log(`${icon} ${r.provider.padEnd(8)} — ${r.step.padEnd(10)} → ${detail}`);
  results.push(r);
  if (r.ok) totalOk++;
  else totalFailed++;
}

console.log("\n────────────────────────────────────────────────────");
console.log(`📊 Résultat : ${totalOk} ✅ · ${totalFailed} ❌`);
console.log("────────────────────────────────────────────────────");

if (totalFailed > 0) {
  console.log("\n🔧 Actions correctives possibles :");
  for (const r of results) {
    if (!r.ok) {
      if (r.reason?.includes("401") || r.reason?.includes("403")) {
        console.log(`   - ${r.provider} : clé API invalide → régénérer sur le dashboard ${r.provider}`);
      } else if (r.reason?.includes("domain")) {
        console.log(`   - ${r.provider} : domaine non vérifié → ajouter reboot.joinhashcode.com sur ${r.provider}`);
      } else if (r.reason?.includes("timeout")) {
        console.log(`   - ${r.provider} : timeout → vérifier la connexion internet`);
      } else {
        console.log(`   - ${r.provider} (${r.step}) : ${r.reason}`);
      }
    }
  }
}

process.exit(totalFailed > 0 ? 1 : 0);
