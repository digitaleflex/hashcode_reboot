-- CreateTable
CREATE TABLE "EmailProviderMetric" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "complained" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "uniqueOpened" INTEGER NOT NULL DEFAULT 0,
    "uniqueClicked" INTEGER NOT NULL DEFAULT 0,
    "hardBounce" INTEGER NOT NULL DEFAULT 0,
    "softBounce" INTEGER NOT NULL DEFAULT 0,
    "deliveryRate" DOUBLE PRECISION,
    "openRate" DOUBLE PRECISION,
    "clickRate" DOUBLE PRECISION,
    "bounceRate" DOUBLE PRECISION,
    "complaintRate" DOUBLE PRECISION,

    CONSTRAINT "EmailProviderMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailProviderMetric_provider_date_key" ON "EmailProviderMetric"("provider", "date");
