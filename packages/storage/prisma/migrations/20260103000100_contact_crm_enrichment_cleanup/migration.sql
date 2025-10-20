-- Stage 3: cleanup legacy columns and enforce constraints for CRM enrichment

-- Remove duplicated primary phones/emails before applying unique constraints
WITH phone_dups AS (
    SELECT
        "tenantId",
        TRIM("primaryPhone") AS phone_value,
        MIN("id") AS keep_id
    FROM "contacts"
    WHERE "primaryPhone" IS NOT NULL
      AND TRIM("primaryPhone") <> ''
    GROUP BY "tenantId", TRIM("primaryPhone")
    HAVING COUNT(*) > 1
)
UPDATE "contacts" c
SET "primaryPhone" = NULL
FROM phone_dups d
WHERE c."tenantId" = d."tenantId"
  AND TRIM(c."primaryPhone") = d.phone_value
  AND c."id" <> d.keep_id;

WITH email_dups AS (
    SELECT
        "tenantId",
        LOWER(TRIM("primaryEmail")) AS email_value,
        MIN("id") AS keep_id
    FROM "contacts"
    WHERE "primaryEmail" IS NOT NULL
      AND TRIM("primaryEmail") <> ''
    GROUP BY "tenantId", LOWER(TRIM("primaryEmail"))
    HAVING COUNT(*) > 1
)
UPDATE "contacts" c
SET "primaryEmail" = NULL
FROM email_dups d
WHERE c."tenantId" = d."tenantId"
  AND LOWER(TRIM(c."primaryEmail")) = d.email_value
  AND c."id" <> d.keep_id;

-- Apply the same deduplication logic to contact_phones/contact_emails tables
WITH phone_table_dups AS (
    SELECT
        "tenantId",
        TRIM("phoneNumber") AS phone_value,
        MIN("id") AS keep_id
    FROM "contact_phones"
    WHERE TRIM("phoneNumber") <> ''
    GROUP BY "tenantId", TRIM("phoneNumber")
    HAVING COUNT(*) > 1
)
DELETE FROM "contact_phones" cp
USING phone_table_dups d
WHERE cp."tenantId" = d."tenantId"
  AND TRIM(cp."phoneNumber") = d.phone_value
  AND cp."id" <> d.keep_id;

WITH email_table_dups AS (
    SELECT
        "tenantId",
        LOWER(TRIM("email")) AS email_value,
        MIN("id") AS keep_id
    FROM "contact_emails"
    WHERE TRIM("email") <> ''
    GROUP BY "tenantId", LOWER(TRIM("email"))
    HAVING COUNT(*) > 1
)
DELETE FROM "contact_emails" ce
USING email_table_dups d
WHERE ce."tenantId" = d."tenantId"
  AND LOWER(TRIM(ce."email")) = d.email_value
  AND ce."id" <> d.keep_id;

-- Ensure every contact has a non-empty fullName before enforcing NOT NULL
UPDATE "contacts"
SET "fullName" = CONCAT('Contato ', "id")
WHERE "fullName" IS NULL OR TRIM("fullName") = '';

-- Drop legacy columns that are now superseded
ALTER TABLE "contacts"
    DROP COLUMN IF EXISTS "name",
    DROP COLUMN IF EXISTS "phone",
    DROP COLUMN IF EXISTS "email",
    DROP COLUMN IF EXISTS "tags";

-- Finalise column requirements
ALTER TABLE "contacts"
    ALTER COLUMN "fullName" SET NOT NULL;

-- Enforce uniqueness and add supporting indexes
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenantId_primaryPhone_key" ON "contacts"("tenantId", "primaryPhone");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenantId_primaryEmail_key" ON "contacts"("tenantId", "primaryEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_phones_tenantId_phoneNumber_key" ON "contact_phones"("tenantId", "phoneNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_emails_tenantId_email_key" ON "contact_emails"("tenantId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tenantId_name_key" ON "tags"("tenantId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_contact_tag_unique" ON "contact_tags"("contactId", "tagId");

-- Maintain helpful non-unique indexes
CREATE INDEX IF NOT EXISTS "contacts_tenantId_fullName_idx" ON "contacts"("tenantId", "fullName");
CREATE INDEX IF NOT EXISTS "contacts_tenantId_status_idx" ON "contacts"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "contacts_tenantId_ownerId_idx" ON "contacts"("tenantId", "ownerId");
CREATE INDEX IF NOT EXISTS "contacts_tenantId_lifecycleStage_idx" ON "contacts"("tenantId", "lifecycleStage");

-- Clean up legacy indexes that referenced removed columns
DROP INDEX IF EXISTS "contacts_tenantId_phone_key";
DROP INDEX IF EXISTS "contacts_tenantId_email_key";
