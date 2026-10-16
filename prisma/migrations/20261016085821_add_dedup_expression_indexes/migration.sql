-- Déduplication #103 : index d'expression + partiel (Prisma ne les génère pas).
-- 1) Email normalisé (trim + minuscules) UNIQUE sur les actifs : interdit les
--    doublons de casse à la source (les écritures normalisent déjà via Zod).
--    Les soft-deleted sont exclus : réinscription possible après suppression.
-- 2) Téléphone normalisé (séparateurs retirés) : détection AMBIGU en SQL.
CREATE UNIQUE INDEX "Member_normalized_email_key"
  ON "Member"(LOWER(TRIM("email")))
  WHERE "deletedAt" IS NULL;

CREATE INDEX "Member_normalized_phone_idx"
  ON "Member"(regexp_replace("phone", '[\s\-().]', '', 'g'))
  WHERE "phone" IS NOT NULL AND "deletedAt" IS NULL;
