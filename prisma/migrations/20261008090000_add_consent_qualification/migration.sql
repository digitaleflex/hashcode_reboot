-- Migration additive : Consent + Qualification, index Member.source,
-- ProfilingDraft.sessionId/sourceUTM (#210, phase 1 — schéma seul, moteur en
-- phase 2).
--
-- POURQUOI
-- Le RGPD exige un historique horodaté des choix de consentement (finalité,
-- choix, version du texte, preuve de contexte) : Consent est append-only,
-- sans FK dure vers Member (pattern maison User.memberEmail — un consentement
-- cookies peut précéder toute inscription). Le consentement courant se lit au
-- dernier createdAt pour (email, purpose), d'où l'index composite.
-- Qualification historise chaque calcul du moteur de profiling (plusieurs
-- lignes par membre, JAMAIS @unique sur memberId — le courant = dernier
-- createdAt) avec la version du moteur pour tracer les recalculs.
-- Member.source reçoit son index (filtre acquisition, pas de table
-- LeadSource — normalisation en phase 2). ProfilingDraft gagne sessionId
-- (rattachement au parcours, même sens que AnalyticsEvent.sessionId) et
-- sourceUTM (UTM d'entrée, redondance assumée avec Member.source qui n'existe
-- qu'après complétion).
--
-- SQL généré par `prisma migrate diff` sur shadow DB éphémère (rejeu complet
-- de l'historique OK), habillé aux conventions maison (en-tête POURQUOI +
-- rollback, PK inline comme MemberNote). Tables vides à la création,
-- colonnes NULLABLE : rien à migrer, 100 % additive.
--
-- Réversible : voir rollback en fin de fichier.

-- ── Consent (nouveau) ────────────────────────────────────────────────────
CREATE TABLE "Consent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "memberId" TEXT,
  "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "choice" TEXT NOT NULL,
  "textVersion" TEXT NOT NULL,
  "proof" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Consent_email_purpose_createdAt_idx" ON "Consent"("email", "purpose", "createdAt");

-- ── Qualification (nouveau) ──────────────────────────────────────────────
CREATE TABLE "Qualification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "memberId" TEXT NOT NULL,
  "archetype" TEXT,
  "scores" JSONB,
  "confidence" DOUBLE PRECISION,
  "reasons" JSONB,
  "engineVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Qualification_memberId_createdAt_idx" ON "Qualification"("memberId", "createdAt");

-- ── Member.source (index seul) ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Member_source_idx" ON "Member"("source");

-- ── ProfilingDraft (2 colonnes NULLABLE + index) ─────────────────────────
ALTER TABLE "ProfilingDraft" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "ProfilingDraft" ADD COLUMN "sourceUTM" TEXT;

CREATE INDEX "ProfilingDraft_sessionId_idx" ON "ProfilingDraft"("sessionId");

-- ── Rollback ─────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS "ProfilingDraft_sessionId_idx";
-- ALTER TABLE "ProfilingDraft" DROP COLUMN "sourceUTM";
-- ALTER TABLE "ProfilingDraft" DROP COLUMN "sessionId";
-- DROP INDEX IF EXISTS "Member_source_idx";
-- DROP INDEX IF EXISTS "Qualification_memberId_createdAt_idx";
-- DROP TABLE "Qualification";
-- DROP INDEX IF EXISTS "Consent_email_purpose_createdAt_idx";
-- DROP TABLE "Consent";
