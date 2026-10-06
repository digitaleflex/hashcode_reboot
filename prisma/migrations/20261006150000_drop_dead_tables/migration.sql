-- D36 — Suppression des trois tables mortes.
--
-- MemberSession : doublon de l'ère pré-Better Auth (magic link par OTP).
--   Plus AUCUN écrivain applicatif depuis la migration Better Auth : les
--   sessions vivent dans "Session", qui est peuplée. Ses deux lecteurs
--   lisaient donc une table vide :
--     - admin/activity-logins -> DAU à 0, affiché comme un vrai chiffre
--     - account/export         -> `sessions: []`, export RGPD incomplet
--   Les deux routes ont été basculées sur "Session" AVANT ce DROP : les deux
--   valeurs redeviennent justes, et le DROP ne laisse pas un trou.
--
-- AdminKey : la rotation de clés admin a disparu (l'admin est porté par Better
--   Auth, allow-lists ADMIN_OPERATORS/ADMIN_VIEWERS). Zéro accès dans le repo.
--
-- RateLimit : créé par la migration D07 pour rester aligné sur le schéma, mais
--   Better Auth n'a AUCUNE option `rateLimit` dans src/lib/auth/index.ts et le
--   rate limiting applicatif est Redis (src/lib/rate-limit.ts). Jamais écrit.
--
-- Les trois tables sont sans dépendance entrante (aucune vue, aucune FK qui les
-- référence) : le DROP emporte ses index et, pour "MemberSession", sa contrainte
-- `MemberSession_memberId_fkey` vers "Member".
--
-- ✅ MIGRATION VÉRIFIÉE CONTRE UNE BASE (2026-10-06, après coup).
-- Rédigée sans base disponible, puis vérifiée comme toute migration D07 :
--   • 23 migrations appliquées sur une base PostgreSQL 16 neuve, vide
--     (`prisma migrate deploy`) → aucune erreur ;
--   • les 3 tables absentes de `pg_tables` après coup ;
--   • `Session` toujours présente, 30 tables au total ;
--   • `prisma migrate diff --from-url <base migrée> --to-schema-datamodel
--     prisma/schema.prisma` ne renvoie QUE « This is an empty migration ».
-- Le `IF EXISTS` reste : rien ne garantit que les trois tables soient toutes
-- présentes en production, qui a été amenée par `prisma db push`
-- (`RateLimit` n'existait pas avant D07).
--
-- ⚠️ Si `RateLimit` devait être réintroduite plus tard, il faudra retirer la
-- ligne correspondante de prisma/schema.prisma ET de src/lib/auth/index.ts dans
-- le même changement : Better Auth la recréerait par `db push`.

-- DropTable
DROP TABLE IF EXISTS "MemberSession";

-- DropTable
DROP TABLE IF EXISTS "AdminKey";

-- DropTable
DROP TABLE IF EXISTS "RateLimit";
