-- Historique des évaluations d'orientation (#155, #147). Append-only.
CREATE TABLE "ProfileSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "dynamicVersion" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "archetypesJson" TEXT NOT NULL,
    "effectiveLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "nextBestActionId" TEXT,
    CONSTRAINT "ProfileSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProfileSnapshot_memberId_createdAt_idx" ON "ProfileSnapshot"("memberId", "createdAt");
CREATE INDEX "ProfileSnapshot_status_idx" ON "ProfileSnapshot"("status");
ALTER TABLE "ProfileSnapshot" ADD CONSTRAINT "ProfileSnapshot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
