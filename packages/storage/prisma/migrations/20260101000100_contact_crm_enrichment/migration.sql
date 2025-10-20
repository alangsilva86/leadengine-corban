-- Idempotent migration to enrich CRM contact data

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ContactLifecycleStage" AS ENUM ('LEAD', 'PROSPECT', 'CUSTOMER', 'PARTNER', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ContactSource" AS ENUM ('MANUAL', 'IMPORT', 'CAMPAIGN', 'CHAT', 'API', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ContactPhoneType" AS ENUM ('MOBILE', 'HOME', 'WORK', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ContactEmailType" AS ENUM ('WORK', 'PERSONAL', 'BILLING', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InteractionType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'MESSAGE', 'TASK', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InteractionChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'PHONE', 'MEETING', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskType" AS ENUM ('FOLLOW_UP', 'CALL', 'MEETING', 'EMAIL', 'CHECKIN', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "contacts_tenantId_phone_key";

-- DropIndex
DROP INDEX IF EXISTS "contacts_tenantId_email_key";

-- Update contacts columns
ALTER TABLE "contacts"
    DROP COLUMN IF EXISTS "email",
    DROP COLUMN IF EXISTS "phone",
    DROP COLUMN IF EXISTS "tags";

ALTER TABLE "contacts"
    ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "department" TEXT,
    ADD COLUMN IF NOT EXISTS "displayName" TEXT,
    ADD COLUMN IF NOT EXISTS "firstName" TEXT,
    ADD COLUMN IF NOT EXISTS "fullName" TEXT,
    ADD COLUMN IF NOT EXISTS "isVip" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "jobTitle" TEXT,
    ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastName" TEXT,
    ADD COLUMN IF NOT EXISTS "lifecycleStage" "ContactLifecycleStage" NOT NULL DEFAULT 'LEAD',
    ADD COLUMN IF NOT EXISTS "locale" TEXT,
    ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "organization" TEXT,
    ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
    ADD COLUMN IF NOT EXISTS "primaryEmail" TEXT,
    ADD COLUMN IF NOT EXISTS "primaryPhone" TEXT,
    ADD COLUMN IF NOT EXISTS "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "timezone" TEXT;

UPDATE "contacts"
SET "fullName" = COALESCE("name", '')
WHERE "fullName" IS NULL;

ALTER TABLE "contacts"
    ALTER COLUMN "fullName" SET NOT NULL;

ALTER TABLE "contacts"
    DROP COLUMN IF EXISTS "name";

-- CreateTable contact_phones
DO $$ BEGIN
    CREATE TABLE "contact_phones" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "phoneNumber" TEXT NOT NULL,
        "type" "ContactPhoneType",
        "label" TEXT,
        "waId" TEXT,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "contact_phones_pkey" PRIMARY KEY ("id")
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- CreateTable contact_emails
DO $$ BEGIN
    CREATE TABLE "contact_emails" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "type" "ContactEmailType",
        "label" TEXT,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "contact_emails_pkey" PRIMARY KEY ("id")
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- CreateTable tags
DO $$ BEGIN
    CREATE TABLE "tags" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "color" TEXT,
        "description" TEXT,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- CreateTable contact_tags
DO $$ BEGIN
    CREATE TABLE "contact_tags" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "tagId" TEXT NOT NULL,
        "addedById" TEXT,
        "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- CreateTable interactions
DO $$ BEGIN
    CREATE TABLE "interactions" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "type" "InteractionType" NOT NULL,
        "direction" "InteractionDirection" NOT NULL,
        "channel" "InteractionChannel",
        "subject" TEXT,
        "content" TEXT,
        "occurredAt" TIMESTAMP(3) NOT NULL,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "userId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- Ensure existing interactions table allows null channel values
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'interactions'
          AND column_name = 'channel'
    ) THEN
        ALTER TABLE "interactions"
        ALTER COLUMN "channel" DROP NOT NULL;
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
END $$;

-- CreateTable tasks
DO $$ BEGIN
    CREATE TABLE "tasks" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL,
        "type" "TaskType" NOT NULL,
        "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
        "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
        "title" TEXT NOT NULL,
        "description" TEXT,
        "dueDate" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "assigneeId" TEXT,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
    );
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_phones_tenantId_contactId_idx" ON "contact_phones"("tenantId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contact_phones_tenantId_phoneNumber_key" ON "contact_phones"("tenantId", "phoneNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_emails_tenantId_contactId_idx" ON "contact_emails"("tenantId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contact_emails_tenantId_email_key" ON "contact_emails"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tenantId_name_key" ON "tags"("tenantId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contact_tags_tenantId_tagId_idx" ON "contact_tags"("tenantId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_contactId_tagId_key" ON "contact_tags"("contactId", "tagId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "interactions_tenantId_contactId_idx" ON "interactions"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "interactions_tenantId_occurredAt_idx" ON "interactions"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tasks_tenantId_contactId_idx" ON "tasks"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tasks_tenantId_status_idx" ON "tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tasks_tenantId_assigneeId_idx" ON "tasks"("tenantId", "assigneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_fullName_idx" ON "contacts"("tenantId", "fullName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_primaryPhone_idx" ON "contacts"("tenantId", "primaryPhone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_primaryEmail_idx" ON "contacts"("tenantId", "primaryEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_status_idx" ON "contacts"("tenantId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_ownerId_idx" ON "contacts"("tenantId", "ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_tenantId_lifecycleStage_idx" ON "contacts"("tenantId", "lifecycleStage");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenantId_primaryPhone_key" ON "contacts"("tenantId", "primaryPhone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenantId_primaryEmail_key" ON "contacts"("tenantId", "primaryEmail");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contacts"
    ADD CONSTRAINT "contacts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_phones"
    ADD CONSTRAINT "contact_phones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_phones"
    ADD CONSTRAINT "contact_phones_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_emails"
    ADD CONSTRAINT "contact_emails_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_emails"
    ADD CONSTRAINT "contact_emails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "tags"
    ADD CONSTRAINT "tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_tags"
    ADD CONSTRAINT "contact_tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_tags"
    ADD CONSTRAINT "contact_tags_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_tags"
    ADD CONSTRAINT "contact_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "contact_tags"
    ADD CONSTRAINT "contact_tags_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "interactions"
    ADD CONSTRAINT "interactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "interactions"
    ADD CONSTRAINT "interactions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "interactions"
    ADD CONSTRAINT "interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
