-- Migration additive : Member.customTags — tags libres posés par l'admin (#102).
--
-- POURQUOI
-- Les tags auto (profiling engine.ts tagsFor, colonne Member.tags) restent
-- gérés par le système. Les tags libres vivent dans leur propre colonne
-- pour ne jamais être écrasés par une réécriture de `tags` (le POST
-- /api/members et complete-profile n'écrivent que `tags`).
--
-- Même convention que les autres listes : String JSON string[], défaut "[]",
-- normalisés côté API (trim, minuscules, vides retirés, dédupliqués,
-- max 20 tags, 40 caractères chacun — cf. PATCH /api/members/[id]).
--
-- Colonne NOT NULL avec défaut '[]' : les membres existants démarrent sans
-- tag libre. Réversible : voir rollback en fin de fichier.

ALTER TABLE "Member" ADD COLUMN "customTags" TEXT NOT NULL DEFAULT '[]';

-- ── Rollback ─────────────────────────────────────────────────────────────
-- ALTER TABLE "Member" DROP COLUMN "customTags";
