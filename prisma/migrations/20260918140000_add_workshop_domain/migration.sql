-- Migration additive : domaine pédagogique ATELIERS (11 modèles).
--
-- POURQUOI
-- Aucun modèle pédagogique n'existait : le programme « Maîtrise GitHub »
-- vivait en 12 Events avec le contenu noyé dans description. Ateliers apporte
-- Workshop → Week → Session → activités/livrable/quiz → submission → review
-- → validation → progression → unlock. Cf. docs/ateliers/00-audit-phase1.md §21
-- et docs/ateliers/adr-001-decisions.md (D1 : progression dérivée, pas de table).
--
-- Écrite à la main pour la même raison que les migrations précédentes : dérive
-- préexistante de l'historique Prisma (replay shadow DB impossible), pas de
-- RESET souhaité. Appliquée via `prisma migrate deploy`.
--
-- ADDITIF PUR : 11 CREATE TABLE nouvelles, zéro modification de table existante
-- (seules les back-relations Prisma sur Member/Event sont déclaratives).
-- Réversible : voir rollback en fin de fichier.

CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "domain" TEXT,
    "level" TEXT,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workshop_slug_key" ON "Workshop"("slug");
CREATE INDEX "Workshop_status_idx" ON "Workshop"("status");

CREATE TABLE "WorkshopWeek" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workshopId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,

    CONSTRAINT "WorkshopWeek_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopWeek_workshopId_number_key" ON "WorkshopWeek"("workshopId", "number");
CREATE INDEX "WorkshopWeek_workshopId_idx" ON "WorkshopWeek"("workshopId");

ALTER TABLE "WorkshopWeek" ADD CONSTRAINT "WorkshopWeek_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "weekId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "program" TEXT,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "deliverableRequired" BOOLEAN NOT NULL DEFAULT true,
    "quizRequired" BOOLEAN NOT NULL DEFAULT true,
    "eventId" TEXT,

    CONSTRAINT "WorkshopSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopSession_weekId_number_key" ON "WorkshopSession"("weekId", "number");
CREATE INDEX "WorkshopSession_weekId_idx" ON "WorkshopSession"("weekId");
CREATE INDEX "WorkshopSession_eventId_idx" ON "WorkshopSession"("eventId");

ALTER TABLE "WorkshopSession" ADD CONSTRAINT "WorkshopSession_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "WorkshopWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopSession" ADD CONSTRAINT "WorkshopSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WorkshopActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'practice',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,

    CONSTRAINT "WorkshopActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkshopActivity_sessionId_order_idx" ON "WorkshopActivity"("sessionId", "order");

ALTER TABLE "WorkshopActivity" ADD CONSTRAINT "WorkshopActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkshopSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopDeliverable" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'url',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkshopDeliverable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopDeliverable_sessionId_key" ON "WorkshopDeliverable"("sessionId");

ALTER TABLE "WorkshopDeliverable" ADD CONSTRAINT "WorkshopDeliverable_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkshopSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopSubmission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "WorkshopSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopSubmission_deliverableId_memberId_attempt_key" ON "WorkshopSubmission"("deliverableId", "memberId", "attempt");
CREATE INDEX "WorkshopSubmission_memberId_idx" ON "WorkshopSubmission"("memberId");
CREATE INDEX "WorkshopSubmission_deliverableId_status_idx" ON "WorkshopSubmission"("deliverableId", "status");

ALTER TABLE "WorkshopSubmission" ADD CONSTRAINT "WorkshopSubmission_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "WorkshopDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopSubmission" ADD CONSTRAINT "WorkshopSubmission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopReview" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionId" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,

    CONSTRAINT "WorkshopReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkshopReview_submissionId_idx" ON "WorkshopReview"("submissionId");

ALTER TABLE "WorkshopReview" ADD CONSTRAINT "WorkshopReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "WorkshopSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopQuiz" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passThreshold" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkshopQuiz_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopQuiz_sessionId_key" ON "WorkshopQuiz"("sessionId");

ALTER TABLE "WorkshopQuiz" ADD CONSTRAINT "WorkshopQuiz_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkshopSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopQuestion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "correctJson" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WorkshopQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkshopQuestion_quizId_order_idx" ON "WorkshopQuestion"("quizId", "order");

ALTER TABLE "WorkshopQuestion" ADD CONSTRAINT "WorkshopQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "WorkshopQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopQuizAttempt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "quizId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopQuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkshopQuizAttempt_quizId_memberId_idx" ON "WorkshopQuizAttempt"("quizId", "memberId");
CREATE INDEX "WorkshopQuizAttempt_memberId_idx" ON "WorkshopQuizAttempt"("memberId");

ALTER TABLE "WorkshopQuizAttempt" ADD CONSTRAINT "WorkshopQuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "WorkshopQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopQuizAttempt" ADD CONSTRAINT "WorkshopQuizAttempt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkshopEnrollment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workshopId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopEnrollment_workshopId_memberId_key" ON "WorkshopEnrollment"("workshopId", "memberId");
CREATE INDEX "WorkshopEnrollment_memberId_idx" ON "WorkshopEnrollment"("memberId");

ALTER TABLE "WorkshopEnrollment" ADD CONSTRAINT "WorkshopEnrollment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopEnrollment" ADD CONSTRAINT "WorkshopEnrollment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Rollback (ordre inverse des dépendances) ─────────────────────────────
-- ALTER TABLE "WorkshopEnrollment" DROP CONSTRAINT "WorkshopEnrollment_workshopId_fkey";
-- ALTER TABLE "WorkshopEnrollment" DROP CONSTRAINT "WorkshopEnrollment_memberId_fkey";
-- DROP TABLE "WorkshopEnrollment";
-- ALTER TABLE "WorkshopQuizAttempt" DROP CONSTRAINT "WorkshopQuizAttempt_quizId_fkey";
-- ALTER TABLE "WorkshopQuizAttempt" DROP CONSTRAINT "WorkshopQuizAttempt_memberId_fkey";
-- DROP TABLE "WorkshopQuizAttempt";
-- ALTER TABLE "WorkshopQuestion" DROP CONSTRAINT "WorkshopQuestion_quizId_fkey";
-- DROP TABLE "WorkshopQuestion";
-- ALTER TABLE "WorkshopQuiz" DROP CONSTRAINT "WorkshopQuiz_sessionId_fkey";
-- DROP TABLE "WorkshopQuiz";
-- ALTER TABLE "WorkshopReview" DROP CONSTRAINT "WorkshopReview_submissionId_fkey";
-- DROP TABLE "WorkshopReview";
-- ALTER TABLE "WorkshopSubmission" DROP CONSTRAINT "WorkshopSubmission_deliverableId_fkey";
-- ALTER TABLE "WorkshopSubmission" DROP CONSTRAINT "WorkshopSubmission_memberId_fkey";
-- DROP TABLE "WorkshopSubmission";
-- ALTER TABLE "WorkshopDeliverable" DROP CONSTRAINT "WorkshopDeliverable_sessionId_fkey";
-- DROP TABLE "WorkshopDeliverable";
-- ALTER TABLE "WorkshopActivity" DROP CONSTRAINT "WorkshopActivity_sessionId_fkey";
-- DROP TABLE "WorkshopActivity";
-- ALTER TABLE "WorkshopSession" DROP CONSTRAINT "WorkshopSession_weekId_fkey";
-- ALTER TABLE "WorkshopSession" DROP CONSTRAINT "WorkshopSession_eventId_fkey";
-- DROP TABLE "WorkshopSession";
-- ALTER TABLE "WorkshopWeek" DROP CONSTRAINT "WorkshopWeek_workshopId_fkey";
-- DROP TABLE "WorkshopWeek";
-- DROP TABLE "Workshop";
