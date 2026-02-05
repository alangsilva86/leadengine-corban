import type { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { emitToTenant } from '../../../lib/socket-registry';
import { ensureTenantRecord } from '../../../services/tenant-service';
import {
  DEFAULT_CAMPAIGN_FALLBACK_AGREEMENT_PREFIX,
  DEFAULT_CAMPAIGN_FALLBACK_NAME,
  DEFAULT_QUEUE_CACHE_TTL_MS,
  DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
  DEFAULT_QUEUE_FALLBACK_NAME,
} from './constants';
import {
  resolveBrokerIdFromMetadata,
  resolveInstanceDisplayNameFromMetadata,
  resolveSessionIdFromMetadata,
  resolveTenantIdentifiersFromMetadata,
  readNestedString,
  readString,
} from './identifiers';
import { mapErrorForLog } from './logging';

export type QueueCacheEntry = {
  id: string;
  expires: number;
};

export const queueCacheByTenant = new Map<string, QueueCacheEntry>();

export class QueueFallbackProvisionError extends Error {
  public readonly reason: 'TENANT_NOT_FOUND' | 'UNKNOWN';

  constructor(message: string, reason: 'TENANT_NOT_FOUND' | 'UNKNOWN', options?: ErrorOptions) {
    super(message, options);
    this.name = 'QueueFallbackProvisionError';
    this.reason = reason;
  }
}

const toJsonRecord = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const normalizeBoolean = (value: string | undefined | null, fallback = false): boolean => {
  if (typeof value !== 'string') return fallback;

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return fallback;
  }
};

const normalizeAllowlist = (value: string | undefined | null): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.toLowerCase());

const inboundAutoprovEnabled = (): boolean =>
  normalizeBoolean(process.env.WHATSAPP_INBOUND_AUTOPROVISION_ENABLED, false);

const inboundAutoprovAllowlist = (): Set<string> =>
  new Set(normalizeAllowlist(process.env.WHATSAPP_INBOUND_AUTOPROVISION_ALLOWLIST));

export const isInboundAutoProvisionAllowed = (tenantIdentifiers: string[]): boolean => {
  if (!inboundAutoprovEnabled()) {
    return false;
  }

  const allowlist = inboundAutoprovAllowlist();
  if (allowlist.size === 0) {
    return false;
  }

  return tenantIdentifiers.some((identifier) => allowlist.has(identifier.toLowerCase()))
    ? true
    : false;
};

type ProvisionQueueOptions = {
  instanceId?: string | null;
};

export const provisionDefaultQueueForTenant = async (
  tenantId: string,
  { instanceId = null }: ProvisionQueueOptions = {}
): Promise<string> => {
  const requestedTenantId = tenantId;
  let effectiveTenantId = tenantId;

  const upsertFallbackQueue = async () =>
    prisma.queue.upsert({
      where: {
        tenantId_name: {
          tenantId: effectiveTenantId,
          name: DEFAULT_QUEUE_FALLBACK_NAME,
        },
      },
      update: {
        description: DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
        isActive: true,
      },
      create: {
        tenantId: effectiveTenantId,
        name: DEFAULT_QUEUE_FALLBACK_NAME,
        description: DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
        color: '#2563EB',
        orderIndex: 0,
      },
    });

  const refreshCache = (queueId: string) => {
    const expires = Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS;

    queueCacheByTenant.set(effectiveTenantId, {
      id: queueId,
      expires,
    });

    if (effectiveTenantId !== requestedTenantId) {
      queueCacheByTenant.set(requestedTenantId, {
        id: queueId,
        expires,
      });
    }
  };

  try {
    const queue = await upsertFallbackQueue();
    refreshCache(queue.id);
    logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Fila padrão provisionada automaticamente', {
      tenantId: effectiveTenantId,
      requestedTenantId: requestedTenantId !== effectiveTenantId ? requestedTenantId : undefined,
      queueId: queue.id,
      ensuredTenant: false,
    });
    emitToTenant(effectiveTenantId, 'whatsapp.queue.autoProvisioned', {
      tenantId: effectiveTenantId,
      requestedTenantId: requestedTenantId !== effectiveTenantId ? requestedTenantId : undefined,
      queueId: queue.id,
      message: 'Fila padrão criada automaticamente para mensagens inbound do WhatsApp.',
      instanceId,
    });
    return queue.id;
  } catch (error) {
    if (isForeignKeyError(error)) {
      logger.warn('🎯 LeadEngine • WhatsApp :: 🧱 Provisionamento de fila falhou — tenant ausente, tentando garantir', {
        tenantId: effectiveTenantId,
        requestedTenantId: requestedTenantId !== effectiveTenantId ? requestedTenantId : undefined,
      });

      try {
        const ensuredTenant = await ensureTenantRecord(effectiveTenantId, {
          source: 'whatsapp-inbound-auto-queue',
          action: 'ensure-tenant',
        });

        if (ensuredTenant?.id && ensuredTenant.id !== effectiveTenantId) {
          effectiveTenantId = ensuredTenant.id;
        }

        const queue = await upsertFallbackQueue();
        refreshCache(queue.id);
        logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Fila padrão provisionada após criar tenant automaticamente', {
          tenantId: effectiveTenantId,
          requestedTenantId: requestedTenantId !== effectiveTenantId ? requestedTenantId : undefined,
          queueId: queue.id,
          ensuredTenant: true,
        });

        emitToTenant(effectiveTenantId, 'whatsapp.queue.autoProvisioned', {
          tenantId: effectiveTenantId,
          requestedTenantId: requestedTenantId !== effectiveTenantId ? requestedTenantId : undefined,
          queueId: queue.id,
          message: 'Fila padrão criada automaticamente para mensagens inbound do WhatsApp.',
          instanceId,
        });

        return queue.id;
      } catch (retryError) {
        logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao provisionar fila padrão mesmo após garantir tenant', {
          error: mapErrorForLog(retryError),
          tenantId: effectiveTenantId,
          requestedTenantId: requestedTenantId !== effectiveTenantId ? requestedTenantId : undefined,
        });

        throw new QueueFallbackProvisionError(
          'Tenant ausente impede o provisionamento automático da fila padrão.',
          'TENANT_NOT_FOUND',
          { cause: retryError }
        );
      }
    }

    logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao provisionar fila padrão', {
      error: mapErrorForLog(error),
      tenantId: effectiveTenantId,
      requestedTenantId: requestedTenantId !== effectiveTenantId ? requestedTenantId : undefined,
    });

    throw new QueueFallbackProvisionError(
      'Erro desconhecido ao provisionar fila padrão.',
      'UNKNOWN',
      { cause: error }
    );
  }
};

export const provisionFallbackCampaignForInstance = async (
  tenantId: string,
  instanceId: string
) => {
  try {
    const agreementId = `${DEFAULT_CAMPAIGN_FALLBACK_AGREEMENT_PREFIX}:${instanceId}`;
    const metadata = {
      fallback: true,
      source: 'whatsapp-inbound',
    } as Prisma.InputJsonValue;

    const existing = await prisma.campaign.findFirst({
      where: {
        tenantId,
        whatsappInstanceId: instanceId,
        agreementId,
      },
      select: { id: true },
    });

    const campaign = existing
      ? await prisma.campaign.update({
          where: { id: existing.id },
          data: {
            status: 'active',
            name: DEFAULT_CAMPAIGN_FALLBACK_NAME,
            agreementName: DEFAULT_CAMPAIGN_FALLBACK_NAME,
            metadata,
          },
        })
      : await prisma.campaign.create({
          data: {
            tenantId,
            name: DEFAULT_CAMPAIGN_FALLBACK_NAME,
            agreementId,
            agreementName: DEFAULT_CAMPAIGN_FALLBACK_NAME,
            whatsappInstanceId: instanceId,
            status: 'active',
            metadata,
          },
        });

    logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Campanha fallback provisionada automaticamente', {
      tenantId,
      instanceId,
      campaignId: campaign.id,
    });

    return campaign;
  } catch (error) {
    logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao provisionar campanha fallback', {
      error: mapErrorForLog(error),
      tenantId,
      instanceId,
    });
    return null;
  }
};

export const getDefaultQueueId = async (
  tenantId: string,
  { provisionIfMissing = true }: { provisionIfMissing?: boolean } = {}
): Promise<string | null> => {
  const cached = queueCacheByTenant.get(tenantId);
  if (cached && cached.expires > Date.now()) {
    const existing = await prisma.queue.findUnique({ where: { id: cached.id } });

    if (existing) {
      queueCacheByTenant.set(tenantId, {
        id: existing.id,
        expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
      });
      return existing.id;
    }
  }

  if (cached) {
    queueCacheByTenant.delete(tenantId);
  }

  const queue = await prisma.queue.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });

  if (!queue) {
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

  queueCacheByTenant.set(tenantId, {
    id: queue.id,
    expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
  });
  return queue.id;
};

type EnsureInboundQueueParams = {
  tenantId: string;
  requestId: string | null;
  instanceId: string | null;
};

type EnsureInboundQueueErrorReason = 'TENANT_NOT_FOUND' | 'PROVISIONING_FAILED';

type EnsureInboundQueueError = {
  reason: EnsureInboundQueueErrorReason;
  recoverable: boolean;
  message: string;
};

type EnsureInboundQueueResult = {
  queueId: string | null;
  wasProvisioned: boolean;
  error?: EnsureInboundQueueError;
};

export const ensureInboundQueueForInboundMessage = async ({
  tenantId,
  requestId,
  instanceId,
}: EnsureInboundQueueParams): Promise<EnsureInboundQueueResult> => {
  const existingQueueId = await getDefaultQueueId(tenantId, { provisionIfMissing: false });

  if (existingQueueId) {
    return { queueId: existingQueueId, wasProvisioned: false };
  }

  logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Provisionando fila padrão automaticamente', {
    requestId,
    tenantId,
    instanceId,
  });

  try {
    const provisionedQueueId = await provisionDefaultQueueForTenant(tenantId, { instanceId });

    logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Fila padrão disponível para mensagens inbound', {
      requestId,
      tenantId,
      instanceId,
      queueId: provisionedQueueId,
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

    logger.error('🎯 LeadEngine • WhatsApp :: 🛎️ Fila padrão ausente após tentativa de provisionamento automático', {
      requestId,
      tenantId,
      instanceId,
      error: mapErrorForLog(error),
      reason: provisionError.reason,
    });

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

export type WhatsAppInstanceRecord = Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

type AutoProvisionMetadataPayload = {
  autopProvisionedAt: string;
  autopProvisionSource: string;
  autopProvisionRequestId: string | null;
  autopProvisionTenantIdentifiers: string[];
  autopProvisionSessionId: string | null;
  autopProvisionBrokerId: string;
};

type AutoProvisionResult = {
  instance: WhatsAppInstanceRecord;
  wasCreated: boolean;
  brokerId: string;
};

const ensureAutopProvisionMetadata = async (
  instance: WhatsAppInstanceRecord,
  {
    autopProvisionedAt,
    autopProvisionSource,
    autopProvisionRequestId,
    autopProvisionTenantIdentifiers,
    autopProvisionSessionId,
    autopProvisionBrokerId,
  }: AutoProvisionMetadataPayload
): Promise<WhatsAppInstanceRecord> => {
  if (!instance) {
    return instance;
  }

  const existingMetadata = toJsonRecord(instance.metadata ?? null);

  const nextMetadata: Record<string, unknown> = { ...existingMetadata };
  let needsUpdate = false;

  if (!nextMetadata.autopProvisionedAt) {
    nextMetadata.autopProvisionedAt = autopProvisionedAt;
    needsUpdate = true;
  }

  if (nextMetadata.autopProvisionSource !== autopProvisionSource) {
    nextMetadata.autopProvisionSource = autopProvisionSource;
    needsUpdate = true;
  }

  if (autopProvisionRequestId && nextMetadata.autopProvisionRequestId !== autopProvisionRequestId) {
    nextMetadata.autopProvisionRequestId = autopProvisionRequestId;
    needsUpdate = true;
  }

  const existingTenantIdentifiers = Array.isArray(nextMetadata.autopProvisionTenantIdentifiers)
    ? (nextMetadata.autopProvisionTenantIdentifiers as unknown[])
    : [];
  const normalizedExisting = existingTenantIdentifiers.filter((value): value is string => typeof value === 'string');
  const mergedTenantIdentifiers = Array.from(new Set([...normalizedExisting, ...autopProvisionTenantIdentifiers]));

  if (mergedTenantIdentifiers.length !== normalizedExisting.length) {
    nextMetadata.autopProvisionTenantIdentifiers = mergedTenantIdentifiers;
    needsUpdate = true;
  }

  if (autopProvisionSessionId && nextMetadata.autopProvisionSessionId !== autopProvisionSessionId) {
    nextMetadata.autopProvisionSessionId = autopProvisionSessionId;
    needsUpdate = true;
  }

  if (nextMetadata.autopProvisionBrokerId !== autopProvisionBrokerId) {
    nextMetadata.autopProvisionBrokerId = autopProvisionBrokerId;
    needsUpdate = true;
  }

  if (!needsUpdate) {
    return instance;
  }

  const updated = await prisma.whatsAppInstance.update({
    where: { id: instance.id },
    data: { metadata: nextMetadata as Prisma.InputJsonValue },
  });

  return updated;
};

export const attemptAutoProvisionWhatsAppInstance = async ({
  instanceId,
  metadata,
  requestId,
}: {
  instanceId: string;
  metadata: Record<string, unknown>;
  requestId: string | null;
}): Promise<AutoProvisionResult | null> => {
  const tenantIdentifiers = resolveTenantIdentifiersFromMetadata(metadata);

  if (tenantIdentifiers.length === 0) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Instância inbound sem tenant identificável', {
      instanceId,
      requestId,
    });
    return null;
  }

  if (!isInboundAutoProvisionAllowed(tenantIdentifiers)) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🚧 Autoprovisionamento bloqueado por allowlist', {
      instanceId,
      requestId,
      tenantIdentifiers,
    });
    return null;
  }

  let tenant = await prisma.tenant.findFirst({
    where: {
      OR: tenantIdentifiers.flatMap((identifier) => [
        { id: identifier },
        { slug: identifier },
      ]),
    },
  });

  if (!tenant) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Tenant não localizado para autoprov de instância', {
      instanceId,
      requestId,
      tenantIdentifiers,
    });
    return null;
  }

  const brokerId = resolveBrokerIdFromMetadata(metadata) ?? instanceId;
  const sessionId = resolveSessionIdFromMetadata(metadata);
  const displayName = resolveInstanceDisplayNameFromMetadata(metadata, tenant.name, instanceId);
  const autopProvisionMetadataPayload: AutoProvisionMetadataPayload = {
    autopProvisionedAt: new Date().toISOString(),
    autopProvisionSource: 'inbound-auto',
    autopProvisionRequestId: requestId ?? null,
    autopProvisionTenantIdentifiers: tenantIdentifiers,
    autopProvisionSessionId: sessionId ?? null,
    autopProvisionBrokerId: brokerId,
  };

  const brokerLookupWhere: Prisma.WhatsAppInstanceWhereInput = { brokerId };

  if (tenant.id) {
    brokerLookupWhere.tenantId = tenant.id;
  }

  const existingByBroker = await prisma.whatsAppInstance.findFirst({ where: brokerLookupWhere });

  if (existingByBroker) {
    const enriched = await ensureAutopProvisionMetadata(existingByBroker, autopProvisionMetadataPayload);
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Instância reaproveitada localizada por broker', {
      instanceId,
      tenantId: enriched?.tenantId,
      brokerId,
      requestId,
    });
    return { instance: enriched, wasCreated: false, brokerId };
  }

  try {
    const created = await prisma.whatsAppInstance.create({
      data: {
        id: instanceId,
        tenantId: tenant.id,
        name: displayName,
        brokerId,
        status: 'connected',
        connected: true,
        metadata: autopProvisionMetadataPayload,
      },
    });

    logger.info('🎯 LeadEngine • WhatsApp :: 🆕 Instância provisionada automaticamente', {
      instanceId,
      tenantId: tenant.id,
      brokerId,
      requestId,
    });

    return { instance: created, wasCreated: true, brokerId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existingById = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });
      if (existingById) {
        const enriched = await ensureAutopProvisionMetadata(existingById, autopProvisionMetadataPayload);
        logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Instância reaproveitada após colisão de id', {
          instanceId,
          tenantId: enriched?.tenantId,
          brokerId,
          requestId,
        });
        return { instance: enriched, wasCreated: false, brokerId };
      }

      const existing =
        (await prisma.whatsAppInstance.findUnique({
          where: {
            tenantId_brokerId: {
              tenantId: tenant.id,
              brokerId,
            },
          },
        })) ??
        (await prisma.whatsAppInstance.findFirst({ where: { brokerId } })) ??
        (await prisma.whatsAppInstance.findFirst({ where: brokerLookupWhere }));
      if (existing) {
        const enriched = await ensureAutopProvisionMetadata(existing, autopProvisionMetadataPayload);
        logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Instância reaproveitada após colisão de broker', {
          instanceId,
          tenantId: enriched?.tenantId,
          brokerId,
          requestId,
        });
        return { instance: enriched, wasCreated: false, brokerId };
      }
    }

    logger.error('🎯 LeadEngine • WhatsApp :: ❌ Falha ao autoprov instância', {
      error: mapErrorForLog(error),
      instanceId,
      tenantId: tenant.id,
      brokerId,
      requestId,
    });
    return null;
  }
};

export const isUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const codeMatches = (error as { code?: string }).code === 'P2002';
  const messageMatches = Boolean(
    (error as { message?: string }).message?.includes('Unique constraint failed')
  );
  return codeMatches || messageMatches;
};

export const isForeignKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const codeMatches = (error as { code?: string }).code === 'P2003';
  const messageMatches = Boolean(
    (error as { message?: string }).message?.includes('Foreign key constraint failed')
  );
  return codeMatches || messageMatches;
};

export const __testing = {
  queueCacheByTenant,
  ensureAutopProvisionMetadata,
};
