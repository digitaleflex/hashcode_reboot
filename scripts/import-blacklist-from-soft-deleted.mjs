// HASHCODE REBOOT — One-time import script : soft-deleted members → blacklist.
// Usage: node scripts/import-blacklist-from-soft-deleted.mjs
//
// But : ajouter à la MemberBlacklist tous les emails des membres soft-deleted,
// pour empêcher leur ré-inscription après ce script.
//
// ⚠️  À lancer UNE SEULE FOIS après avoir déployé la migration add_email_blacklist.
// Le script est idempotent : si l'email est déjà blacklisté, on skip.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse .env simple
const envPath = resolve(__dirname, "..", ".env");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("❌ .env introuvable :", envPath);
  process.exit(1);
}
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const db = new PrismaClient();

async function main() {
  console.log("────────────────────────────────────────────────────");
  console.log("🛡️  Import soft-deleted → blacklist");
  console.log("────────────────────────────────────────────────────\n");

  const softDeleted = await db.member.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, email: true, firstName: true, deletedAt: true },
  });

  console.log(`📋 ${softDeleted.length} membre(s) soft-deleted trouvé(s)\n`);

  if (softDeleted.length === 0) {
    console.log("✅ Rien à importer. La blacklist est vide.");
    await db.$disconnect();
    return;
  }

  let added = 0;
  let skipped = 0;
  let errored = 0;

  for (const m of softDeleted) {
    try {
      const existing = await db.memberBlacklist.findUnique({
        where: { email: m.email },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await db.memberBlacklist.create({
        data: {
          email: m.email,
          reason: "admin",
          note: `Import initial — soft-deleted ${m.deletedAt?.toISOString() ?? "?"} (memberId=${m.id})`,
          autoAdded: true,
        },
      });
      added += 1;
      console.log(`   ✅ ${m.email}`);
    } catch (e) {
      errored += 1;
      console.error(`   ❌ ${m.email}: ${e.message ?? e}`);
    }
  }

  console.log("\n────────────────────────────────────────────────────");
  console.log(`📊 Résultat : ${added} ajoutés · ${skipped} déjà présents · ${errored} erreurs`);
  console.log("────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("💥 Erreur fatale :", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
