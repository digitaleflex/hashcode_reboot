-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_ref_idx" ON "AnalyticsEvent"("type", "ref");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_sessionId_idx" ON "AnalyticsEvent"("type", "sessionId");
