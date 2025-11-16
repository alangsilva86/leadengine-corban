-- Add ticket stage enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketStage') THEN
    CREATE TYPE "TicketStage" AS ENUM (
      'novo',
      'conectado',
      'qualificacao',
      'proposta',
      'documentacao',
      'documentos_averbacao',
      'aguardando',
      'aguardando_cliente',
      'liquidacao',
      'aprovado_liquidacao',
      'reciclar',
      'desconhecido'
    );
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "tickets"
  ADD COLUMN IF NOT EXISTS "stage" "TicketStage" NOT NULL DEFAULT 'novo';

CREATE INDEX IF NOT EXISTS "tickets_tenant_stage_idx"
  ON "tickets" ("tenantId", "stage");

CREATE TABLE IF NOT EXISTS "sales_simulations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "leadId" TEXT NULL,
  "calculationSnapshot" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "sales_proposals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "leadId" TEXT NULL,
  "simulationId" TEXT NULL,
  "calculationSnapshot" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "sales_deals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "leadId" TEXT NULL,
  "simulationId" TEXT NULL,
  "proposalId" TEXT NULL,
  "calculationSnapshot" JSONB NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "closedAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sales_simulations_tenant_ticket_idx"
  ON "sales_simulations" ("tenantId", "ticketId");
CREATE INDEX IF NOT EXISTS "sales_simulations_tenant_lead_idx"
  ON "sales_simulations" ("tenantId", "leadId");

CREATE INDEX IF NOT EXISTS "sales_proposals_tenant_ticket_idx"
  ON "sales_proposals" ("tenantId", "ticketId");
CREATE INDEX IF NOT EXISTS "sales_proposals_tenant_lead_idx"
  ON "sales_proposals" ("tenantId", "leadId");
CREATE INDEX IF NOT EXISTS "sales_proposals_tenant_simulation_idx"
  ON "sales_proposals" ("tenantId", "simulationId");

CREATE INDEX IF NOT EXISTS "sales_deals_tenant_ticket_idx"
  ON "sales_deals" ("tenantId", "ticketId");
CREATE INDEX IF NOT EXISTS "sales_deals_tenant_lead_idx"
  ON "sales_deals" ("tenantId", "leadId");
CREATE INDEX IF NOT EXISTS "sales_deals_tenant_simulation_idx"
  ON "sales_deals" ("tenantId", "simulationId");
CREATE INDEX IF NOT EXISTS "sales_deals_tenant_proposal_idx"
  ON "sales_deals" ("tenantId", "proposalId");

ALTER TABLE "sales_simulations"
  ADD CONSTRAINT "sales_simulations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "sales_simulations_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "sales_simulations_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL;

ALTER TABLE "sales_proposals"
  ADD CONSTRAINT "sales_proposals_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "sales_proposals_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "sales_proposals_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "sales_proposals_simulationId_fkey"
    FOREIGN KEY ("simulationId") REFERENCES "sales_simulations"("id") ON DELETE SET NULL;

ALTER TABLE "sales_deals"
  ADD CONSTRAINT "sales_deals_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "sales_deals_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "sales_deals_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "sales_deals_simulationId_fkey"
    FOREIGN KEY ("simulationId") REFERENCES "sales_simulations"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "sales_deals_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "sales_proposals"("id") ON DELETE SET NULL;

-- Backfill stage using existing pipeline metadata when available
WITH normalized AS (
  SELECT
    id,
    NULLIF(
      trim(
        both '_' FROM lower(
          regexp_replace(
            unaccent(COALESCE(metadata ->> 'pipelineStep', '')),
            '[^a-z0-9]+',
            '_',
            'g'
          )
        )
      ),
      ''
    ) AS normalized_pipeline_step
  FROM "tickets"
)
UPDATE "tickets" AS t
SET "stage" = CASE normalized_pipeline_step
  WHEN 'novo' THEN 'novo'::"TicketStage"
  WHEN 'conectado' THEN 'conectado'::"TicketStage"
  WHEN 'qualificacao' THEN 'qualificacao'::"TicketStage"
  WHEN 'proposta' THEN 'proposta'::"TicketStage"
  WHEN 'documentacao' THEN 'documentacao'::"TicketStage"
  WHEN 'documentos_averbacao' THEN 'documentos_averbacao'::"TicketStage"
  WHEN 'aguardando' THEN 'aguardando'::"TicketStage"
  WHEN 'aguardando_cliente' THEN 'aguardando_cliente'::"TicketStage"
  WHEN 'liquidacao' THEN 'liquidacao'::"TicketStage"
  WHEN 'aprovado_liquidacao' THEN 'aprovado_liquidacao'::"TicketStage"
  WHEN 'reciclar' THEN 'reciclar'::"TicketStage"
  WHEN 'desconhecido' THEN 'desconhecido'::"TicketStage"
  WHEN 'follow_up' THEN 'aguardando'::"TicketStage"
  ELSE 'novo'::"TicketStage"
END
FROM normalized n
WHERE t.id = n.id
  AND n.normalized_pipeline_step IS NOT NULL;

