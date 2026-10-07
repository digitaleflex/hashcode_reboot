-- Migration additive : index composites pour le cron event-reminders
-- (GET /api/cron/event-reminders, toutes les 15 minutes).
--
-- POURQUOI
-- Le cron filtre Event sur (startsAt, status, notifiedAt) et Member sur
-- (profileStatus, deletedAt). Sans index composites, chaque run fait des
-- seq scans / bitmap combinés ; avec la boucle par événement d'avant, le
-- coût se multipliait. Les noms d'index suivent la convention Prisma
-- (Model_champs_idx) pour éviter toute dérive avec `prisma validate`.
--
-- Écrite à la main, comme les migrations précédentes (historique non RESET).
-- Additive et sûre à rejouer (IF NOT EXISTS).
--
-- Réversible : voir rollback en fin de fichier.

CREATE INDEX IF NOT EXISTS "Event_startsAt_status_notifiedAt_idx" ON "Event"("startsAt", "status", "notifiedAt");
CREATE INDEX IF NOT EXISTS "Member_profileStatus_deletedAt_idx" ON "Member"("profileStatus", "deletedAt");

-- ── Rollback ─────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS "Event_startsAt_status_notifiedAt_idx";
-- DROP INDEX IF EXISTS "Member_profileStatus_deletedAt_idx";
