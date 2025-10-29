-- Remove redundant unique indexes from WhatsApp instances
DROP INDEX IF EXISTS "whatsapp_instances_tenantId_id_key";
DROP INDEX IF EXISTS "whatsapp_instances_brokerId_key";
