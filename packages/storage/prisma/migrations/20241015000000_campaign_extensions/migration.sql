-- Add new campaign classification columns
ALTER TABLE "campaigns"
  ADD COLUMN "productType" TEXT,
  ADD COLUMN "marginType" TEXT,
  ADD COLUMN "strategy" TEXT;

-- Ensure structured metadata
ALTER TABLE "campaigns"
  ALTER COLUMN "metadata" SET DEFAULT '{}'::JSONB;

UPDATE "campaigns"
SET "metadata" = '{}'::JSONB
WHERE "metadata" IS NULL;

ALTER TABLE "campaigns"
  ALTER COLUMN "metadata" SET NOT NULL;

-- Add tags column with default empty array
ALTER TABLE "campaigns"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Drop constraint enforcing single campaign per instance
DROP INDEX IF EXISTS "campaigns_tenant_agreement_instance_unique";

-- New supporting indexes for filtering
CREATE INDEX IF NOT EXISTS "campaigns_tenant_instance_idx"
  ON "campaigns"("tenantId", "whatsappInstanceId");

CREATE INDEX IF NOT EXISTS "campaigns_tenant_product_type_idx"
  ON "campaigns"("tenantId", "productType");

CREATE INDEX IF NOT EXISTS "campaigns_tenant_margin_type_idx"
  ON "campaigns"("tenantId", "marginType");

CREATE INDEX IF NOT EXISTS "campaigns_tenant_strategy_idx"
  ON "campaigns"("tenantId", "strategy");
