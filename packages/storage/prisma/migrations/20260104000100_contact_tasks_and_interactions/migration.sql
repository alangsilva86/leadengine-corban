-- Introduce dedicated CRM interaction/task entities

-- CreateEnum
CREATE TYPE "ContactInteractionChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE', 'WEB', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactInteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ContactTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contact_interactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "ContactInteractionChannel" NOT NULL,
    "direction" "ContactInteractionDirection" NOT NULL DEFAULT 'INBOUND',
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "ContactTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigneeId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_interactions_tenant_contact_occurred_idx"
  ON "contact_interactions"("tenantId", "contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "contact_tasks_tenant_contact_status_idx"
  ON "contact_tasks"("tenantId", "contactId", "status");

-- AddForeignKey
ALTER TABLE "contact_interactions"
  ADD CONSTRAINT "contact_interactions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_interactions"
  ADD CONSTRAINT "contact_interactions_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tasks"
  ADD CONSTRAINT "contact_tasks_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tasks"
  ADD CONSTRAINT "contact_tasks_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tasks"
  ADD CONSTRAINT "contact_tasks_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
