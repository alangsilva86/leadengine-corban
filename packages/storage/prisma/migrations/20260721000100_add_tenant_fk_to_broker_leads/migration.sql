-- AddForeignKeys
ALTER TABLE "broker_leads"
  ADD CONSTRAINT "broker_leads_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_allocations"
  ADD CONSTRAINT "lead_allocations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
