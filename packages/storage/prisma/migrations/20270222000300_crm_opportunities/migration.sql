BEGIN;

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('QUALIFICATION', 'PREPARATION', 'FOLLOW_UP', 'CLOSED');

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "ownerId" TEXT NOT NULL,
    "intentKey" TEXT NOT NULL,
    "agreementRef" TEXT NOT NULL,
    "employmentRef" TEXT NOT NULL,
    "productRef" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'QUALIFICATION',
    "version" INTEGER NOT NULL DEFAULT 1,
    "nextAction" TEXT NOT NULL,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_activities" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "opportunity_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_tenantId_contactId_idx" ON "opportunities"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "opportunities_tenantId_stage_updatedAt_idx" ON "opportunities"("tenantId", "stage", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_tenantId_intentKey_key" ON "opportunities"("tenantId", "intentKey");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_activities_opportunityId_version_key" ON "opportunity_activities"("opportunityId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenantId_id_key" ON "contacts"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_tenantId_id_key" ON "leads"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_id_key" ON "users"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenantId_contactId_fkey" FOREIGN KEY ("tenantId", "contactId") REFERENCES "contacts"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenantId_leadId_fkey" FOREIGN KEY ("tenantId", "leadId") REFERENCES "leads"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenantId_ownerId_fkey" FOREIGN KEY ("tenantId", "ownerId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
