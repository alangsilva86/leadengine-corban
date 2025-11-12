import { fetch } from 'undici';

import { logger } from '../config/logger';
import {
  loadMetaOfflineConfig,
  markMetaOfflineValidationResult,
} from '../services/meta-offline-config';

export interface MetaOfflineConversionEvent {
  eventName?: string;
  eventTime?: number;
  actionSource?: string;
  userData?: Record<string, unknown>;
  customData?: Record<string, unknown>;
}

export interface DispatchMetaOfflineConversionsOptions {
  fetchImpl?: typeof fetch;
  graphApiBaseUrl?: string;
  graphApiVersion?: string;
}

export interface DispatchMetaOfflineConversionsResult {
  success: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
  response?: unknown;
}

const DEFAULT_GRAPH_BASE_URL = 'https://graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v18.0';

const buildGraphUrl = (config: {
  baseUrl?: string;
  version?: string;
  offlineEventSetId: string;
}): string => {
  const base = (config.baseUrl ?? DEFAULT_GRAPH_BASE_URL).replace(/\/$/, '');
  const version = (config.version ?? DEFAULT_GRAPH_VERSION).replace(/\/$/, '');
  return `${base}/${version}/${config.offlineEventSetId}/events`;
};

const toSeconds = (value: number): number => Math.floor(value / 1000);

const normalizeActionSource = (value: string | null | undefined): string => {
  if (!value) {
    return 'OTHER';
  }
  return value.trim().toUpperCase();
};

export const dispatchMetaOfflineConversions = async (
  tenantId: string,
  events: MetaOfflineConversionEvent[],
  options: DispatchMetaOfflineConversionsOptions = {}
): Promise<DispatchMetaOfflineConversionsResult> => {
  if (!events.length) {
    logger.info('Meta offline conversions :: Nenhum evento recebido, nada a fazer', { tenantId });
    return { success: true, skipped: true, status: 204 };
  }

  const config = await loadMetaOfflineConfig(tenantId);
  const hasCredentials = Boolean(config.accessToken && config.offlineEventSetId);
  if (!hasCredentials) {
    logger.warn('Meta offline conversions :: credenciais ausentes, job ignorado', {
      tenantId,
      offlineEventSetId: config.offlineEventSetId ?? null,
    });
    await markMetaOfflineValidationResult(tenantId, {
      success: false,
      message: 'Credenciais Meta ausentes',
    });
    return { success: false, skipped: true, error: 'MISSING_CREDENTIALS' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildGraphUrl({
    baseUrl: options.graphApiBaseUrl ?? process.env.META_GRAPH_API_BASE_URL,
    version: options.graphApiVersion ?? process.env.META_GRAPH_API_VERSION,
    offlineEventSetId: config.offlineEventSetId!,
  });

  const payload = {
    data: events.map((event) => ({
      event_name: event.eventName ?? config.eventName ?? 'OfflineConversion',
      event_time: toSeconds(event.eventTime ?? Date.now()),
      action_source: normalizeActionSource(event.actionSource ?? config.actionSource ?? 'OTHER'),
      user_data: event.userData ?? {},
      custom_data: event.customData ?? {},
    })),
    access_token: config.accessToken,
  };

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        (body && typeof body === 'object' && body !== null &&
          typeof (body as Record<string, any>)?.error?.message === 'string'
          ? ((body as Record<string, any>).error as Record<string, any>).message
          : null) ?? `Graph API respondeu ${response.status}`;

      await markMetaOfflineValidationResult(tenantId, {
        success: false,
        message: errorMessage,
      });

      logger.error('Meta offline conversions :: falha ao enviar eventos', {
        tenantId,
        status: response.status,
        error: errorMessage,
      });

      return {
        success: false,
        status: response.status,
        error: errorMessage,
        response: body,
      };
    }

    await markMetaOfflineValidationResult(tenantId, {
      success: true,
    });

    logger.info('Meta offline conversions :: eventos enviados para Meta', {
      tenantId,
      totalEvents: events.length,
    });

    return {
      success: true,
      status: response.status,
      response: body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    await markMetaOfflineValidationResult(tenantId, {
      success: false,
      message,
    });

    logger.error('Meta offline conversions :: exceção ao chamar Graph API', {
      tenantId,
      error: message,
    });

    return {
      success: false,
      error: message,
    };
  }
};

export const __testing = {
  buildGraphUrl,
  toSeconds,
  normalizeActionSource,
};
