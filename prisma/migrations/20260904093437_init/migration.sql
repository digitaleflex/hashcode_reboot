-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "gender" TEXT,
    "primaryDomain" TEXT NOT NULL,
    "secondaryDomains" TEXT NOT NULL DEFAULT '[]',
    "domainSpecialty" TEXT NOT NULL DEFAULT '[]',
    "level" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "goalProjectStage" TEXT,
    "goalSituation" TEXT,
    "availability" TEXT NOT NULL,
    "availabilityTimes" TEXT,
    "learningStyle" TEXT NOT NULL,
    "mentoringInterest" TEXT,
    "mentoringMaybeReason" TEXT,
    "mentoringTypes" TEXT NOT NULL DEFAULT '[]',
    "mentoringFrequency" TEXT,
    "mentoringDomain" TEXT,
    "budgetWillingness" TEXT,
    "budgetRange" TEXT,
    "threeMonthGoal" TEXT,
    "profileArchetype" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "profileStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "communityStatus" TEXT NOT NULL DEFAULT 'NOT_INVITED',
    "accessLane" TEXT NOT NULL DEFAULT 'immediate',
    "adminNote" TEXT,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "sessionId" TEXT,
    "memberId" TEXT,
    "ref" TEXT,
    "value" INTEGER,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_email_idx" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Member_country_idx" ON "Member"("country");

-- CreateIndex
CREATE INDEX "Member_primaryDomain_idx" ON "Member"("primaryDomain");

-- CreateIndex
CREATE INDEX "Member_profileStatus_idx" ON "Member"("profileStatus");

-- CreateIndex
CREATE INDEX "Member_communityStatus_idx" ON "Member"("communityStatus");

-- CreateIndex
CREATE INDEX "Member_createdAt_idx" ON "Member"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_idx" ON "AnalyticsEvent"("type");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
