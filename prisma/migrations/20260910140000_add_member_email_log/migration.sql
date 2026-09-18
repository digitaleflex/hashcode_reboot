-- CreateTable
CREATE TABLE "MemberEmailLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT,
    "providerId" TEXT,

    CONSTRAINT "MemberEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberEmailLog_memberId_idx" ON "MemberEmailLog"("memberId");
CREATE INDEX "MemberEmailLog_kind_idx" ON "MemberEmailLog"("kind");
CREATE INDEX "MemberEmailLog_memberId_kind_idx" ON "MemberEmailLog"("memberId", "kind");
CREATE INDEX "MemberEmailLog_createdAt_idx" ON "MemberEmailLog"("createdAt");

-- AddForeignKey
ALTER TABLE "MemberEmailLog" ADD CONSTRAINT "MemberEmailLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
