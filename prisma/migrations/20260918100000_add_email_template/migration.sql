-- Migration additive (Phase 1 templates email).
-- Ecrite manuellement : la base presente une derive preexistante (colonnes et
-- index pousses via `db push`, historique de migrations incomplet) et
-- `prisma migrate dev` proposait un RESET destructeur. Cette migration ne fait
-- qu AJOUTER une table, elle est donc sans risque.
--
-- Le corps du mail est stocke en HTML (`bodyHtml`), exactement comme le
-- fragment `inner` de src/lib/mail.ts, afin que l apercu admin soit
-- byte-identique a l email reellement envoye.
-- Reversible : DROP TABLE "EmailTemplate";

CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");
CREATE INDEX "EmailTemplate_category_idx" ON "EmailTemplate"("category");
CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");
