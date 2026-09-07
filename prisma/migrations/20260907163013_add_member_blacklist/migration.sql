-- CreateTable
CREATE TABLE "MemberBlacklist" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "autoAdded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MemberBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberBlacklist_email_key" ON "MemberBlacklist"("email");

-- CreateIndex
CREATE INDEX "MemberBlacklist_email_idx" ON "MemberBlacklist"("email");

-- CreateIndex
CREATE INDEX "MemberBlacklist_expiresAt_idx" ON "MemberBlacklist"("expiresAt");

-- CreateIndex
CREATE INDEX "MemberBlacklist_reason_idx" ON "MemberBlacklist"("reason");
