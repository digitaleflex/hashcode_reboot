/**
 * Script d'import des anciens membres depuis deux CSV.
 *
 * Usage:
 *   node scripts/import-old-members.mjs --dry-run    # Analyse sans rien faire
 *   node scripts/import-old-members.mjs --send        # Import + envoi emails
 *
 * Lit les deux CSV du projet root, fusionne, déduplique par email,
 * crée les membres en PENDING et envoie un magic link 1-clic.
 */

import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

// ── CSV files ────────────────────────────────────────────────────────────
const CSV_FILES = [
  "Formulaire d'inscription pour HashCode Informatique (réponses) - Réponses au formulaire 1.csv",
  "Rejoignez innoveCode!   (réponses) - Réponses au formulaire 1.csv",
];

// ── CSV Parser (gère guillemets + virgules imbriquées) ───────────────────
function parseCsvLine(line, sep = ",") {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep || ch === ";") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function detectSeparator(lines) {
  let commas = 0;
  let tabs = 0;
  for (const line of lines.slice(0, 5)) {
    commas += (line.match(/,/g) || []).length;
    tabs += (line.match(/\t/g) || []).length;
  }
  return tabs > commas ? "\t" : ",";
}

// ── Level mapping ────────────────────────────────────────────────────────
function mapLevel(raw) {
  const s = (raw || "").toLowerCase();
  if (s.includes("expert")) return "advanced";
  if (s.includes("avanc")) return "advanced";
  if (s.includes("inter")) return "practicing";
  if (s.includes("dbutant") || s.includes("dbutant")) return "beginner";
  return "beginner";
}

// ── Country mapping ──────────────────────────────────────────────────────
function mapCountry(raw) {
  const s = (raw || "").trim().toLowerCase();
  const map = {
    "côte d'ivoire": "CI", "cote d'ivoire": "CI", "ivoire": "CI",
    "sénégal": "SN", "senegal": "SN",
    "bénin": "BJ", "benin": "BJ",
    "cameroun": "CM",
    "mali": "ML",
    "niger": "NE",
    "burkina faso": "BF", "burkina": "BF",
    "togo": "TG",
    "congo": "CG", "république du congo": "CG", "republique du congo": "CG",
    "rdc": "CD", "république démocratique du congo": "CD",
    "tunisie": "TN",
    "maroc": "MA",
    "algérie": "DZ", "algerie": "DZ",
    "guinée": "GN", "guinee": "GN",
    "gabon": "GA",
    "autres pays du monde": "",
  };
  return map[s] ?? "";
}

// ── Domain mapping ───────────────────────────────────────────────────────
function mapDomain(raw) {
  const s = (raw || "").toLowerCase();
  if (s.includes("cyber") || s.includes("sécurit") || s.includes("securit")) return "cybersecurity";
  if (s.includes("ai") || s.includes("machine learning") || s.includes("intelligence")) return "ai";
  if (s.includes("data") || s.includes("analyse")) return "ai";
  return "web";
}

// ── Parse CSV1 (HashCode Informatique) ───────────────────────────────────
function parseCsv1(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const sep = detectSeparator(lines);

  // Headers: Adresse e-mail(1), Nom Complet(4), Téléphone WhatsApp(3), Pays(6), Niveau(8)
  const headerFields = parseCsvLine(lines[0], sep);
  let emailIdx = -1, nameIdx = -1, phoneIdx = -1, countryIdx = -1, levelIdx = -1, domainIdx = -1;

  for (let i = 0; i < headerFields.length; i++) {
    const h = headerFields[i].toLowerCase();
    if (h.includes("email") || h.includes("e-mail") || h.includes("adresse")) emailIdx = i;
    if (h.includes("nom complet")) nameIdx = i;
    if (h.includes("whatsapp") || h.includes("téléphone") || h.includes("telephone") || h.includes("tel")) phoneIdx = i;
    if (h.includes("pays")) countryIdx = i;
    if (h.includes("niveau")) levelIdx = i;
    if (h.includes("technolog") || h.includes("spécialisation") || h.includes("domaine")) domainIdx = i;
  }

  const members = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i], sep);
    const email = (fields[emailIdx] || "").toLowerCase().trim();
    if (!email || !email.includes("@")) continue;

    const rawName = (fields[nameIdx] || "").trim();
    const firstName = rawName.split(/\s+/)[0] || email.split("@")[0];

    members.push({
      email,
      firstName,
      phone: (fields[phoneIdx] || "").trim() || null,
      country: mapCountry(fields[countryIdx] || ""),
      level: mapLevel(fields[levelIdx] || ""),
      domain: mapDomain(fields[domainIdx] || ""),
      source: "hashcode_informatique",
    });
  }
  return members;
}

// ── Parse CSV2 (innoveCode) ──────────────────────────────────────────────
function parseCsv2(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const sep = detectSeparator(lines);

  // Headers: Adresse e-mail(1), Nom complet(2), Pays(3), Téléphone(4), Domaine(6)
  const headerFields = parseCsvLine(lines[0], sep);
  let emailIdx = -1, nameIdx = -1, phoneIdx = -1, countryIdx = -1, domainIdx = -1;

  for (let i = 0; i < headerFields.length; i++) {
    const h = headerFields[i].toLowerCase();
    if (h.includes("email") || h.includes("e-mail") || h.includes("adresse")) emailIdx = i;
    if (h.includes("nom complet") || h.includes("nom")) nameIdx = i;
    if (h.includes("whatsapp") || h.includes("téléphone") || h.includes("telephone") || h.includes("phone") || h.includes("numéro")) phoneIdx = i;
    if (h.includes("pays")) countryIdx = i;
    if (h.includes("domaine") || h.includes("expertise")) domainIdx = i;
  }

  const members = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i], sep);
    const email = (fields[emailIdx] || "").toLowerCase().trim();
    if (!email || !email.includes("@")) continue;

    const rawName = (fields[nameIdx] || "").trim();
    const firstName = rawName.split(/\s+/)[0] || email.split("@")[0];

    members.push({
      email,
      firstName,
      phone: (fields[phoneIdx] || "").trim() || null,
      country: mapCountry(fields[countryIdx] || ""),
      level: "beginner", // pas de niveau dans ce CSV
      domain: mapDomain(fields[domainIdx] || ""),
      source: "innovecode",
    });
  }
  return members;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const mode = process.argv.includes("--send") ? "send" : "dry-run";
  const API_BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://reboot.joinhashcode.com";
  const API_URL = `${API_BASE}/api/admin/import-invite`;

  console.log(`\n📥 Import des anciens membres — mode: ${mode}\n`);

  // Parse both CSVs
  const csv1Path = join(ROOT, CSV_FILES[0]);
  const csv2Path = join(ROOT, CSV_FILES[1]);

  let csv1 = [];
  let csv2 = [];
  try {
    csv1 = parseCsv1(csv1Path);
    console.log(`  ✅ CSV1 (HashCode Informatique): ${csv1.length} membres`);
  } catch (e) {
    console.log(`  ❌ CSV1: ${e.message}`);
  }
  try {
    csv2 = parseCsv2(csv2Path);
    console.log(`  ✅ CSV2 (innoveCode): ${csv2.length} membres`);
  } catch (e) {
    console.log(`  ❌ CSV2: ${e.message}`);
  }

  // Merge + dedup
  const all = [...csv1, ...csv2];
  const seen = new Set();
  const unique = [];
  for (const m of all) {
    if (!seen.has(m.email)) {
      seen.add(m.email);
      unique.push(m);
    }
  }

  const dupes = all.length - unique.length;
  console.log(`\n📊 Total: ${all.length} → ${unique.length} uniques (${dupes} doublons supprimés)`);

  // Build CSV text for API (format unifié)
  const csvLines = ["email,firstName,phone,country,level,domain"];
  for (const m of unique) {
    const phone = m.phone ? `"${m.phone.replace(/"/g, '""')}"` : "";
    csvLines.push(`"${m.email}","${m.firstName}",${phone},"${m.country}","${m.level}","${m.domain}"`);
  }
  const csvText = csvLines.join("\n");

  // Call API
  console.log(`\n🔗 Appel API: ${API_URL}`);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText, confirm: mode === "send" }),
    });
    const data = await res.json();

    if (!res.ok) {
      console.log(`\n❌ Erreur ${res.status}:`, JSON.stringify(data, null, 2));
      process.exit(1);
    }

    if (data.dryRun) {
      console.log(`\n🔍 Dry-run results:`);
      console.log(`   Lignes CSV:      ${data.totalRows}`);
      console.log(`   Emails valides:  ${data.validRows}`);
      console.log(`   Nouveaux membres: ${data.newMembers}`);
      console.log(`   Déjà existants:  ${data.alreadyExist}`);
      if (data.sample?.length) {
        console.log(`   Aperçu:          ${data.sample.map((s) => s.email).join(", ")}`);
      }
      console.log(`\n💡 Pour lancer l'import + envoi d'emails, relance avec --send`);
    } else {
      console.log(`\n✅ Import terminé!`);
      console.log(`   Créés:           ${data.created}`);
      console.log(`   Emails envoyés:  ${data.emailsSent}`);
      console.log(`   Échoués:         ${data.failed?.length || 0}`);
      console.log(`   Ignorés:         ${data.skippedAlreadyExist}`);
      if (data.failed?.length) {
        console.log(`   ❌ Échoués:      ${data.failed.join(", ")}`);
      }
      if (data.skippedEmails?.length) {
        console.log(`   ⏭️  Ignorés:     ${data.skippedEmails.join(", ")}`);
      }
    }
  } catch (e) {
    console.log(`\n❌ Erreur réseau: ${e.message}`);
    console.log(`   Assure-toi que le serveur tourne sur ${API_BASE}`);
    process.exit(1);
  }
}

main();
