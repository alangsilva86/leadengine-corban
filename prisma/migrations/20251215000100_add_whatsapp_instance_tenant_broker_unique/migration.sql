-- Enforce uniqueness of WhatsApp brokers per tenant while preserving global broker uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_instances_tenantId_brokerId_key" ON "whatsapp_instances"("tenantId", "brokerId");
