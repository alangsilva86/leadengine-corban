-- CreateEnum
CREATE TYPE "LeadAllocationStatus" AS ENUM ('allocated', 'contacted', 'won', 'lost');

-- AlterTable
ALTER TABLE "campaigns"
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "endDate" TIMESTAMP(3),
  ALTER COLUMN "status" SET DEFAULT 'draft';

UPDATE "campaigns" SET "agreementId" = COALESCE("agreementId", 'unknown');
UPDATE "campaigns" SET "startDate" = COALESCE("startDate", "createdAt") WHERE "startDate" IS NULL;
UPDATE "campaigns" SET "status" = lower("status");

-- CreateTable broker_leads
CREATE TABLE "broker_leads" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "matricula" TEXT,
  "phone" TEXT,
  "registrations" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "margin" DOUBLE PRECISION,
  "netMargin" DOUBLE PRECISION,
  "score" DOUBLE PRECISION,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broker_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "broker_leads_tenant_document_unique" ON "broker_leads"("tenantId", "document");

-- CreateTable lead_allocations
CREATE TABLE "lead_allocations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "status" "LeadAllocationStatus" NOT NULL DEFAULT 'allocated',
  "notes" TEXT,
  "payload" JSONB,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_allocations_unique_key" ON "lead_allocations"("tenantId", "leadId", "campaignId");
CREATE INDEX "lead_allocations_status_idx" ON "lead_allocations"("tenantId", "campaignId", "status");

-- Add campaign composite uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_tenant_agreement_instance_unique"
  ON "campaigns"("tenantId", "agreementId", "whatsappInstanceId");

-- AddForeignKeys
ALTER TABLE "lead_allocations"
  ADD CONSTRAINT "lead_allocations_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "broker_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_allocations"
  ADD CONSTRAINT "lead_allocations_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
