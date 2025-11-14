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

const ensureTicketStageEnum = async (client: PrismaClient): Promise<void> => {
  await client.$executeRawUnsafe(`
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
  `);
};

const ensureTicketStageColumnAndIndex = async (client: PrismaClient): Promise<void> => {
  await client.$executeRawUnsafe(`
    ALTER TABLE "tickets"
      ADD COLUMN IF NOT EXISTS "stage" "TicketStage" NOT NULL DEFAULT 'novo';
  `);

  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tickets_tenant_stage_idx"
      ON "tickets" ("tenantId", "stage");
  `);
};

const backfillTicketStageFromMetadata = async (client: PrismaClient): Promise<void> => {
  await client.$executeRawUnsafe(`
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
          )
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
    await ensureTicketStageEnum(client);
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
