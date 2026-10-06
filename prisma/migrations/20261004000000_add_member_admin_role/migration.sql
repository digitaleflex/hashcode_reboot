-- Migration additive : Member.adminRole (source unique du rôle admin).
--
-- POURQUOI
-- L'accès admin était résolu depuis des variables d'environnement
-- (ADMIN_OPERATORS / ADMIN_VIEWERS + alias historique ADMIN_EMAILS).
-- Désormais, `Member.adminRole` est la seule source de vérité :
-- "operator" (accès complet) | "viewer" (lecture seule) | null (ordinaire).
--
-- Colonne nullable sans défaut : les 227 membres existants restent à null
-- (= pas admin, fail-closed). Le rôle initial de l'admin est posé par
-- scripts/seed-admin-role.ts (upsert idempotent par email).
--
-- Note : `prisma migrate dev` / `migrate diff --from-migrations` ne peuvent
-- pas rejouer l'historique en shadow DB (migration 20260918130000 suppose la
-- table Event, cf. migration unlockOverride). SQL généré par
-- `prisma migrate diff --from-schema-datasource`, réduit à la seule colonne
-- de cette tâche (le reste du diff reflète une dérive pré-existante,
-- hors périmètre). Réversible : voir rollback en fin de fichier.

ALTER TABLE "Member" ADD COLUMN "adminRole" TEXT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- ALTER TABLE "Member" DROP COLUMN "adminRole";
