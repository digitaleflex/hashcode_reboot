#!/usr/bin/env node
/**
 * Garantit qu'un compte admin existe et porte le rôle "operator".
 *
 * Déployé automatiquement à chaque `migrate` : sans cela, un membre avec
 * adminRole NULL fait boucler /admin vers /login, sans message d'erreur.
 *
 * Deux cas distincts, à ne pas confondre :
 *   - le membre EXISTE déjà  → on pose le rôle. Cas normal après import.
 *   - le membre N'EXISTE PAS → on NE le crée PAS. Créer une ligne Member
 *     à la main produit un profil incohérent (firstName, country, level,
 *     goal sont NOT NULL) et casse l'inscription. L'admin se connecte et
 *     crée son profil via le flux OTP.
 *
 * Idempotent : relancer ne change rien, ne crée pas de doublon, ne échoue
 * pas si le rôle est déjà posé.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/ensure-admin.ts
 */

import { PrismaClient } from "@prisma/client";

const ADMIN_ROLE = "operator";

function resolveEmails(): string[] {
  const fromArgs = process.argv.slice(2).flatMap((a) => a.split(","));
  const raw = fromArgs.length ? fromArgs : (process.env.ADMIN_OPERATORS ?? "").split(",");
  return [...new Set(raw.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

async function main() {
  const emails = resolveEmails();
  const prisma = new PrismaClient();

  if (!emails.length) {
    // Pas une erreur : ADMIN_OPERATORS vide = personne n'est admin, c'est un
    // choix légitime. Fail-closed.
    console.warn("  ADMIN_OPERATORS vide — aucun administrateur. Rien à faire.");
    await prisma.$disconnect();
    return;
  }

  console.info(`  Cibles : ${emails.join(", ")}`);

  let granted = 0;
  const pending: string[] = [];

  for (const email of emails) {
    const member = await prisma.member.findUnique({
      where: { email },
      select: { id: true, firstName: true, adminRole: true },
    });

    if (!member) {
      // Volontairement non bloquant : c'est le cas normal au premier
      // déploiement sur une base vide.
      console.warn(`  ⏳ ${email} : pas encore inscrit — le rôle sera posé à sa première connexion.`);
      pending.push(email);
      continue;
    }

    if (member.adminRole === ADMIN_ROLE) {
      console.info(`  ✔ ${email} : déjà operator.`);
      granted += 1;
      continue;
    }

    await prisma.member.update({
      where: { email },
      data: { adminRole: ADMIN_ROLE },
    });
    console.info(`  ↑ ${email} (${member.firstName}) : adminRole posé à "${ADMIN_ROLE}".`);
    granted += 1;
  }

  await prisma.$disconnect();
  console.info(`\n  ${granted} administrateur(s) opérationnel(s).`);

  if (pending.length) {
    console.info(
      `  ${pending.length} compte(s) à créer via /login : le rôle sera posé\n` +
        "  automatiquement au prochain déploiement.",
    );
  }
}

main().catch((err) => {
  console.error("\n  ÉCHEC du seed admin :", err instanceof Error ? err.message : err);
  process.exit(1);
});