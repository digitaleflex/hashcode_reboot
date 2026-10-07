-- Migration additive : MemberNote — notes datées posées par les admins (#100).
--
-- POURQUOI
-- Member.adminNote est un singleton écrasé à chaque écriture (champ + UI
-- conservés tels quels). Les notes datées sont un historique append-only :
-- une ligne par note, avec auteur et horodatage, jamais écrasée.
-- AuditLog est inutilisable pour ça (metadata opaque, pas de lecture).
--
-- Patron copié : MemberEmailLog (FK memberId + onDelete Cascade + index).
-- Contenu borné côté API (trim, 1-2000 caractères — cf. POST
-- /api/members/[id]/notes). Table vide à la création, rien à migrer.
-- Réversible : voir rollback en fin de fichier.

CREATE TABLE "MemberNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "memberId" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  CONSTRAINT "MemberNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberNote_memberId_idx" ON "MemberNote"("memberId");
CREATE INDEX "MemberNote_memberId_createdAt_idx" ON "MemberNote"("memberId", "createdAt");
CREATE INDEX "MemberNote_createdAt_idx" ON "MemberNote"("createdAt");

-- ── Rollback ─────────────────────────────────────────────────────────────
-- DROP TABLE "MemberNote";
