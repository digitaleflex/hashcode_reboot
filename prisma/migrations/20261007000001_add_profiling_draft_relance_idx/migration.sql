-- Migration additive : index composite pour le cron relance J+7
-- (GET /api/cron/relance, quotidien).
--
-- POURQUOI
-- Le cron filtre ProfilingDraft sur (completedAt NULL, relanceSentAt NULL,
-- createdAt <= J-7) trié par createdAt ASC. Sans index composite, chaque run
-- fait un seq scan + tri ; avec le filtre en base (corrige le take-50 puis
-- filtre JS qui ignorait les vieux au-delà de 50), le nom d'index suit la
-- convention Prisma (Model_champs_idx) pour éviter toute dérive avec
-- `prisma validate`.
--
-- Écrite à la main, comme les migrations précédentes (historique non RESET).
-- Additive et sûre à rejouer (IF NOT EXISTS).
--
-- Réversible : voir rollback en fin de fichier.

CREATE INDEX IF NOT EXISTS "ProfilingDraft_completedAt_relanceSentAt_createdAt_idx" ON "ProfilingDraft"("completedAt", "relanceSentAt", "createdAt");

-- ── Rollback ─────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS "ProfilingDraft_completedAt_relanceSentAt_createdAt_idx";
