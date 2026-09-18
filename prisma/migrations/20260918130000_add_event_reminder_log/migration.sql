-- Migration additive : EventReminderLog (relances automatiques J-3 / J-1 / H-1).
--
-- POURQUOI
-- Les événements n'ont aucun rappel automatique. Les membres oublient la date,
-- surtout quand l'événement est annoncé plusieurs jours à l'avance. Un cron
-- envoie 3 relances décalées, avec idempotence garantie par la contrainte
-- unique (eventId, offsetMinutes).
--
-- Écrite à la main pour la même raison que les migrations précédentes : dérive
-- préexistante de l'historique Prisma, pas de RESET souhaité.
--
-- Réversible : voir rollback en fin de fichier.

CREATE TABLE "EventReminderLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventReminderLog_eventId_offsetMinutes_key" ON "EventReminderLog"("eventId", "offsetMinutes");
CREATE INDEX "EventReminderLog_eventId_idx" ON "EventReminderLog"("eventId");
CREATE INDEX "EventReminderLog_createdAt_idx" ON "EventReminderLog"("createdAt");

ALTER TABLE "EventReminderLog" ADD CONSTRAINT "EventReminderLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- ALTER TABLE "EventReminderLog" DROP CONSTRAINT "EventReminderLog_eventId_fkey";
-- DROP TABLE "EventReminderLog";
