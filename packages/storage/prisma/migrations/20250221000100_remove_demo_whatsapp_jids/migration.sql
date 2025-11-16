-- Remove demo broker-managed WhatsApp sessions that were being recreated automatically
DO $$
DECLARE
  target_ids TEXT[] := ARRAY[
    '554123912310:5@s.whatsapp.net',
    '556230301837:10@s.whatsapp.net'
  ];
  var_id TEXT;
  tenant_slug TEXT := 'demo-tenant';
  deleted_at TIMESTAMP := NOW();
  archive_prefix TEXT := 'whatsapp:instance:archive:';
BEGIN
  DELETE FROM "whatsapp_instances"
  WHERE "tenantId" = tenant_slug
    AND "id" = ANY(target_ids);

  FOREACH var_id IN ARRAY target_ids LOOP
    INSERT INTO "integration_states" ("key", "value", "createdAt", "updatedAt")
    VALUES (
      archive_prefix || tenant_slug || ':' || var_id,
      jsonb_build_object(
        'tenantId', tenant_slug,
        'instanceId', var_id,
        'brokerId', var_id,
        'deletedAt', deleted_at,
        'actorId', 'system/migration:remove-demo-jids',
        'stored', NULL,
        'status', NULL,
        'qr', NULL,
        'brokerStatus', NULL,
        'history', '[]'::jsonb,
        'instancesBeforeDeletion', '[]'::jsonb
      ),
      deleted_at,
      deleted_at
    )
    ON CONFLICT ("key")
    DO UPDATE SET
      "value" = EXCLUDED."value",
      "updatedAt" = EXCLUDED."updatedAt";
  END LOOP;
END $$;
