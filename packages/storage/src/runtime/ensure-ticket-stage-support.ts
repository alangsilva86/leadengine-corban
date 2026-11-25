import type { PrismaClient } from '@prisma/client';

export type EnsureTicketStageLogger = {
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

export interface EnsureTicketStageOptions {
  logger?: EnsureTicketStageLogger;
}

const log = (
  logger: EnsureTicketStageLogger | undefined,
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
) => {
  const fallback = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  const writer = logger?.[level] ?? fallback;

  try {
    writer(message, meta);
  } catch {
    fallback(message, meta);
  }
};

const hasTicketStageColumn = async (client: PrismaClient): Promise<boolean> => {
  const result = await client.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'tickets'
        AND column_name = 'stage'
    ) AS "exists";
  `;

  return Boolean(result[0]?.exists);
};

/**
 * Valores do funil único do lead (espelho de `LEAD_STAGES` em @ticketz/contracts e do enum
 * `LeadStage` do Prisma). A migração `20270223000100_unified_lead_stage` é a fonte oficial;
 * este patch só existe para bancos antigos que nunca receberam a coluna `tickets.stage`.
 */
const LEAD_STAGE_VALUES = [
  'novo',
  'contato',
  'qualificacao',
  'proposta',
  'documentacao',
  'averbacao',
  'liquidacao',
  'ganho',
  'perdido',
  'reciclar',
] as const;

const ensureLeadStageEnum = async (client: PrismaClient): Promise<void> => {
  const values = LEAD_STAGE_VALUES.map((value) => `'${value}'`).join(', ');
  await client.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadStage') THEN
        CREATE TYPE "LeadStage" AS ENUM (${values});
      END IF;
    END $$;
  `);
};

const ensureTicketStageColumnAndIndex = async (client: PrismaClient): Promise<void> => {
  await client.$executeRawUnsafe(`
    ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "stage" "LeadStage" NOT NULL DEFAULT 'novo';
  `);

  await client.$executeRawUnsafe(`
    ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "legacy_stage" TEXT;
  `);

  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tickets_tenant_stage_idx"
      ON "tickets" ("tenantId", "stage");
  `);
};

/**
 * Preenche a etapa a partir do antigo `metadata.pipelineStep`, já no vocabulário do funil único
 * (mesmo mapeamento de LEGACY_TICKET_STAGE_TO_LEAD_STAGE).
 */
const backfillTicketStageFromMetadata = async (client: PrismaClient): Promise<void> => {
  await client.$executeRawUnsafe(`
    WITH normalized AS (
      SELECT
        id,
        NULLIF(
          trim(
            both '_' FROM lower(
              regexp_replace(
                translate(
                  COALESCE(metadata ->> 'pipelineStep', ''),
                  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
                  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
                ),
                '[^a-zA-Z0-9]+',
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
    SET "legacy_stage" = n.normalized_pipeline_step,
        "stage" = (CASE n.normalized_pipeline_step
      WHEN 'novo' THEN 'novo'
      WHEN 'desconhecido' THEN 'novo'
      WHEN 'conectado' THEN 'contato'
      WHEN 'contato' THEN 'contato'
      WHEN 'aguardando' THEN 'contato'
      WHEN 'follow_up' THEN 'contato'
      WHEN 'qualificacao' THEN 'qualificacao'
      WHEN 'proposta' THEN 'proposta'
      WHEN 'documentacao' THEN 'documentacao'
      WHEN 'aguardando_cliente' THEN 'documentacao'
      WHEN 'documentos_averbacao' THEN 'averbacao'
      WHEN 'averbacao' THEN 'averbacao'
      WHEN 'liquidacao' THEN 'liquidacao'
      WHEN 'aprovado_liquidacao' THEN 'ganho'
      WHEN 'ganho' THEN 'ganho'
      WHEN 'perdido' THEN 'perdido'
      WHEN 'reciclar' THEN 'reciclar'
      ELSE 'novo'
    END)::"LeadStage"
    FROM normalized n
    WHERE t.id = n.id
      AND n.normalized_pipeline_step IS NOT NULL;
  `);
};

export const ensureTicketStageSupport = async (
  client: PrismaClient,
  options: EnsureTicketStageOptions = {}
): Promise<void> => {
  const { logger } = options;

  const exists = await hasTicketStageColumn(client);
  if (exists) {
    return;
  }

  log(logger, 'warn', '[Storage] Ticket stage column missing — applying runtime patch');

  try {
    await ensureLeadStageEnum(client);
    await ensureTicketStageColumnAndIndex(client);
    try {
      await backfillTicketStageFromMetadata(client);
    } catch (error) {
      log(logger, 'warn', '[Storage] Ticket stage backfill skipped due to error', { error: error as Error });
    }
    log(logger, 'info', '[Storage] Ticket stage runtime patch applied successfully');
  } catch (error) {
    log(logger, 'error', '[Storage] Failed to apply ticket stage runtime patch', { error: error as Error });
    throw error;
  }
};
