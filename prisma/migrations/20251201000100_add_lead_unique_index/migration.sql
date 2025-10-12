-- Create unique index to enforce one lead per tenant/contact pair
CREATE UNIQUE INDEX IF NOT EXISTS leads_tenant_contact_unique ON "leads" ("tenantId", "contactId");

-- Optional performance improvement for lead activity lookups by lead and recency
CREATE INDEX IF NOT EXISTS lead_activities_lead_occured_at_idx ON "lead_activities" ("leadId", "occurredAt" DESC);
