-- D07 (1/2) — Tables "Event" et "EventRsvp" absentes des migrations.
--
-- Déclarées dans prisma/schema.prisma, créées par AUCUNE migration. Elles
-- existent en production par un accident de parcours : `prisma db push`
-- (package.json:12) sur la base Neon existante, jamais converti en migration.
--
-- Conséquence VÉRIFIÉE par test réel (base neuve, migrate deploy) :
--   P3018 « relation "Event" does not exist »
--   à 20260918130000_add_event_reminder_log, qui pose une clé étrangère
--   EventReminderLog.eventId -> Event.id.
--
-- ─── Pourquoi cette migration est datée 20260918125000 ───────────────────────
-- Prisma déploie dans l'ordre des timestamps. "Event" est référencée pour la
-- première fois par 20260918130000_add_event_reminder_log : la créer après
-- cette migration est impossible. Cette migration est donc insérée juste
-- AVANT elle.
--
-- Créer la table dans sa forme COMPLÈTE (état actuel du schéma) est sans
-- risque ici : aucune migration ne modifie ensuite les colonnes de "Event" —
-- seules des clés étrangères d'autres tables pointent vers elle.

-- ─── Pourquoi cette migration est IDEMPOTENTE ─────────────────────────────────
-- Le SQL strict produit par `prisma migrate diff --from-empty` échouerait sur la
-- base de production, où ces tables existent déjà, avec « relation already
-- exists ». On aurait alors remplacé un schéma non reproductible par un
-- pipeline de déploiement cassé — deux problèmes au lieu d'un.
--
-- D'où les trois garde-fous :
--   • CREATE TABLE IF NOT EXISTS        — les tables
--   • CREATE INDEX IF NOT EXISTS        — les index
--   • DO $$ … IF NOT EXISTS (pg_constraint) $$ — les clés étrangères
--
-- ─── Ce que cette migration ne fait PAS ──────────────────────────────────────
-- Elle ne RÉCONCILIE PAS une dérive de colonnes là où la table existe déjà :
-- IF NOT EXISTS court-circuite. Corriger une dérive de colonnes exige de
-- comparer l'état réel puis d'écrire un ALTER TABLE explicite ; c'est tracé
-- séparément.
--
-- Généré par : prisma migrate diff --from-empty --to-schema-datamodel
--               prisma/schema.prisma --script, filtré sur les tables ci-dessus.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "url" TEXT,
    "type" TEXT NOT NULL DEFAULT 'session',
    "domain" TEXT,
    "level" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "recurrence" TEXT,
    "recurrenceId" TEXT,
    "maxAttendees" INTEGER,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE IF NOT EXISTS "EventRsvp" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'going',
    "note" TEXT,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_startsAt_idx" ON "Event"("startsAt");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_type_idx" ON "Event"("type");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_recurrenceId_idx" ON "Event"("recurrenceId");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventRsvp_eventId_idx" ON "EventRsvp"("eventId");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventRsvp_memberId_idx" ON "EventRsvp"("memberId");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventRsvp_status_idx" ON "EventRsvp"("status");


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventRsvp_eventId_memberId_key" ON "EventRsvp"("eventId", "memberId");


-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventRsvp_eventId_fkey') THEN
        ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventRsvp_memberId_fkey') THEN
        ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

