-- Funil único do lead ("LeadStage").
--
-- O lead passa a ser o dono da etapa: Inbox (tickets), CRM (leads) e Oportunidades usam o mesmo
-- enum "LeadStage" (fonte da verdade: packages/contracts/src/lead-stages.ts). Os valores antigos
-- ficam preservados em "legacy_stage" (tickets, opportunities, opportunity_activities) para
-- auditoria e rollback. "LeadStatus" é mantido e espelhado pela aplicação para integrações.
--
-- Segurança em produção:
--   * Tudo roda em UMA transação: se qualquer passo falhar, nada é aplicado.
--   * ALTER COLUMN ... TYPE reescreve "tickets", "opportunities" e "opportunity_activities"
--     (e seus índices) sob ACCESS EXCLUSIVE lock — leituras/escritas nessas tabelas esperam
--     até o COMMIT. Em "leads" a coluna nova tem default constante (sem reescrita) e o backfill
--     é um UPDATE comum.
--   * Nenhum UPDATE altera "updatedAt" (não há trigger; @updatedAt é aplicado pelo Prisma Client).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enum único do funil
-- ---------------------------------------------------------------------------
CREATE TYPE "LeadStage" AS ENUM (
  'novo',
  'contato',
  'qualificacao',
  'proposta',
  'documentacao',
  'averbacao',
  'liquidacao',
  'ganho',
  'perdido',
  'reciclar'
);

-- ---------------------------------------------------------------------------
-- 2. tickets.stage: "TicketStage" → "LeadStage" (LEGACY_TICKET_STAGE_TO_LEAD_STAGE)
-- ---------------------------------------------------------------------------
ALTER TABLE "tickets" ADD COLUMN "legacy_stage" TEXT;
UPDATE "tickets" SET "legacy_stage" = "stage"::text;

ALTER TABLE "tickets"
  ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE "LeadStage" USING (
    CASE "stage"::text
      WHEN 'novo' THEN 'novo'
      WHEN 'desconhecido' THEN 'novo'
      WHEN 'conectado' THEN 'contato'
      WHEN 'aguardando' THEN 'contato'
      WHEN 'qualificacao' THEN 'qualificacao'
      WHEN 'proposta' THEN 'proposta'
      WHEN 'documentacao' THEN 'documentacao'
      WHEN 'aguardando_cliente' THEN 'documentacao'
      WHEN 'documentos_averbacao' THEN 'averbacao'
      WHEN 'liquidacao' THEN 'liquidacao'
      WHEN 'aprovado_liquidacao' THEN 'ganho'
      WHEN 'reciclar' THEN 'reciclar'
      ELSE 'novo'
    END
  )::"LeadStage",
  ALTER COLUMN "stage" SET DEFAULT 'novo';

-- ---------------------------------------------------------------------------
-- 3. opportunities.stage / opportunity_activities.stage: "OpportunityStage" → "LeadStage"
--    QUALIFICATION → qualificacao, PREPARATION → proposta, FOLLOW_UP → averbacao,
--    CLOSED → ganho se o lead vinculado (tenantId, leadId) está CONVERTED; senão perdido.
--    (ALTER ... USING não aceita subconsulta: CLOSED vira perdido e o ganho é corrigido em seguida.)
-- ---------------------------------------------------------------------------
ALTER TABLE "opportunities" ADD COLUMN "legacy_stage" TEXT;
UPDATE "opportunities" SET "legacy_stage" = "stage"::text;

ALTER TABLE "opportunities"
  ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE "LeadStage" USING (
    CASE "stage"::text
      WHEN 'QUALIFICATION' THEN 'qualificacao'
      WHEN 'PREPARATION' THEN 'proposta'
      WHEN 'FOLLOW_UP' THEN 'averbacao'
      WHEN 'CLOSED' THEN 'perdido'
      ELSE 'qualificacao'
    END
  )::"LeadStage",
  ALTER COLUMN "stage" SET DEFAULT 'qualificacao';

UPDATE "opportunities" AS o
SET "stage" = 'ganho'
FROM "leads" AS l
WHERE o."legacy_stage" = 'CLOSED'
  AND l."tenantId" = o."tenantId"
  AND l."id" = o."leadId"
  AND l."status" = 'CONVERTED';

ALTER TABLE "opportunity_activities" ADD COLUMN "legacy_stage" TEXT;
UPDATE "opportunity_activities" SET "legacy_stage" = "stage"::text;

ALTER TABLE "opportunity_activities"
  ALTER COLUMN "stage" TYPE "LeadStage" USING (
    CASE "stage"::text
      WHEN 'QUALIFICATION' THEN 'qualificacao'
      WHEN 'PREPARATION' THEN 'proposta'
      WHEN 'FOLLOW_UP' THEN 'averbacao'
      WHEN 'CLOSED' THEN 'perdido'
      ELSE 'qualificacao'
    END
  )::"LeadStage";

UPDATE "opportunity_activities" AS a
SET "stage" = 'ganho'
FROM "opportunities" AS o
JOIN "leads" AS l ON l."tenantId" = o."tenantId" AND l."id" = o."leadId"
WHERE a."opportunityId" = o."id"
  AND a."legacy_stage" = 'CLOSED'
  AND l."status" = 'CONVERTED';

-- Os enums antigos não são mais usados por nenhuma coluna.
DROP TYPE "TicketStage";
DROP TYPE "OpportunityStage";

-- ---------------------------------------------------------------------------
-- 4. leads.stage (novo dono da etapa)
-- ---------------------------------------------------------------------------
ALTER TABLE "leads" ADD COLUMN "stage" "LeadStage" NOT NULL DEFAULT 'novo';

-- 4a. Ponto de partida: LEGACY_LEAD_STATUS_TO_LEAD_STAGE[status].
UPDATE "leads"
SET "stage" = (
  CASE "status"::text
    WHEN 'NEW' THEN 'novo'
    WHEN 'CONTACTED' THEN 'contato'
    WHEN 'ENGAGED' THEN 'contato'
    WHEN 'QUALIFIED' THEN 'qualificacao'
    WHEN 'PROPOSAL' THEN 'proposta'
    WHEN 'NEGOTIATION' THEN 'documentacao'
    WHEN 'CONVERTED' THEN 'ganho'
    WHEN 'LOST' THEN 'perdido'
    WHEN 'NURTURING' THEN 'reciclar'
    ELSE 'novo'
  END
)::"LeadStage";

-- 4b. Regra do Inbox: se o contato tem tickets, vale a etapa (já convertida) do ticket atualizado
--     mais recentemente (qualquer status; desempate por createdAt e id) quando esse ticket foi
--     atualizado DEPOIS do lead ("tickets"."updatedAt" > "leads"."updatedAt"). Salvaguardas:
--       * etapa "novo" no ticket (default/"desconhecido") não sobrescreve — não carrega informação;
--       * respeita canTransitionLeadStage: "ganho" é final e "perdido" só muda para "reciclar".
--     Quando a etapa vem do ticket, o status é espelhado (LEAD_STAGE_TO_LEGACY_LEAD_STATUS) e um
--     ganho recebe actualCloseDate (se vazio) = updatedAt do ticket.
WITH "latest_ticket" AS (
  SELECT DISTINCT ON (t."tenantId", t."contactId")
    t."tenantId",
    t."contactId",
    t."stage",
    t."updatedAt"
  FROM "tickets" AS t
  ORDER BY t."tenantId", t."contactId", t."updatedAt" DESC, t."createdAt" DESC, t."id" DESC
)
UPDATE "leads" AS l
SET
  "stage" = lt."stage",
  "status" = (
    CASE lt."stage"::text
      WHEN 'novo' THEN 'NEW'
      WHEN 'contato' THEN 'CONTACTED'
      WHEN 'qualificacao' THEN 'QUALIFIED'
      WHEN 'proposta' THEN 'PROPOSAL'
      WHEN 'documentacao' THEN 'NEGOTIATION'
      WHEN 'averbacao' THEN 'NEGOTIATION'
      WHEN 'liquidacao' THEN 'NEGOTIATION'
      WHEN 'ganho' THEN 'CONVERTED'
      WHEN 'perdido' THEN 'LOST'
      WHEN 'reciclar' THEN 'NURTURING'
    END
  )::"LeadStatus",
  "actualCloseDate" = CASE
    WHEN lt."stage" = 'ganho' THEN COALESCE(l."actualCloseDate", lt."updatedAt")
    ELSE l."actualCloseDate"
  END
FROM "latest_ticket" AS lt
WHERE lt."tenantId" = l."tenantId"
  AND lt."contactId" = l."contactId"
  AND lt."updatedAt" > l."updatedAt"
  AND lt."stage" <> 'novo'
  AND lt."stage" <> l."stage"
  AND l."stage" <> 'ganho'
  AND (l."stage" <> 'perdido' OR lt."stage" = 'reciclar');

CREATE INDEX "leads_tenantId_stage_updatedAt_idx" ON "leads"("tenantId", "stage", "updatedAt");

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback manual (não executado). Restaura os enums antigos a partir de "legacy_stage";
-- linhas criadas depois desta migração (legacy_stage NULL) usam o mapeamento inverso aproximado.
-- Remova a linha desta migração de "_prisma_migrations" e faça o deploy da versão anterior.
--
-- BEGIN;
-- CREATE TYPE "TicketStage" AS ENUM ('novo','conectado','qualificacao','proposta','documentacao',
--   'documentos_averbacao','aguardando','aguardando_cliente','liquidacao','aprovado_liquidacao',
--   'reciclar','desconhecido');
-- CREATE TYPE "OpportunityStage" AS ENUM ('QUALIFICATION','PREPARATION','FOLLOW_UP','CLOSED');
-- ALTER TABLE "tickets"
--   ALTER COLUMN "stage" DROP DEFAULT,
--   ALTER COLUMN "stage" TYPE "TicketStage" USING (COALESCE("legacy_stage", CASE "stage"::text
--     WHEN 'contato' THEN 'conectado' WHEN 'averbacao' THEN 'documentos_averbacao'
--     WHEN 'ganho' THEN 'aprovado_liquidacao' WHEN 'perdido' THEN 'reciclar'
--     ELSE "stage"::text END))::"TicketStage",
--   ALTER COLUMN "stage" SET DEFAULT 'novo';
-- ALTER TABLE "opportunities"
--   ALTER COLUMN "stage" DROP DEFAULT,
--   ALTER COLUMN "stage" TYPE "OpportunityStage" USING (COALESCE("legacy_stage", CASE "stage"::text
--     WHEN 'qualificacao' THEN 'QUALIFICATION' WHEN 'novo' THEN 'QUALIFICATION'
--     WHEN 'contato' THEN 'QUALIFICATION' WHEN 'proposta' THEN 'PREPARATION'
--     WHEN 'documentacao' THEN 'PREPARATION' WHEN 'reciclar' THEN 'QUALIFICATION'
--     WHEN 'ganho' THEN 'CLOSED' WHEN 'perdido' THEN 'CLOSED' ELSE 'FOLLOW_UP' END))::"OpportunityStage",
--   ALTER COLUMN "stage" SET DEFAULT 'QUALIFICATION';
-- ALTER TABLE "opportunity_activities"
--   ALTER COLUMN "stage" TYPE "OpportunityStage" USING (COALESCE("legacy_stage", CASE "stage"::text
--     WHEN 'qualificacao' THEN 'QUALIFICATION' WHEN 'novo' THEN 'QUALIFICATION'
--     WHEN 'contato' THEN 'QUALIFICATION' WHEN 'proposta' THEN 'PREPARATION'
--     WHEN 'documentacao' THEN 'PREPARATION' WHEN 'reciclar' THEN 'QUALIFICATION'
--     WHEN 'ganho' THEN 'CLOSED' WHEN 'perdido' THEN 'CLOSED' ELSE 'FOLLOW_UP' END))::"OpportunityStage";
-- ALTER TABLE "tickets" DROP COLUMN "legacy_stage";
-- ALTER TABLE "opportunities" DROP COLUMN "legacy_stage";
-- ALTER TABLE "opportunity_activities" DROP COLUMN "legacy_stage";
-- DROP INDEX "leads_tenantId_stage_updatedAt_idx";
-- ALTER TABLE "leads" DROP COLUMN "stage";
-- DROP TYPE "LeadStage";
-- COMMIT;
