CREATE TABLE "inbound_webhook_jobs" (
  "sequence" BIGSERIAL NOT NULL,
  "eventKey" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inbound_webhook_jobs_pkey" PRIMARY KEY ("sequence")
);

CREATE UNIQUE INDEX "inbound_webhook_jobs_eventKey_key" ON "inbound_webhook_jobs"("eventKey");
CREATE INDEX "inbound_webhook_jobs_nextAttemptAt_sequence_idx" ON "inbound_webhook_jobs"("nextAttemptAt", "sequence");
CREATE INDEX "inbound_webhook_conversation_idx" ON "inbound_webhook_jobs"("tenantId", "instanceId", "conversationId", "sequence");
