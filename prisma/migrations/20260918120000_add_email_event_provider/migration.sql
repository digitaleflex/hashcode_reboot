-- Migration additive : colonne `provider` sur EmailEvent.
--
-- POURQUOI
-- EmailEvent est le SEUL registre écrit à chaque envoi réussi (Resend comme
-- Brevo), c'est donc la base du garde-fou de quota en temps réel. Sans cette
-- colonne, il ne dit pas quel provider a accepté l'envoi : un compteur global
-- ne peut pas protéger deux quotas distincts (Brevo 300/j, Resend 100/j), et
-- ne verrait pas la bascule automatique de l'un vers l'autre.
--
-- Écrite à la main : la base présente une dérive préexistante (colonnes et
-- index poussés via `db push`, historique de migrations incomplet) et
-- `prisma migrate dev` proposait un RESET destructeur. Cette migration ne fait
-- qu'AJOUTER une colonne nullable et un index : sans effet sur les lignes
-- existantes, qui restent à NULL (= « provider inconnu, envoi antérieur »).
--
-- Réversible : voir la section rollback en fin de fichier.

ALTER TABLE "EmailEvent" ADD COLUMN "provider" TEXT;

CREATE INDEX "EmailEvent_provider_createdAt_idx" ON "EmailEvent"("provider", "createdAt");

-- ── Rollback ─────────────────────────────────────────────────────────────
-- DROP INDEX "EmailEvent_provider_createdAt_idx";
-- ALTER TABLE "EmailEvent" DROP COLUMN "provider";
