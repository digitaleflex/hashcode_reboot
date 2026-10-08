-- Migration additive : champs de qualification acquisition sur Qualification
-- existante (#211 Lead Qualification V1, bornée C1 — AUCUNE table créée).
--
-- POURQUOI
-- #211 fige un snapshot de qualification d'entrée (score / statut / version
-- de règle) à chaque complétion, en complément de la décision existante
-- runAutoControls (lane immédiate vs revue humaine) et des lignes
-- Qualification "orientation" (moteur, engineVersion "1.1.0"). Le discriminant
-- des deux écritures est le préfixe "acq-" de ruleVersion (lignes acquisition
-- : engineVersion = ruleVersion = "acq-qualif-1.0.0", archetype NULL explicite
-- — aucun archétype produit côté acquisition). Lecture du courant : dernier
-- createdAt + filtre ruleVersion LIKE 'acq-%' (documenté dans
-- docs/acquisition-contracts.md § Qualification acquisition).
-- Colonnes NULLABLE : lignes orientation existantes untouched (NULL),
-- 100 % additive, rejouable.
--
-- Réversible : voir rollback en fin de fichier.

ALTER TABLE "Qualification" ADD COLUMN "qualificationScore" DOUBLE PRECISION;
ALTER TABLE "Qualification" ADD COLUMN "status" TEXT;
ALTER TABLE "Qualification" ADD COLUMN "ruleVersion" TEXT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- ALTER TABLE "Qualification" DROP COLUMN "ruleVersion";
-- ALTER TABLE "Qualification" DROP COLUMN "status";
-- ALTER TABLE "Qualification" DROP COLUMN "qualificationScore";
