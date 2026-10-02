-- Migration additive : WorkshopSession.unlockOverride (déblocage admin).
--
-- POURQUOI
-- Le verrou d'une séance est la conjonction de deux gates : la chaîne
-- séquentielle (séance précédente COMPLETED) et le gate calendaire
-- (scheduledAt / startsAt de l'Event lié). Aucun moyen pour un admin
-- d'ouvrir une séance en avance — typiquement quand une séance est reliée
-- à un événement dont la date bouge, ou pour une session de rattrapage.
--
-- `unlockOverride = true` ouvre la séance pour TOUS les membres, en
-- PRIMANT sur les deux verrous. L'état pédagogique calculé (NOT_STARTED,
-- SUBMITTED, …) reste inchangé : seul le verrou est levé.
--
-- Écrite à la main : historique non rejouable en shadow DB (cf. migrations
-- précédentes). Réversible : voir rollback en fin de fichier.
--
-- Défaut false = comportement existant strictement préservé.

ALTER TABLE "WorkshopSession" ADD COLUMN "unlockOverride" BOOLEAN NOT NULL DEFAULT false;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- ALTER TABLE "WorkshopSession" DROP COLUMN "unlockOverride";
