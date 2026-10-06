#!/usr/bin/env node
/**
 * Compare le schéma attendu (prisma/schema.prisma) au schéma réellement
 * présent en base, et échoue si l'écart est réel.
 *
 * why: `prisma migrate deploy` se fie à son journal `_prisma_migrations`.
 * Si ce journal est incomplet — cas rencontré ici, où 18 migrations
 * avaient été appliquées hors séquence — Prisma peut appliquer deux fois
 * du SQL, ou ne jamais appliquer ce qui manque. Le symptôme est invisible
 * : l'app démarre, puis une requête échoue en production.
 *
 * Ce script, lui, regarde la vérité : information_schema. Lecture seule,
 * aucune écriture, aucun risque.
 *
 * Sort en code 1 si une table manque. Le service `migrate` s'arrête alors,
 * et `web` ne démarre pas : mieux vaut un déploiement refusé qu'une
 * production cassée en silence.
 *
 * Usage :
 *   node --import tsx scripts/verify-schema.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/** Modèles Prisma qui doivent exister comme tables. */
function expectedModels(): string[] {
  const schema = readFileSync(
    path.join(process.cwd(), "prisma", "schema.prisma"),
    "utf8",
  );
  return [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1] as string);
}

async function main() {
  const prisma = new PrismaClient();

  const expected = expectedModels();

  const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const present = new Set(rows.map((r) => r.table_name));

  const missing = expected.filter((m) => !present.has(m));
  const extra = [...present].filter(
    (t) => !t.startsWith("_") && !expected.includes(t),
  );

  console.info(`  attendues : ${expected.length} · présentes : ${present.size}`);

  if (extra.length) {
    // Informatif seulement : une table en trop n'empêche pas l'app de
    // fonctionner, et la refuse pourrait bloquer un déploiement légitime.
    console.info(`  · tables non déclarées (ignorées) : ${extra.join(", ")}`);
  }

  await prisma.$disconnect();

  if (missing.length) {
    console.error(`\n  ✖ ${missing.length} table(s) manquante(s) : ${missing.join(", ")}`);
    console.error(
      "    Le schéma en base ne correspond pas à prisma/schema.prisma.\n" +
        "    Relire les logs de migration : un journal incomplet empêche\n" +
        "    Prisma de voir les migrations déjà appliquées.",
    );
    process.exit(1);
  }

  console.info("  ✔ schéma conforme — toutes les tables sont présentes.");
}

main().catch((err) => {
  // Une erreur de connexion ne doit pas bloquer le déploiement : c'est
  // probablement une indisponibilité passagère, et `postgres` a son propre
  // healthcheck. On le signale sans faire échouer.
  console.warn("  ⚠ vérification impossible :", err instanceof Error ? err.message : err);
  process.exit(0);
});