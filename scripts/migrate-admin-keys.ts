/**
 * Migration AdminKey (passcode partagé) → comptes admin nominatifs.
 *
 * Ce script NE crée PAS de comptes directement : il crée une INVITATION par
 * clé admin active. Chaque personne recevant l'invitation active ensuite son
 * compte (mot de passe + 2FA) via le lien email — le secret partagé n'est
 * jamais reporté dans le nouveau système, et la preuve d'email garantit
 * qu'une personne réelle est derrière chaque compte.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/migrate-admin-keys.ts            # crée les invitations
 *   node --env-file=.env --import tsx scripts/migrate-admin-keys.ts --dry-run  # aperçu sans écriture
 *
 * Les emails cibles se renseignent dans KNOWN_KEY_EMAILS (kid → email) :
 * sans correspondance, l'invitation part sur une adresse placeholder à
 * rattacher ensuite via l'UI admin.
 */

import { randomBytes, createHash } from "node:crypto";
import { PrismaClient } from "./migrate";

const db = new PrismaClient();

/** Mapping clé kid → email réel. À compléter avant la vraie migration. */
const KNOWN_KEY_EMAILS: Record<string, string> = {
  // "kid-1234": "awa@hashcode.fr",
};

const INVITATION_TTL_DAYS = 7;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const adminKeys = await db.adminKey.findMany({
    where: {
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
  });

  if (adminKeys.length === 0) {
    console.log("Aucune clé admin active — rien à migrer.");
    return;
  }

  console.log(
    `\n${adminKeys.length} clé(s) admin active(s) trouvée(s)${dryRun ? " (DRY RUN)" : ""} :\n`,
  );

  for (const key of adminKeys) {
    const targetEmail = KNOWN_KEY_EMAILS[key.kid]?.trim().toLowerCase();
    const email =
      targetEmail ?? `legacy-${key.kid}@admins.hashcode.invalid`;
    const placeholder = !targetEmail;

    const existingInvitation = await db.adminInvitation.findUnique({ where: { email } });
    const existingUser = await db.adminUser.findUnique({ where: { email } });
    if (existingInvitation || existingUser) {
      console.log(`  ⏭️  ${key.kid} → ${email} : déjà migré(e).`);
      continue;
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    if (!dryRun) {
      await db.adminInvitation.create({
        data: {
          email,
          name: `Admin (${key.kid})`,
          // Les clés legacy donnaient un accès complet ⇒ operator.
          role: "operator",
          tokenHash,
          expiresAt,
          invitedBy: "migration:admin-keys",
        },
      });
    }

    const setupUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/admin/setup?token=${token}`;

    console.log(`  ✅ ${key.kid} → ${email} (operator)${placeholder ? "  [PLACEHOLDER — à rattacher]" : ""}`);
    if (!dryRun) {
      console.log(`     Lien d'activation : ${setupUrl}`);
    }
  }

  console.log(
    dryRun
      ? "\nDry run terminé — aucune écriture. Relance sans --dry-run pour créer les invitations.\n"
      : "\nMigration terminée. Les destinataires ont 7 jours pour activer leur compte (mot de passe + 2FA).\n",
  );
}

main()
  .catch((e) => {
    console.error("Migration échouée :", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
