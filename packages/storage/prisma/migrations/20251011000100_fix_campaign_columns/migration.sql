-- Align campaigns table with Prisma schema (startDate/endDate/defaults).

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

UPDATE "campaigns"
SET "startDate" = COALESCE("startDate", "createdAt")
WHERE "startDate" IS NULL;

UPDATE "campaigns"
SET "status" = lower("status")
WHERE "status" IS NOT NULL;

ALTER TABLE "campaigns"
  ALTER COLUMN "status" SET DEFAULT 'draft';

UPDATE "campaigns"
SET "agreementId" = COALESCE("agreementId", 'unknown')
WHERE "agreementId" IS NULL;

ALTER TABLE "campaigns"
  ALTER COLUMN "agreementId" SET NOT NULL;
