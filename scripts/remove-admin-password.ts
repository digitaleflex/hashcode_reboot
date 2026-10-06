#!/usr/bin/env node
/**
 * Suppression du mot de passe stocké du compte admin (table Account).
 *
 * Depuis que l'OTP est le seul chemin de connexion (`emailAndPassword.enabled
 * = false`), la ligne `credential` du compte admin est morte : la supprimer
 * rend toute réactivation du login mot de passe impossible sans recréation
 * explicite d'un hash.
 *
 * Idempotent : `deleteMany` sur (providerId, email de l'utilisateur) — relancer
 * ne fait rien une fois la ligne partie. Compteurs avant/après affichés.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/remove-admin-password.ts
 */

import { PrismaClient } from "@prisma/client";

const ADMIN_EMAIL = "eflexcloud@gmail.com";

async function main() {
  const prisma = new PrismaClient();

  const where = { providerId: "credential", user: { email: ADMIN_EMAIL } };

  let before = 0;
  try {
    before = await prisma.account.count({ where });
  } catch (err) {
    // Base sans les tables Better Auth (ex. branche Neon partielle) : rien
    // à supprimer, on sort proprement au lieu de casser le déploiement.
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
    const detail = code === "P2021" ? "table Account absente" : err instanceof Error ? err.name : String(err).slice(0, 80);
    console.info(`  Avant : ${detail} — rien à supprimer.`);
    await prisma.$disconnect();
    console.info("\nNettoyage terminé : 0 ligne credential (compte admin sans mot de passe).");
    return;
  }
  console.info(`  Avant : ${before} ligne(s) credential pour ${ADMIN_EMAIL}.`);

  const deleted = await prisma.account.deleteMany({ where });

  const after = await prisma.account.count({ where });
  await prisma.$disconnect();

  console.info(
    `\nNettoyage terminé : ${deleted.count} ligne(s) supprimée(s), ${after} restante(s).`,
  );
  if (after > 0) {
    console.error("NETTOYAGE INCOMPLET : des lignes credential subsistent.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nNETTOYAGE ÉCHOUÉ :", err instanceof Error ? err.message : err);
  process.exit(1);
});
