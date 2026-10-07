-- Migration additive : index composite pour le garde-fou de quota email
-- (Perf-5, src/lib/email-budget.ts).
--
-- POURQUOI
-- `getBudget` / `getAllBudgets` comptent les envois du jour avec le filtre
-- (type = 'email.sent', provider, createdAt >= début du jour UTC). Les index
-- existants ([type], [provider, createdAt]) forcent Postgres à combiner deux
-- parcours (bitmap heap scan) ; le composite (type, provider, createdAt)
-- répond en une seule passe d'index.
--
-- Écrite à la main, comme les migrations précédentes (historique non RESET).
-- Additive et sûre à rejouer (IF NOT EXISTS).
--
-- Réversible : voir rollback en fin de fichier.

CREATE INDEX IF NOT EXISTS "EmailEvent_type_provider_createdAt_idx" ON "EmailEvent"("type", "provider", "createdAt");

-- ── Rollback ─────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS "EmailEvent_type_provider_createdAt_idx";
