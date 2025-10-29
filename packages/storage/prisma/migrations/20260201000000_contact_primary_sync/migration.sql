-- Ensure single primary phone/email per contact
CREATE UNIQUE INDEX IF NOT EXISTS "contact_phones_contact_primary_unique"
  ON "contact_phones"("contactId")
  WHERE "isPrimary";

CREATE UNIQUE INDEX IF NOT EXISTS "contact_emails_contact_primary_unique"
  ON "contact_emails"("contactId")
  WHERE "isPrimary";

-- Function to synchronize contact primary phone from contact_phones
CREATE OR REPLACE FUNCTION sync_contact_primary_phone() RETURNS TRIGGER AS $$
DECLARE
  next_primary TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."isPrimary" THEN
      UPDATE "contacts"
        SET "primaryPhone" = NEW."phoneNumber"
      WHERE "id" = NEW."contactId";
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW."contactId" <> OLD."contactId" THEN
      IF OLD."isPrimary" THEN
        SELECT cp."phoneNumber"
          INTO next_primary
        FROM "contact_phones" cp
        WHERE cp."contactId" = OLD."contactId" AND cp."isPrimary"
        ORDER BY cp."updatedAt" DESC, cp."createdAt" DESC
        LIMIT 1;

        UPDATE "contacts"
          SET "primaryPhone" = next_primary
        WHERE "id" = OLD."contactId";
      END IF;

      IF NEW."isPrimary" THEN
        UPDATE "contacts"
          SET "primaryPhone" = NEW."phoneNumber"
        WHERE "id" = NEW."contactId";
      END IF;

      RETURN NEW;
    END IF;

    IF NEW."isPrimary" THEN
      IF NOT OLD."isPrimary" OR NEW."phoneNumber" IS DISTINCT FROM OLD."phoneNumber" THEN
        UPDATE "contacts"
          SET "primaryPhone" = NEW."phoneNumber"
        WHERE "id" = NEW."contactId";
      END IF;
    ELSIF OLD."isPrimary" AND NOT NEW."isPrimary" THEN
      SELECT cp."phoneNumber"
        INTO next_primary
      FROM "contact_phones" cp
      WHERE cp."contactId" = NEW."contactId" AND cp."isPrimary"
      ORDER BY cp."updatedAt" DESC, cp."createdAt" DESC
      LIMIT 1;

      UPDATE "contacts"
        SET "primaryPhone" = next_primary
      WHERE "id" = NEW."contactId";
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."isPrimary" THEN
      SELECT cp."phoneNumber"
        INTO next_primary
      FROM "contact_phones" cp
      WHERE cp."contactId" = OLD."contactId" AND cp."isPrimary"
      ORDER BY cp."updatedAt" DESC, cp."createdAt" DESC
      LIMIT 1;

      UPDATE "contacts"
        SET "primaryPhone" = next_primary
      WHERE "id" = OLD."contactId";
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "contact_phones_sync_primary" ON "contact_phones";
CREATE TRIGGER "contact_phones_sync_primary"
AFTER INSERT OR UPDATE OR DELETE ON "contact_phones"
FOR EACH ROW EXECUTE FUNCTION sync_contact_primary_phone();

-- Function to synchronize contact primary email from contact_emails
CREATE OR REPLACE FUNCTION sync_contact_primary_email() RETURNS TRIGGER AS $$
DECLARE
  next_primary TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."isPrimary" THEN
      UPDATE "contacts"
        SET "primaryEmail" = NEW."email"
      WHERE "id" = NEW."contactId";
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW."contactId" <> OLD."contactId" THEN
      IF OLD."isPrimary" THEN
        SELECT ce."email"
          INTO next_primary
        FROM "contact_emails" ce
        WHERE ce."contactId" = OLD."contactId" AND ce."isPrimary"
        ORDER BY ce."updatedAt" DESC, ce."createdAt" DESC
        LIMIT 1;

        UPDATE "contacts"
          SET "primaryEmail" = next_primary
        WHERE "id" = OLD."contactId";
      END IF;

      IF NEW."isPrimary" THEN
        UPDATE "contacts"
          SET "primaryEmail" = NEW."email"
        WHERE "id" = NEW."contactId";
      END IF;

      RETURN NEW;
    END IF;

    IF NEW."isPrimary" THEN
      IF NOT OLD."isPrimary" OR NEW."email" IS DISTINCT FROM OLD."email" THEN
        UPDATE "contacts"
          SET "primaryEmail" = NEW."email"
        WHERE "id" = NEW."contactId";
      END IF;
    ELSIF OLD."isPrimary" AND NOT NEW."isPrimary" THEN
      SELECT ce."email"
        INTO next_primary
      FROM "contact_emails" ce
      WHERE ce."contactId" = NEW."contactId" AND ce."isPrimary"
      ORDER BY ce."updatedAt" DESC, ce."createdAt" DESC
      LIMIT 1;

      UPDATE "contacts"
        SET "primaryEmail" = next_primary
      WHERE "id" = NEW."contactId";
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD."isPrimary" THEN
      SELECT ce."email"
        INTO next_primary
      FROM "contact_emails" ce
      WHERE ce."contactId" = OLD."contactId" AND ce."isPrimary"
      ORDER BY ce."updatedAt" DESC, ce."createdAt" DESC
      LIMIT 1;

      UPDATE "contacts"
        SET "primaryEmail" = next_primary
      WHERE "id" = OLD."contactId";
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "contact_emails_sync_primary" ON "contact_emails";
CREATE TRIGGER "contact_emails_sync_primary"
AFTER INSERT OR UPDATE OR DELETE ON "contact_emails"
FOR EACH ROW EXECUTE FUNCTION sync_contact_primary_email();
