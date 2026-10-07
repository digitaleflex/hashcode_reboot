-- Rattrapage : colonnes et index presents dans schema.prisma mais jamais migres.
--
-- Le modele Member a gagne les champs d'invitation (invitationStatus,
-- invitedAt, refusedAt, refusedReason, bouncedAt, invitationClicks,
-- lastClickedAt) et userEmail directement dans le schema, sans migration
-- correspondante — meme derive que les 7 tables core rattrapees par
-- 20260918125000_add_auth_and_event_core. Consequence en production :
-- prisma.member.create() echouait en P2022 (column does not exist), donc
-- aucune inscription n'etait possible.
--
-- Additif et sans risque : invitationStatus porte un defaut, les autres
-- colonnes sont nullables. Aucune donnee existante n'est affectee.
-- Les index des deux autres tables sont eux aussi purement additifs.

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "invitationClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invitationStatus" TEXT NOT NULL DEFAULT 'NOT_INVITED',
ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "lastClickedAt" TIMESTAMP(3),
ADD COLUMN     "refusedAt" TIMESTAMP(3),
ADD COLUMN     "refusedReason" TEXT,
ADD COLUMN     "userEmail" TEXT;

-- CreateIndex
CREATE INDEX "EmailProviderMetric_provider_createdAt_idx" ON "EmailProviderMetric"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "EmailProviderMetric_date_idx" ON "EmailProviderMetric"("date");

-- CreateIndex
CREATE INDEX "Member_invitationStatus_idx" ON "Member"("invitationStatus");
