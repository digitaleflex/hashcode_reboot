#!/usr/bin/env node
/**
 * Seed du rôle admin initial (Member.adminRole).
 *
 * La colonne `adminRole` est nullable sans défaut : après la migration, tous
 * les membres sont à null (= pas admin, fail-closed). Ce script pose le rôle
 * "operator" sur le compte admin, par upsert sur l'email (clé stable) — il
 * est donc sûr à ré-exécuter : relancer ne produit jamais de doublon.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/seed-admin-role.ts
 */

import { PrismaClient } from "@prisma/client";

const ADMIN_EMAIL = "eflexcloud@gmail.com";
const ADMIN_ROLE = "operator";

async function main() {
  const prisma = new PrismaClient();

  const before = await prisma.member.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, firstName: true, adminRole: true },
  });
  console.info(
    `  Avant : ${ADMIN_EMAIL} → adminRole=${before?.adminRole ?? "(introuvable)"}`,
  );
  if (!before) {
    throw new Error(`Membre introuvable pour ${ADMIN_EMAIL} : seed impossible.`);
  }

  const updated = await prisma.member.update({
    where: { email: ADMIN_EMAIL },
    data: { adminRole: ADMIN_ROLE },
    select: { id: true, email: true, adminRole: true },
  });

  await prisma.$disconnect();

  console.info(
    `\nSeed terminé : ${updated.email} (id ${updated.id}) → adminRole="${updated.adminRole}".`,
  );
}

main().catch((err) => {
  console.error("\nSEED ÉCHOUÉ :", err instanceof Error ? err.message : err);
  process.exit(1);
});
