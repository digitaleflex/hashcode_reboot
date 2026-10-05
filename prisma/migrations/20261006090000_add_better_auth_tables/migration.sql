-- D07 (2/2) — Tables Better Auth absentes des migrations.
--
-- User, Session, Account, Verification, RateLimit : déclarées dans
-- prisma/schema.prisma, créées par AUCUNE migration. Elles n'existent en
-- production que par `prisma db push` (package.json:12) sur la base Neon
-- existante.
--
-- Conséquence VÉRIFIÉE par test réel : sur une base neuve, une fois "Event"
-- créée, Better Auth échouait ensuite faute de ces 5 tables — aucune
-- authentification possible. Ni installation locale, ni staging, ni reprise
-- après incident n'étaient faisables.
--
-- Date non contrainte par l'ordre des migrations : aucune migration existante
-- ne référence ces tables.

-- ─── Pourquoi cette migration est IDEMPOTENTE ─────────────────────────────────
-- Le SQL strict produit par `prisma migrate diff --from-empty` échouerait sur la
-- base de production, où ces tables existent déjà, avec « relation already
-- exists ». On aurait alors remplacé un schéma non reproductible par un
-- pipeline de déploiement cassé — deux problèmes au lieu d'un.
--
-- D'où les trois garde-fous :
--   • CREATE TABLE IF NOT EXISTS        — les tables
--   • CREATE INDEX IF NOT EXISTS        — les index
--   • DO $$ … IF NOT EXISTS (pg_constraint) $$ — les clés étrangères
--
-- ─── Ce que cette migration ne fait PAS ──────────────────────────────────────
-- Elle ne RÉCONCILIE PAS une dérive de colonnes là où la table existe déjà :
-- IF NOT EXISTS court-circuite. Corriger une dérive de colonnes exige de
-- comparer l'état réel puis d'écrire un ALTER TABLE explicite ; c'est tracé
-- séparément.
--
-- Généré par : prisma migrate diff --from-empty --to-schema-datamodel
--               prisma/schema.prisma --script, filtré sur les tables ci-dessus.

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memberEmail" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE IF NOT EXISTS "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE IF NOT EXISTS "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_memberEmail_key" ON "User"("memberEmail");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_memberEmail_idx" ON "User"("memberEmail");


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session"("token");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Verification_identifier_idx" ON "Verification"("identifier");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "Verification_expiresAt_idx" ON "Verification"("expiresAt");


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_key_key" ON "RateLimit"("key");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "RateLimit_key_idx" ON "RateLimit"("key");


-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
        ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
        ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Verification_userId_fkey') THEN
        ALTER TABLE "Verification" ADD CONSTRAINT "Verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

