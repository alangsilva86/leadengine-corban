import { z } from 'zod';
import { collectInstancesForTenant } from '.';
import type { NormalizedInstance } from './types';
import { normalizeQueryValue } from '../../../utils/request-parsers';
import { whatsappBrokerClient, WhatsAppBrokerError, WhatsAppBrokerNotConfiguredError } from '../../../services/whatsapp-broker-client';
import { defaultInstanceMetrics } from './metrics';
import { logger } from '../../../config/logger';
import { describeErrorForLog } from './errors';
import { readBrokerErrorStatus } from './http';

const modeSchema = z.enum(['db', 'snapshot', 'sync']).optional();
const fieldsSchema = z.enum(['basic', 'metrics', 'full']).optional();

const rawQuerySchema = z.object({
  mode: z.string().optional(),
  fields: z.string().optional(),
  refresh: z.string().optional(),
});

const NORMALIZE_TRUE = new Set(['1', 'true', 'yes', 'y', 'on']);

export type ListInstancesQuery = {
  mode: 'db' | 'snapshot' | 'sync';
  fields: 'basic' | 'metrics' | 'full';
  refreshOverride: boolean | null;
};

export const parseListInstancesQuery = (query: unknown): ListInstancesQuery => {
  const candidates =
    query && typeof query === 'object'
      ? rawQuerySchema.parse({
          mode: normalizeQueryValue((query as Record<string, unknown>).mode),
          fields: normalizeQueryValue((query as Record<string, unknown>).fields),
          refresh: normalizeQueryValue((query as Record<string, unknown>).refresh),
        })
      : { mode: undefined, fields: undefined, refresh: undefined };

  const modeResult = modeSchema.safeParse(candidates.mode);
  const fieldsResult = fieldsSchema.safeParse(candidates.fields);
  const mode = modeResult.success ? modeResult.data : 'db';
  const fields = fieldsResult.success ? fieldsResult.data : 'basic';
  const refreshOverride =
    candidates.refresh === undefined
      ? null
      : NORMALIZE_TRUE.has(candidates.refresh.toLowerCase());

  return { mode, fields, refreshOverride };
};

const buildCollectionOptions = (query: ListInstancesQuery) => {
  const baseOptions =
    query.mode === 'sync'
      ? { refresh: true, fetchSnapshots: true }
      : query.mode === 'snapshot'
        ? { refresh: false, fetchSnapshots: true }
        : { refresh: false, fetchSnapshots: false };

  if (query.refreshOverride === null) {
    return baseOptions;
  }

  return {
    ...baseOptions,
    refresh: query.refreshOverride,
    fetchSnapshots: query.refreshOverride,
  };
};

const pickBasic = (instance: NormalizedInstance) => ({
  id: instance.id,
  tenantId: instance.tenantId,
  name: instance.name,
  status: instance.status,
  connected: instance.connected,
  phoneNumber: instance.phoneNumber,
  lastActivity: instance.lastActivity,
});

const pickMetrics = (instance: NormalizedInstance) => ({
  ...pickBasic(instance),
  metrics: instance.metrics ?? null,
  rate: instance.rate ?? null,
});

const ensureBrokerHealthy = async (tenantId: string): Promise<void> => {
  try {
    await whatsappBrokerClient.checkHealth();
  } catch (error) {
    if (error instanceof WhatsAppBrokerNotConfiguredError) {
      throw error;
    }

    const brokerError = error instanceof WhatsAppBrokerError ? error : null;
    defaultInstanceMetrics.recordBrokerHealthFailure(tenantId, brokerError?.code ?? null);

    logger.warn('whatsapp.instances.health.failed', {
      tenantId,
      status: readBrokerErrorStatus(brokerError ?? error),
      code: brokerError?.code ?? null,
      requestId: brokerError?.requestId ?? null,
      error: describeErrorForLog(error),
    });

    throw new WhatsAppBrokerError('WhatsApp broker indisponível no momento.', {
      code: 'BROKER_UNAVAILABLE',
      status: readBrokerErrorStatus(brokerError ?? error) ?? 503,
      requestId: brokerError?.requestId,
    });
  }
};

type ListInstancesUseCaseInput = {
  tenantId: string;
  query: ListInstancesQuery;
  requestId?: string | null;
};

type ListInstancesMeta = {
  tenantId: string;
  mode: ListInstancesQuery['mode'];
  refreshRequested: boolean;
  shouldRefresh: boolean;
  refreshFailed: boolean;
  fetchSnapshots: boolean;
  synced: boolean;
  instancesCount: number;
  durationMs: number;
  storageFallback: boolean;
  warnings: string[];
  cacheHit?: boolean;
  cacheBackend?: 'memory' | 'redis';
  refreshFailure?: { cause: string; status: number | null; code: string | null } | null;
};

type ListInstancesPayload = {
  success: true;
  data: { instances: unknown[] };
  meta: ListInstancesMeta;
};

export const listInstancesUseCase = async ({
  tenantId,
  query,
  requestId,
}: ListInstancesUseCaseInput): Promise<{
  payload: ListInstancesPayload;
  requestLog: { tenantId: string; mode: ListInstancesQuery['mode']; refreshOverride: boolean | null; options: { refresh: boolean; fetchSnapshots: boolean } };
  responseLog: Omit<ListInstancesMeta, 'tenantId'> & { tenantId: string };
}> => {
  const startedAt = Date.now();
  const collectionOptions = buildCollectionOptions(query);

  const result = await collectInstancesForTenant(tenantId, {
    ...collectionOptions,
    mode: query.mode,
    requestId,
  });
  await ensureBrokerHealthy(tenantId);
  const instancesSource = result.instances;

  const instances =
    query.fields === 'full'
      ? instancesSource
      : query.fields === 'metrics'
        ? instancesSource.map(pickMetrics)
        : instancesSource.map(pickBasic);

  const durationMs = Date.now() - startedAt;
  const refreshRequested = query.refreshOverride === true;
  const refreshFailed = Boolean(result.refreshFailure);
  const meta: ListInstancesMeta = {
    tenantId,
    mode: query.mode,
    refreshRequested,
    shouldRefresh: result.shouldRefresh ?? false,
    refreshFailed,
    fetchSnapshots: result.fetchSnapshots ?? false,
    synced: result.synced ?? false,
    instancesCount: instances.length,
    durationMs,
    storageFallback: result.storageFallback ?? false,
    warnings: result.warnings ?? [],
    cacheHit: result.cacheHit,
    cacheBackend: result.cacheBackend,
    refreshFailure: result.refreshFailure ?? null,
  };

  return {
    payload: {
      success: true,
      data: { instances },
      meta,
    },
    requestLog: {
      tenantId,
      mode: query.mode,
      refreshOverride: query.refreshOverride,
      options: collectionOptions,
      requestId: requestId ?? null,
    },
    responseLog: {
      tenantId,
      mode: query.mode,
      refreshRequested,
      shouldRefresh: meta.shouldRefresh,
      refreshFailed: meta.refreshFailed,
      fetchSnapshots: meta.fetchSnapshots,
      synced: meta.synced,
      cacheHit: meta.cacheHit,
      cacheBackend: meta.cacheBackend,
      instancesCount: meta.instancesCount,
      durationMs,
      requestId: requestId ?? null,
    },
  };
};
