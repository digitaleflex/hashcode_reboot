#!/usr/bin/env node
/**
 * Générateur de crontab depuis le registre unique (`src/lib/cron/registry.ts`).
 *
 * Pourquoi : les crons sont planifiés par crond dans le conteneur `cron`
 * (voir compose.yml, Lane B) — ce script est la seule chose autorisée à
 * produire le fichier crontab, pour qu'ajouter un job = modifier le registre.
 *
 * Contrat CLI (figé, appelé depuis le conteneur — ne pas changer) :
 * - `node --import tsx scripts/generate-crontab.ts` → crontab sur stdout, exit 0
 * - `node --import tsx scripts/generate-crontab.ts --out <fichier>` → écrit
 *   dans le fichier (crée les répertoires si besoin), exit 0
 * - `node --import tsx scripts/generate-crontab.ts --check <fichier>` →
 *   exit 0 si le fichier est à jour, exit 1 s'il diffère (deploy/CI)
 *
 * Le rendu est déterministe (voir `renderCrontab`) : deux runs produisent
 * octet pour octet le même fichier, sinon `--check` serait inutilisable.
 */

// Import direct du registre, PAS via `./migrate` : ce script tourne dans
// l'image `cron` dont la base est `postgres:16-alpine`, où il n'y a ni
// `@prisma/client` ni le reste de `src/lib`. `./migrate` ré-exporte
// `PrismaClient` et `src/lib/db`, donc l'importer ici faisait échouer le
// conteneur au boot sur « Cannot find module '@prisma/client' » — pour rien,
// car `renderCrontab` est une fonction pure et n'a besoin d'aucune base.
// `registry.ts` n'a lui-même aucun import.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { renderCrontab } from "../src/lib/cron/registry";

function usage(): never {
  console.error(
    "Usage : node --import tsx scripts/generate-crontab.ts [--out <fichier> | --check <fichier>]",
  );
  process.exit(2);
}

function main(): void {
  const args = process.argv.slice(2);
  const rendered = renderCrontab();

  if (args.length === 0) {
    process.stdout.write(rendered);
    return;
  }

  if (args.length === 2 && args[0] === "--out" && args[1]) {
    const out = args[1];
    // Le conteneur monte un volume dédié : le chemin parent peut ne pas exister.
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, rendered, "utf8");
    console.error(`[generate-crontab] crontab écrit : ${out}`);
    return;
  }

  if (args.length === 2 && args[0] === "--check" && args[1]) {
    const file = args[1];
    let current: string;
    try {
      current = readFileSync(file, "utf8");
    } catch {
      console.error(`[generate-crontab] MANQUANT : ${file} (régénérer avec --out)`);
      process.exit(1);
    }
    if (current !== rendered) {
      console.error(
        `[generate-crontab] OBSOLÈTE : ${file} diffère du registre (régénérer avec --out)`,
      );
      process.exit(1);
    }
    console.error(`[generate-crontab] OK : ${file} à jour`);
    return;
  }

  usage();
}

main();
