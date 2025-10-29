-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "instance_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("instance_id")
);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_whatsapp_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_sessions_updated_at
BEFORE UPDATE ON "whatsapp_sessions"
FOR EACH ROW
EXECUTE FUNCTION set_whatsapp_sessions_updated_at();
