-- CreateTable
CREATE TABLE "AdminKey" (
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "passcodeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "AdminKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminKey_kid_key" ON "AdminKey"("kid");

-- CreateIndex
CREATE INDEX "AdminKey_kid_idx" ON "AdminKey"("kid");

-- CreateIndex
CREATE INDEX "AdminKey_revokedAt_idx" ON "AdminKey"("revokedAt");

-- CreateIndex
CREATE INDEX "AdminKey_expiresAt_idx" ON "AdminKey"("expiresAt");
