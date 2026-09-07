-- CreateTable
CREATE TABLE "ProfilingDraft" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "lastQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "relanceSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProfilingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfilingDraft_email_key" ON "ProfilingDraft"("email");

-- CreateIndex
CREATE INDEX "ProfilingDraft_createdAt_idx" ON "ProfilingDraft"("createdAt");

-- CreateIndex
CREATE INDEX "ProfilingDraft_completedAt_idx" ON "ProfilingDraft"("completedAt");

-- CreateIndex
CREATE INDEX "ProfilingDraft_relanceSentAt_idx" ON "ProfilingDraft"("relanceSentAt");
