-- Enhance messages table for outbound WhatsApp support
ALTER TABLE "messages"
  ADD COLUMN "instanceId" TEXT,
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "mediaFileName" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

-- Indexes to optimise lookups by instance and ticket chronology
CREATE INDEX IF NOT EXISTS "messages_instance_created_idx" ON "messages"("instanceId", "createdAt");
CREATE INDEX IF NOT EXISTS "messages_ticket_created_idx" ON "messages"("ticketId", "createdAt");

-- Unique constraints used for broker reconciliation and idempotent retries
CREATE UNIQUE INDEX IF NOT EXISTS "messages_tenant_external_id_unique" ON "messages"("tenantId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "messages_tenant_idempotency_key_unique" ON "messages"("tenantId", "idempotencyKey");
