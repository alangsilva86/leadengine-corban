-- CreateTable ai_configs
CREATE TABLE "ai_configs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "queueId" TEXT,
  "scopeKey" TEXT NOT NULL DEFAULT '__global__',
  "model" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  "maxOutputTokens" INTEGER,
  "systemPromptReply" TEXT,
  "systemPromptSuggest" TEXT,
  "structuredOutputSchema" JSONB,
  "tools" JSONB,
  "vectorStoreEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "vectorStoreIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "streamingEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "defaultMode" TEXT NOT NULL DEFAULT 'COPILOTO',
  "confidenceThreshold" DOUBLE PRECISION,
  "fallbackPolicy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_configs_tenant_scope_unique" ON "ai_configs"("tenantId", "scopeKey");
CREATE INDEX "ai_configs_queue_idx" ON "ai_configs"("queueId");

ALTER TABLE "ai_configs"
  ADD CONSTRAINT "ai_configs_tenant_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_configs"
  ADD CONSTRAINT "ai_configs_queue_fkey"
  FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ai_suggestions
CREATE TABLE "ai_suggestions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "configId" TEXT,
  "payload" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_suggestions_conversation_idx" ON "ai_suggestions"("tenantId", "conversationId");

ALTER TABLE "ai_suggestions"
  ADD CONSTRAINT "ai_suggestions_tenant_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_suggestions"
  ADD CONSTRAINT "ai_suggestions_config_fkey"
  FOREIGN KEY ("configId") REFERENCES "ai_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ai_runs
CREATE TABLE "ai_runs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "configId" TEXT,
  "runType" TEXT NOT NULL,
  "adapter" TEXT,
  "requestPayload" JSONB NOT NULL,
  "responsePayload" JSONB,
  "latencyMs" INTEGER,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "costUsd" NUMERIC(10,6),
  "status" TEXT NOT NULL DEFAULT 'success',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_runs_conversation_idx" ON "ai_runs"("tenantId", "conversationId", "runType");

ALTER TABLE "ai_runs"
  ADD CONSTRAINT "ai_runs_tenant_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_runs"
  ADD CONSTRAINT "ai_runs_config_fkey"
  FOREIGN KEY ("configId") REFERENCES "ai_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ai_memories
CREATE TABLE "ai_memories" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_memories_unique_topic" ON "ai_memories"("tenantId", "contactId", "topic");
CREATE INDEX "ai_memories_contact_idx" ON "ai_memories"("tenantId", "contactId");

ALTER TABLE "ai_memories"
  ADD CONSTRAINT "ai_memories_tenant_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_memories"
  ADD CONSTRAINT "ai_memories_contact_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
