ALTER TYPE "WhatsAppInstanceStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "WhatsAppInstanceStatus" ADD VALUE IF NOT EXISTS 'failed';

ALTER TABLE "whatsapp_instances"
  ALTER COLUMN "status" SET DEFAULT 'pending';
