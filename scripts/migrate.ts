#!/usr/bin/env node
/**
 * Point d'entrée central pour les scripts CLI (`scripts/*.ts`).
 *
 * Pourquoi : chaque script importait `PrismaClient`, `node:fs`, `node:path`
 * ou des helpers de `src/lib/` depuis son propre chemin. Ajouter un script
 * exigeait de retrouver ces chemins, et changer un chemin `src/lib/` forçait
 * à toucher chaque script. Désormais les scripts TS importent d'ici, et ce
 * module ré-exporte les utilitaires partagés (aucune logique métier ici).
 *
 * Ce module ne fait QUE ré-exporter : le comportement des scripts est
 * inchangé. Les scripts `.mjs` historiques (one-shot, autonomes sans tsx)
 * et `.sh` sont volontairement exclus — ils ne peuvent pas importer du TS
 * sans chargeur, et les réécrire casserait leur usage documenté.
 *
 * Usage dans un script :
 *   import { PrismaClient, collectMetrics, renderCrontab } from "./migrate";
 */

export { PrismaClient } from "@prisma/client";

// Singleton Prisma partagé de l'app (préférable à `new PrismaClient()` pour
// les futurs scripts ; les scripts existants gardent leur `new PrismaClient()`
// + `$disconnect()` inchangés).
export { db } from "../src/lib/db";

// Métriques e-mail (utilisé par `collect-email-metrics.ts` et la route
// `GET /api/cron/collect-metrics`).
export {
  collectBrevo,
  collectMetrics,
  collectResend,
  formatDateForApi,
  upsertMetric,
  yesterdayUTC,
} from "../src/lib/email-metrics";
export type {
  MetricsProvider,
  ProviderMetrics,
} from "../src/lib/email-metrics";

// Registre unique des crons (utilisé par `generate-crontab.ts`).
export {
  CRON_COMMANDS,
  CRON_HEALTH,
  CRON_JOBS,
  CRON_MANUAL,
  renderCrontab,
} from "../src/lib/cron/registry";
export type {
  CronCommand,
  CronHealthRow,
  CronJob,
} from "../src/lib/cron/registry";

// Helpers `node:` les plus utilisés par les scripts (lecture/écriture de
// fichiers, manipulation de chemins). Ré-exportés pour éviter de dupliquer
// les chemins `node:fs` / `node:path` dans chaque script.
export { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
export { path };
export { basename, dirname, join, resolve } from "node:path";
