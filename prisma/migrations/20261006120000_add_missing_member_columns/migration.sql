-- D07 (3/3) — Colonnes et index déclarés dans schema.prisma mais absents
-- de toutes les migrations.
--
-- Constat mesuré, pas supposé. Après ajout des 7 tables manquantes (D07 1/2 et
-- 2/2), un `prisma migrate deploy` sur base NEUVE produisait encore un schéma
-- différent de prisma/schema.prisma. Reste à créer :
--
--   • Member : 8 colonnes (bouncedAt, invitationClicks, invitationStatus,
--     invitedAt, lastClickedAt, refusedAt, refusedReason, userEmail)
--   • EmailProviderMetric : 2 index (provider+createdAt, date)
--   • Member : 1 index (invitationStatus)
--
-- Conséquence avant correctif : sur une base neuve ou reconstituée,
-- `prisma generate` produisait des types exposant des champs absents de la
-- base. Toute lecture de Member.invitationStatus / bouncedAt / refusedAt
-- échouait à l'exécution.
--
-- ─── Source ───────────────────────────────────────────────────────────────────
-- `prisma migrate diff --from-url <base migrée> --to-schema-datamodel
-- prisma/schema.prisma --script`, c'est-à-dire le delta exact entre ce que les
-- migrations produisent et ce que le schéma déclare. Aucune colonne n'est
-- inventée : le diff est la définition même de l'écart.
--
-- ─── Idempotence ─────────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS : sur la base de
-- production, où ces colonnes existent déjà, la migration passe sans erreur au
-- lieu de faire échouer le déploiement.

-- AlterTable
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "bouncedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "invitationClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "invitationStatus" TEXT NOT NULL DEFAULT 'NOT_INVITED',
ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastClickedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "refusedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "refusedReason" TEXT,
ADD COLUMN IF NOT EXISTS "userEmail" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailProviderMetric_provider_createdAt_idx" ON "EmailProviderMetric"("provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailProviderMetric_date_idx" ON "EmailProviderMetric"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Member_invitationStatus_idx" ON "Member"("invitationStatus");
