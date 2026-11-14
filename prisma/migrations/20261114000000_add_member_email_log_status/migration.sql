-- Ajout du statut d'envoi (sent/failed) à MemberEmailLog.
-- Colonne NOT NULL avec valeur par défaut : les lignes existantes sont
-- marquées "sent" automatiquement, sans perte de données.
ALTER TABLE "MemberEmailLog"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'sent';

CREATE INDEX "MemberEmailLog_status_idx" ON "MemberEmailLog"("status");
