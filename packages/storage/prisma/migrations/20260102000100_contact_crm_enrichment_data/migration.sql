-- Stage 2: migrate existing contact data into the new CRM structures

-- Populate primary name fields
UPDATE "contacts"
SET
    "fullName" = COALESCE(NULLIF("fullName", ''), COALESCE("name", '')),
    "displayName" = COALESCE("displayName", "name"),
    "primaryPhone" = CASE
        WHEN "primaryPhone" IS NULL OR TRIM("primaryPhone") = '' THEN NULLIF(TRIM("phone"), '')
        ELSE "primaryPhone"
    END,
    "primaryEmail" = CASE
        WHEN "primaryEmail" IS NULL OR TRIM("primaryEmail") = '' THEN NULLIF(TRIM("email"), '')
        ELSE "primaryEmail"
    END,
    "lastActivityAt" = COALESCE("lastActivityAt", "lastInteractionAt")
WHERE "fullName" IS NULL
   OR "fullName" = ''
   OR "displayName" IS NULL
   OR "primaryPhone" IS NULL AND "phone" IS NOT NULL
   OR "primaryEmail" IS NULL AND "email" IS NOT NULL
   OR "lastActivityAt" IS NULL AND "lastInteractionAt" IS NOT NULL;

-- Ensure metadata/default columns stay consistent
UPDATE "contacts"
SET "metadata" = '{}'::jsonb
WHERE "metadata" IS NULL;

-- Seed contact_phones from legacy phone column
INSERT INTO "contact_phones" (
    "id",
    "tenantId",
    "contactId",
    "phoneNumber",
    "type",
    "label",
    "waId",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('primary-phone-', c."id"),
    c."tenantId",
    c."id",
    TRIM(c."phone"),
    NULL,
    NULL,
    NULL,
    TRUE,
    c."createdAt",
    COALESCE(c."updatedAt", CURRENT_TIMESTAMP)
FROM "contacts" c
WHERE c."phone" IS NOT NULL
  AND TRIM(c."phone") <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM "contact_phones" cp
      WHERE cp."contactId" = c."id"
        AND cp."isPrimary" = TRUE
  );

-- Seed contact_emails from legacy email column
INSERT INTO "contact_emails" (
    "id",
    "tenantId",
    "contactId",
    "email",
    "type",
    "label",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('primary-email-', c."id"),
    c."tenantId",
    c."id",
    TRIM(c."email"),
    NULL,
    NULL,
    TRUE,
    c."createdAt",
    COALESCE(c."updatedAt", CURRENT_TIMESTAMP)
FROM "contacts" c
WHERE c."email" IS NOT NULL
  AND TRIM(c."email") <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM "contact_emails" ce
      WHERE ce."contactId" = c."id"
        AND ce."isPrimary" = TRUE
  );

-- Materialise legacy tag array into tags/contact_tags tables
WITH tag_source AS (
    SELECT
        c."id"          AS contact_id,
        c."tenantId"    AS tenant_id,
        unnest(c."tags") AS tag_value
    FROM "contacts" c
    WHERE c."tags" IS NOT NULL
      AND array_length(c."tags", 1) > 0
), distinct_tags AS (
    SELECT
        tenant_id,
        TRIM(tag_value) AS tag_name
    FROM tag_source
    WHERE TRIM(tag_value) <> ''
    GROUP BY tenant_id, TRIM(tag_value)
)
INSERT INTO "tags" (
    "id",
    "tenantId",
    "name",
    "color",
    "description",
    "isSystem",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('tag_', md5(dt.tenant_id || ':' || dt.tag_name)),
    dt.tenant_id,
    dt.tag_name,
    NULL,
    NULL,
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM distinct_tags dt
ON CONFLICT ("id") DO NOTHING;

WITH tag_map AS (
    SELECT
        c."id"          AS contact_id,
        c."tenantId"    AS tenant_id,
        unnest(c."tags") AS raw_tag
    FROM "contacts" c
    WHERE c."tags" IS NOT NULL
      AND array_length(c."tags", 1) > 0
), prepared AS (
    SELECT
        tm.contact_id,
        tm.tenant_id,
        TRIM(tm.raw_tag) AS tag_name,
        CONCAT('tag_', md5(tm.tenant_id || ':' || TRIM(tm.raw_tag))) AS tag_id
    FROM tag_map tm
    WHERE TRIM(tm.raw_tag) <> ''
)
INSERT INTO "contact_tags" (
    "id",
    "tenantId",
    "contactId",
    "tagId",
    "addedById",
    "addedAt"
)
SELECT
    CONCAT('contact-tag_', md5(p.contact_id || ':' || p.tag_id)),
    p.tenant_id,
    p.contact_id,
    p.tag_id,
    NULL,
    CURRENT_TIMESTAMP
FROM prepared p
JOIN "tags" t ON t."id" = p.tag_id
ON CONFLICT ("id") DO NOTHING;

-- Align tasks table with new columns if legacy schema already existed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'dueDate'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'dueAt'
    ) THEN
        ALTER TABLE "tasks" RENAME COLUMN "dueDate" TO "dueAt";
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'metadata'
    ) THEN
        -- nothing to do
        NULL;
    ELSE
        ALTER TABLE "tasks" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Ensure interactions table allows nullable channel for backward compatibility
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
END $$;
