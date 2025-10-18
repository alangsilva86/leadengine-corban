import { NotFoundError } from '@ticketz/core';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { ensureTenantRecord } from '../../../services/tenant-service';
import { emitToTenant } from '../../../lib/socket-registry';

import { mapErrorForLog } from './errors';

export const DEFAULT_QUEUE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_QUEUE_FALLBACK_NAME = 'Atendimento Geral';
const DEFAULT_QUEUE_FALLBACK_DESCRIPTION =
  'Fila criada automaticamente para mensagens inbound do WhatsApp.';

export type QueueCacheEntry = {
  id: string;
  expires: number;
};

export const queueCacheByTenant = new Map<string, QueueCacheEntry>();

export type QueueFallbackErrorReason = 'TENANT_NOT_FOUND' | 'UNKNOWN';

export class QueueFallbackProvisionError extends Error {
  public readonly reason: QueueFallbackErrorReason;

  constructor(message: string, reason: QueueFallbackErrorReason, options?: ErrorOptions) {
    super(message, options);
    this.name = 'QueueFallbackProvisionError';
    this.reason = reason;
  }
}

export const isForeignKeyError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (code === 'P2003') {
      return true;
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause && cause !== error) {
      return isForeignKeyError(cause);
    }
  }

  return false;
};

const refreshQueueCache = (tenantId: string, queueId: string) => {
  queueCacheByTenant.set(tenantId, {
    id: queueId,
    expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
  });
};

export const provisionDefaultQueueForTenant = async (tenantId: string): Promise<string> => {
  const upsertFallbackQueue = async () =>
    prisma.queue.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: DEFAULT_QUEUE_FALLBACK_NAME,
        },
      },
      update: {
        description: DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
        isActive: true,
      },
      create: {
        tenantId,
        name: DEFAULT_QUEUE_FALLBACK_NAME,
        description: DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
        color: '#2563EB',
        orderIndex: 0,
      },
    });

  try {
    const queue = await upsertFallbackQueue();
    refreshQueueCache(tenantId, queue.id);
    logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Fila padrão provisionada automaticamente', {
      tenantId,
      queueId: queue.id,
      ensuredTenant: false,
    });
    return queue.id;
  } catch (error) {
    if (isForeignKeyError(error)) {
      logger.warn(
        '🎯 LeadEngine • WhatsApp :: 🧱 Provisionamento de fila falhou — tenant ausente, tentando garantir',
        {
          tenantId,
        }
      );

      try {
        await ensureTenantRecord(tenantId, {
          source: 'whatsapp-inbound-auto-queue',
          action: 'ensure-tenant',
        });

        const queue = await upsertFallbackQueue();
        refreshQueueCache(tenantId, queue.id);
        logger.info(
          '🎯 LeadEngine • WhatsApp :: 🧱 Fila padrão provisionada após criar tenant automaticamente',
          {
            tenantId,
            queueId: queue.id,
            ensuredTenant: true,
          }
        );

        return queue.id;
      } catch (retryError) {
        logger.error(
          '🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao provisionar fila padrão mesmo após garantir tenant',
          {
            error: mapErrorForLog(retryError),
            tenantId,
          }
        );

        throw new QueueFallbackProvisionError(
          'Tenant ausente impede o provisionamento automático da fila padrão.',
          'TENANT_NOT_FOUND',
          { cause: retryError }
        );
      }
    }

    logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao provisionar fila padrão', {
      error: mapErrorForLog(error),
      tenantId,
    });

    throw new QueueFallbackProvisionError('Erro desconhecido ao provisionar fila padrão.', 'UNKNOWN', {
      cause: error,
    });
  }
};

export const getDefaultQueueId = async (
  tenantId: string,
  { provisionIfMissing = true }: { provisionIfMissing?: boolean } = {}
): Promise<string | null> => {
  const now = Date.now();
  const cached = queueCacheByTenant.get(tenantId);

  if (cached) {
    if (cached.expires <= now) {
      queueCacheByTenant.delete(tenantId);
    } else {
      const existingQueue = await prisma.queue.findUnique({ where: { id: cached.id } });
      if (existingQueue) {
        return cached.id;
      }
      queueCacheByTenant.delete(tenantId);
    }
  }

  const queue = await prisma.queue.findFirst({
    where: { tenantId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });

  if (!queue) {
    queueCacheByTenant.delete(tenantId);

    if (!provisionIfMissing) {
      return null;
    }

    try {
      const provisionedQueueId = await provisionDefaultQueueForTenant(tenantId);
      return provisionedQueueId;
    } catch (error) {
      if (error instanceof QueueFallbackProvisionError) {
        throw error;
      }

      logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha inesperada ao obter fila padrão', {
        error: mapErrorForLog(error),
        tenantId,
      });

      throw error;
    }
  }

  refreshQueueCache(tenantId, queue.id);
  return queue.id;
};

export type EnsureInboundQueueParams = {
  tenantId: string;
  requestId: string | null;
  instanceId: string | null;
  simpleMode: boolean;
};

export type EnsureInboundQueueErrorReason = 'TENANT_NOT_FOUND' | 'PROVISIONING_FAILED';

export type EnsureInboundQueueError = {
  reason: EnsureInboundQueueErrorReason;
  recoverable: boolean;
  message: string;
};

export type EnsureInboundQueueResult = {
  queueId: string | null;
  wasProvisioned: boolean;
  error?: EnsureInboundQueueError;
};

export const ensureInboundQueueForInboundMessage = async ({
  tenantId,
  requestId,
  instanceId,
  simpleMode,
}: EnsureInboundQueueParams): Promise<EnsureInboundQueueResult> => {
  const existingQueueId = await getDefaultQueueId(tenantId, { provisionIfMissing: false });

  if (existingQueueId) {
    return { queueId: existingQueueId, wasProvisioned: false };
  }

  logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Provisionando fila padrão automaticamente', {
    requestId,
    tenantId,
    instanceId,
    simpleMode,
  });

  try {
    const provisionedQueueId = await provisionDefaultQueueForTenant(tenantId);

    logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Fila padrão disponível para mensagens inbound', {
      requestId,
      tenantId,
      instanceId,
      queueId: provisionedQueueId,
      simpleMode,
    });

    emitToTenant(tenantId, 'whatsapp.queue.autoProvisioned', {
      tenantId,
      instanceId,
      queueId: provisionedQueueId,
      message: 'Fila padrão criada automaticamente para mensagens inbound do WhatsApp.',
    });

    return { queueId: provisionedQueueId, wasProvisioned: true };
  } catch (error) {
    const provisionError = (() => {
      if (error instanceof QueueFallbackProvisionError) {
        return {
          reason: error.reason === 'TENANT_NOT_FOUND' ? 'TENANT_NOT_FOUND' : 'PROVISIONING_FAILED',
          recoverable: error.reason === 'TENANT_NOT_FOUND',
          message: error.message,
        } satisfies EnsureInboundQueueError;
      }

      return {
        reason: 'PROVISIONING_FAILED' as const,
        recoverable: false,
        message: 'Falha desconhecida ao provisionar fila padrão.',
      } satisfies EnsureInboundQueueError;
    })();

    logger.error('🎯 LeadEngine • WhatsApp :: 🛎️ Fila padrão ausente após tentativa de provisionamento automático',
      {
        requestId,
        tenantId,
        instanceId,
        simpleMode,
        error: mapErrorForLog(error),
        reason: provisionError.reason,
      }
    );

    emitToTenant(tenantId, 'whatsapp.queue.missing', {
      tenantId,
      instanceId,
      message: 'Nenhuma fila padrão configurada para receber mensagens inbound.',
      reason: provisionError.reason,
      recoverable: provisionError.recoverable,
    });

    return { queueId: null, wasProvisioned: false, error: provisionError };
  }
};

export const reset = (): void => {
  queueCacheByTenant.clear();
};
