-- CreateTable
CREATE TABLE "MemberSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,
    "otpHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberSession_memberId_idx" ON "MemberSession"("memberId");

-- CreateIndex
CREATE INDEX "MemberSession_expiresAt_idx" ON "MemberSession"("expiresAt");

-- CreateIndex
CREATE INDEX "MemberSession_revokedAt_idx" ON "MemberSession"("revokedAt");

-- AddForeignKey
ALTER TABLE "MemberSession" ADD CONSTRAINT "MemberSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
