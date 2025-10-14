import { Buffer } from 'node:buffer';
import { fetch, type RequestInit, type Response as UndiciResponse } from 'undici';
import { logger } from '../config/logger';
import {
  getBrokerApiKey,
  getBrokerBaseUrl,
  getBrokerTimeoutMs,
  getBrokerWebhookUrl,
  getWebhookVerifyToken,
} from '../config/whatsapp';
import {
  BrokerOutboundMessageSchema,
  BrokerOutboundResponseSchema,
  type BrokerOutboundMessage,
  type BrokerOutboundResponse,
} from '../features/whatsapp-inbound/schemas/broker-contracts';
import {
  CANONICAL_ERRORS,
  type WhatsAppCanonicalError,
} from '@ticketz/wa-contracts';

export class WhatsAppBrokerNotConfiguredError extends Error {
  constructor(message = 'WhatsApp broker not configured') {
    super(message);
    this.name = 'WhatsAppBrokerNotConfiguredError';
  }
}

export type WhatsAppBrokerErrorOptions = {
  code?: string;
  brokerStatus?: number;
  brokerCode?: string;
  requestId?: string;
  cause?: unknown;
};

export class WhatsAppBrokerError extends Error {
  status = 502 as const;
  code: string;
  requestId?: string;
  brokerStatus?: number;
  brokerCode?: string;
  cause?: unknown;

  constructor(
    message: string,
    codeOrOptions?: string | WhatsAppBrokerErrorOptions,
    legacyStatus?: number,
    legacyRequestId?: string
  ) {
    const options: WhatsAppBrokerErrorOptions =
      typeof codeOrOptions === 'string'
        ? {
            code: codeOrOptions,
            brokerStatus: legacyStatus,
            requestId: legacyRequestId,
          }
        : codeOrOptions ?? {};

    super(message);
    this.name = 'WhatsAppBrokerError';
    this.code = options.code ?? 'BROKER_ERROR';
    this.requestId = options.requestId;
    this.brokerStatus = options.brokerStatus;
    this.brokerCode = options.brokerCode ?? options.code;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }

    if (typeof codeOrOptions === 'string') {
      if (this.brokerStatus === undefined && typeof legacyStatus === 'number') {
        this.brokerStatus = legacyStatus;
      }

      if (this.requestId === undefined && legacyRequestId) {
        this.requestId = legacyRequestId;
      }

      if (!this.brokerCode && this.code) {
        this.brokerCode = this.code;
      }
    }

    if (!this.brokerCode && this.brokerStatus !== undefined) {
      this.brokerCode = String(this.brokerStatus);
    }
  }
}

const normalizeErrorCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

const includesKeyword = (message: string, keywords: string[]): boolean => {
  const normalized = message.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

const BROKER_TIMEOUT_CODES = new Set(['REQUEST_TIMEOUT', 'BROKER_TIMEOUT', 'GATEWAY_TIMEOUT']);
const RATE_LIMIT_CODES = new Set(['RATE_LIMITED', 'RATE_LIMIT', 'RATE_LIMIT_EXCEEDED', 'TOO_MANY_REQUESTS']);
const INSTANCE_DISCONNECTED_CODES = new Set([
  'INSTANCE_NOT_CONNECTED',
  'SESSION_NOT_FOUND',
  'SESSION_NOT_CONNECTED',
  'SESSION_DISCONNECTED',
  'BROKER_SESSION_NOT_FOUND',
  'BROKER_SESSION_DISCONNECTED',
]);
const INVALID_TO_CODES = new Set([
  'INVALID_TO',
  'INVALID_TO_NUMBER',
  'INVALID_RECIPIENT',
  'INVALID_DESTINATION',
  'INVALID_PHONE',
  'INVALID_CONTACT',
  'INVALID_ADDRESS',
  'INVALID_JID',
]);

export const translateWhatsAppBrokerError = (
  error: WhatsAppBrokerError | null | undefined
): WhatsAppCanonicalError | null => {
  if (!error) {
    return null;
  }

  const code = normalizeErrorCode(error.code);
  const status = Number.isFinite(error.brokerStatus)
    ? (error.brokerStatus as number)
    : null;
  const message = typeof error.message === 'string' ? error.message : '';

  if (status === 429 || RATE_LIMIT_CODES.has(code)) {
    return CANONICAL_ERRORS.RATE_LIMITED;
  }

  if (status === 408 || status === 504 || BROKER_TIMEOUT_CODES.has(code) || includesKeyword(message, ['timeout', 'timed out'])) {
    return CANONICAL_ERRORS.BROKER_TIMEOUT;
  }

  if (
    status === 409 ||
    status === 410 ||
    INSTANCE_DISCONNECTED_CODES.has(code) ||
    includesKeyword(message, [
      'not connected',
      'disconnected',
      'desconect',
      'socket indispon',
    ])
  ) {
    return CANONICAL_ERRORS.INSTANCE_NOT_CONNECTED;
  }

  if (
    status === 422 ||
    status === 400 ||
    INVALID_TO_CODES.has(code) ||
    includesKeyword(message, ['invalid recipient', 'invalid to', 'destinat', 'recipient'])
  ) {
    return CANONICAL_ERRORS.INVALID_TO;
  }

  return null;
};

export interface WhatsAppInstance {
  id: string;
  tenantId: string;
  name?: string;
  status: 'connected' | 'disconnected' | 'qr_required' | 'connecting';
  createdAt?: string;
  lastActivity?: string | null;
  connected?: boolean;
  user?: string | null;
  phoneNumber?: string | null;
  stats?: {
    sent?: number;
    byStatus?: Record<string, unknown>;
  };
}

export interface WhatsAppQrCode {
  qr: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
  expiresAt: string | null;
}

export interface WhatsAppStatus extends WhatsAppQrCode {
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_required' | 'pending' | 'failed';
  connected: boolean;
  stats?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  rate?: Record<string, unknown> | null;
  rateUsage?: Record<string, unknown> | null;
  messages?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
}

export interface WhatsAppBrokerInstanceSnapshot {
  instance: WhatsAppInstance;
  status: WhatsAppStatus | null;
}

export interface WhatsAppMessageResult {
  externalId: string;
  status: string;
  timestamp?: string;
}

export type BrokerRequestOptions = {
  apiKey?: string;
  timeoutMs?: number;
  searchParams?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
};

export type WhatsAppBrokerResolvedConfig = {
  baseUrl: string;
  apiKey: string;
  webhookUrl: string;
  verifyToken: string;
  timeoutMs: number;
};

export const resolveWhatsAppBrokerConfig = (): WhatsAppBrokerResolvedConfig => {
  const baseUrl = getBrokerBaseUrl();
  if (!baseUrl) {
    throw new WhatsAppBrokerNotConfiguredError(
      'WhatsApp broker base URL is not configured. Set WHATSAPP_BROKER_URL.'
    );
  }

  const apiKey = getBrokerApiKey();
  if (!apiKey) {
    throw new WhatsAppBrokerNotConfiguredError(
      'WhatsApp broker API key is not configured. Set WHATSAPP_BROKER_API_KEY.'
    );
  }

  const verifyToken = getWebhookVerifyToken();
  if (!verifyToken) {
    throw new WhatsAppBrokerNotConfiguredError(
      'WhatsApp webhook verify token is not configured. Set WHATSAPP_WEBHOOK_VERIFY_TOKEN.'
    );
  }

  const webhookUrl = getBrokerWebhookUrl();
  const timeoutMs = getBrokerTimeoutMs();

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    webhookUrl,
    verifyToken,
    timeoutMs,
  };
};

export const buildWhatsAppBrokerUrl = (
  config: WhatsAppBrokerResolvedConfig,
  path: string,
  searchParams?: BrokerRequestOptions['searchParams']
): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${config.baseUrl}${normalizedPath}`);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
};

export const createBrokerTimeoutSignal = (
  timeoutMs: number
): { signal: AbortSignal; cancel: () => void } => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error('Request timed out'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
  };
};

export const handleWhatsAppBrokerError = async (response: UndiciResponse): Promise<never> => {
  let bodyText = '';

  try {
    bodyText = await response.text();
  } catch (error) {
    logger.debug('Unable to read WhatsApp broker error response', { error });
  }

  let parsed: Record<string, unknown> | undefined;

  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText) as Record<string, unknown>;
    } catch (error) {
      logger.debug('WhatsApp broker error response is not JSON', { error, bodyText });
    }
  }

  const readRequestId = (...candidates: unknown[]): string | undefined => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
    return undefined;
  };

  const normalizedError = (() => {
    const candidate =
      parsed?.error && typeof parsed.error === 'object'
        ? (parsed.error as Record<string, unknown>)
        : parsed;
    const code = typeof candidate?.code === 'string' ? candidate.code : undefined;
    const message = typeof candidate?.message === 'string' ? candidate.message : undefined;
    const requestId = readRequestId(
      candidate?.requestId,
      candidate?.request_id,
      parsed?.requestId,
      parsed?.request_id,
      candidate?.traceId,
      candidate?.trace_id,
      parsed?.traceId,
      parsed?.trace_id
    );
    return { code, message, requestId };
  })();

  const headerRequestId =
    response.headers?.get?.('x-request-id') || response.headers?.get?.('x-requestid') || undefined;

  if (response.status === 401 || response.status === 403) {
    throw new WhatsAppBrokerError(
      normalizedError.message || 'WhatsApp broker rejected credentials',
      {
        code: 'BROKER_AUTH',
        brokerStatus: response.status,
        requestId: normalizedError.requestId || headerRequestId,
      }
    );
  }

  const code = normalizedError.code || 'BROKER_ERROR';
  const message = normalizedError.message || `WhatsApp broker request failed (${response.status})`;

  throw new WhatsAppBrokerError(message, {
    code,
    brokerStatus: response.status,
    requestId: normalizedError.requestId || headerRequestId,
  });
};

export const performWhatsAppBrokerRequest = async <T>(
  path: string,
  init: RequestInit = {},
  options: BrokerRequestOptions = {},
  config: WhatsAppBrokerResolvedConfig = resolveWhatsAppBrokerConfig()
): Promise<T> => {
  const url = buildWhatsAppBrokerUrl(config, path, options.searchParams);
  const headers = new Headers(init.headers as HeadersInit | undefined);

  if (init.body && !headers.has('content-type') && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('accept') && !headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  headers.set('X-API-Key', options.apiKey ?? config.apiKey);
  if (options.idempotencyKey && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  const { signal, cancel } = createBrokerTimeoutSignal(options.timeoutMs ?? config.timeoutMs);
  const method = typeof init.method === 'string' ? init.method.toUpperCase() : 'GET';
  const timeoutMsUsed = options.timeoutMs ?? config.timeoutMs;
  const computeBodyLength = (): number | null => {
    const body = init.body;
    if (!body) {
      return 0;
    }
    if (typeof body === 'string') {
      return Buffer.byteLength(body);
    }
    if (Buffer.isBuffer(body)) {
      return body.byteLength;
    }
    if (body instanceof Uint8Array) {
      return body.byteLength;
    }
    return null;
  };
  const startedAt = Date.now();
  const bodyLength = computeBodyLength();
  const searchParamKeys = options.searchParams ? Object.keys(options.searchParams) : [];

  logger.info('🛜 [WhatsApp Broker] Preparando expedição HTTP', {
    method,
    path,
    url,
    timeoutMs: timeoutMsUsed,
    hasBody: Boolean(init.body),
    bodyLength,
    idempotencyKey: options.idempotencyKey ?? null,
    searchParams: searchParamKeys,
  });

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal,
    });

    const durationMs = Date.now() - startedAt;
    const requestId = response.headers?.get?.('x-request-id') ?? null;
    const responseContentType = response.headers?.get?.('content-type') ?? null;

    if (!response.ok) {
      logger.warn('⚠️ [WhatsApp Broker] Resposta não OK recebida do broker', {
        method,
        path,
        url,
        status: response.status,
        durationMs,
        requestId,
        contentType: responseContentType,
      });
      await handleWhatsAppBrokerError(response);
    }

    logger.info('📦 [WhatsApp Broker] Resposta do broker recebida com sucesso', {
      method,
      path,
      url,
      status: response.status,
      durationMs,
      requestId,
      contentType: responseContentType,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers?.get?.('content-type') || '';
    if (!contentType.includes('application/json')) {
      const empty = (await response.text()) || '';
      return empty ? (JSON.parse(empty) as T) : (undefined as T);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof WhatsAppBrokerError || error instanceof WhatsAppBrokerNotConfiguredError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new WhatsAppBrokerError('WhatsApp broker request timed out', {
        code: 'REQUEST_TIMEOUT',
        brokerStatus: 408,
        cause: error,
      });
    }

    const originalMessage =
      error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    const contextMessage = originalMessage
      ? `Unexpected error contacting WhatsApp broker for ${path}: ${originalMessage}`
      : `Unexpected error contacting WhatsApp broker for ${path}`;

    const wrappedError = new WhatsAppBrokerError(contextMessage, {
      code: 'BROKER_ERROR',
      cause: error,
    });

    if (error instanceof Error && error.stack) {
      wrappedError.stack = `${wrappedError.name}: ${wrappedError.message}\nCaused by: ${error.stack}`;
    }

    logger.error('Unexpected WhatsApp broker request failure', { path, error });
    throw wrappedError;
  } finally {
    cancel();
  }
};

type DeleteInstanceOptions = {
  instanceId?: string;
  wipe?: boolean;
};

class WhatsAppBrokerClient {
  private slugify(value: string, fallback = 'whatsapp'): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : fallback;
  }

  private resolveConfig(): WhatsAppBrokerResolvedConfig {
    return resolveWhatsAppBrokerConfig();
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: BrokerRequestOptions = {}
  ): Promise<T> {
    return performWhatsAppBrokerRequest<T>(path, init, options);
  }

  async connectSession(
    sessionId: string,
    payload: { instanceId?: string; code?: string; phoneNumber?: string } = {}
  ): Promise<void> {
    const instanceId =
      typeof payload.instanceId === 'string' && payload.instanceId.trim().length > 0
        ? payload.instanceId.trim()
        : sessionId;

    const encodedInstanceId = encodeURIComponent(instanceId);
    const normalizedCode =
      typeof payload.code === 'string' && payload.code.trim().length > 0
        ? payload.code.trim()
        : undefined;
    const normalizedPhoneNumber =
      typeof payload.phoneNumber === 'string' && payload.phoneNumber.trim().length > 0
        ? payload.phoneNumber.trim()
        : undefined;

    const requestBody: Record<string, string> = {};

    if (normalizedCode !== undefined) {
      requestBody.code = normalizedCode;
    }

    if (normalizedPhoneNumber !== undefined) {
      requestBody.phoneNumber = normalizedPhoneNumber;
    }

    const body = Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined;

    await this.request<void>(
      `/instances/${encodedInstanceId}/pair`,
      {
        method: 'POST',
        ...(body !== undefined ? { body } : {}),
      }
    );
  }

  async logoutSession(
    sessionId: string,
    options: { instanceId?: string } = {}
  ): Promise<void> {
    const instanceId =
      typeof options.instanceId === 'string' && options.instanceId.trim().length > 0
        ? options.instanceId.trim()
        : sessionId;

    const encodedInstanceId = encodeURIComponent(instanceId);

    await this.request<void>(`/instances/${encodedInstanceId}/logout`, {
      method: 'POST',
    });
  }

  async wipeSession(
    sessionId: string,
    options: { instanceId?: string } = {}
  ): Promise<void> {
    const instanceId =
      typeof options.instanceId === 'string' && options.instanceId.trim().length > 0
        ? options.instanceId.trim()
        : sessionId;

    const encodedInstanceId = encodeURIComponent(instanceId);

    await this.request<void>(`/instances/${encodedInstanceId}/session/wipe`, {
      method: 'POST',
    });
  }

  async getSessionStatus<T = Record<string, unknown>>(
    sessionId: string,
    options: { instanceId?: string } = {}
  ): Promise<T> {
    const instanceId =
      typeof options.instanceId === 'string' && options.instanceId.trim().length > 0
        ? options.instanceId.trim()
        : sessionId;

    const encodedInstanceId = encodeURIComponent(instanceId);

    return this.request<T>(
      `/instances/${encodedInstanceId}/status`,
      {
        method: 'GET',
      }
    );
  }

  async getMetrics(
    payload: { sessionId: string; instanceId?: string }
  ): Promise<Record<string, unknown>> {
    const sessionId = payload.sessionId;
    const instanceId = payload.instanceId ?? sessionId;
    const encodedInstanceId = encodeURIComponent(instanceId);

    return this.request<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/metrics`,
      { method: 'GET' }
    );
  }

  private pickString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  }

  private normalizeStatus(
    statusValue: unknown,
    connectedValue?: unknown
  ): { status: WhatsAppInstance['status']; connected: boolean } {
    const rawStatus = typeof statusValue === 'string' ? statusValue.trim().toLowerCase() : undefined;

    const connected = (() => {
      if (typeof connectedValue === 'boolean') {
        return connectedValue;
      }

      if (typeof connectedValue === 'string') {
        const normalized = connectedValue.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'connected'].includes(normalized)) {
          return true;
        }
        if (['false', '0', 'no', 'n', 'disconnected'].includes(normalized)) {
          return false;
        }
      }

      if (connectedValue !== undefined && connectedValue !== null) {
        return Boolean(connectedValue);
      }

      return rawStatus === 'connected';
    })();

    const normalizedStatus = (() => {
      switch (rawStatus) {
        case 'connected':
        case 'connecting':
        case 'disconnected':
        case 'qr_required':
          return rawStatus;
        case 'qr required':
          return 'qr_required';
        default:
          return connected ? 'connected' : 'disconnected';
      }
    })();

    return { status: normalizedStatus, connected };
  }

  private normalizeQrPayload(value: unknown): WhatsAppQrCode {
    const record = this.asRecord(value);
    if (!record) {
      return { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null };
    }

    const visited = new Set<Record<string, unknown>>();
    const queue: Record<string, unknown>[] = [];
    const sources: Record<string, unknown>[] = [];

    const enqueue = (candidate: unknown): void => {
      const normalized = this.asRecord(candidate);
      if (!normalized || visited.has(normalized)) {
        return;
      }

      visited.add(normalized);
      queue.push(normalized);
      sources.push(normalized);
    };

    enqueue(record);

    while (queue.length > 0) {
      const current = queue.shift()!;
      enqueue(current['status']);
      enqueue(current['sessionStatus']);
      enqueue(current['session_status']);
      enqueue(current['data']);
      enqueue(current['metadata']);
      enqueue(current['payload']);
      enqueue(current['qr']);
    }

    const directCandidates: unknown[] = [];
    const qrCodeCandidates: unknown[] = [];
    const qrExpiresAtCandidates: unknown[] = [];
    const expiresAtCandidates: unknown[] = [];

    for (const source of sources) {
      directCandidates.push(source['qr'], source['qrCode'], source['qr_code'], source['code']);
      qrCodeCandidates.push(source['qrCode'], source['qr_code'], source['code']);
      qrExpiresAtCandidates.push(source['qrExpiresAt'], source['qr_expires_at']);
      expiresAtCandidates.push(source['expiresAt'], source['expires_at']);
    }

    const resolvedQr = this.pickString(...directCandidates, ...qrCodeCandidates);
    const qrCodeCandidate = this.pickString(...qrCodeCandidates);
    const qrExpiresAt = this.pickString(...qrExpiresAtCandidates);
    const expiresAt = this.pickString(...expiresAtCandidates) ?? qrExpiresAt;

    return {
      qr: resolvedQr,
      qrCode: qrCodeCandidate ?? resolvedQr,
      qrExpiresAt,
      expiresAt: expiresAt ?? null,
    };
  }

  private normalizeBrokerInstance(
    tenantId: string,
    value: unknown
  ): WhatsAppInstance | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const source = value as Record<string, unknown>;
    const metadata =
      source.metadata && typeof source.metadata === 'object'
        ? (source.metadata as Record<string, unknown>)
        : {};

    const statusRecord = this.pickRecord(
      source.status,
      source.state,
      source.sessionStatus,
      metadata.status,
      metadata.state
    );

    const idCandidate = this.pickString(
      source.instanceId,
      metadata.instanceId,
      metadata.instance_id,
      source.id,
      source._id,
      source.sessionId,
      metadata.id,
      metadata._id,
      metadata.sessionId
    );

    if (!idCandidate) {
      return null;
    }

    const statusValue = this.pickString(
      statusRecord?.['status'],
      statusRecord?.['state'],
      statusRecord?.['value'],
      source.status,
      source.state,
      metadata.status,
      metadata.state
    );

    const connectedCandidate = this.pickFirstDefined(
      statusRecord?.['connected'],
      statusRecord?.['isConnected'],
      statusRecord?.['connected_at'],
      statusRecord?.['connectedAt'],
      source.connected,
      source.isConnected,
      source.connected_at,
      source.connectedAt,
      metadata.connected,
      metadata.isConnected,
      metadata.connected_at,
      metadata.connectedAt
    );

    const { status, connected } = this.normalizeStatus(statusValue, connectedCandidate);

    const resolvedTenantId =
      this.pickString(source.tenantId, metadata.tenantId, metadata.tenant_id) ?? tenantId;

    const createdAt =
      this.pickString(source.createdAt, source.created_at, metadata.createdAt, metadata.created_at) ||
      undefined;

    const lastActivity =
      this.pickString(
        source.lastActivity,
        metadata.lastActivity,
        metadata.last_activity,
        metadata.lastActiveAt,
        metadata.last_active_at,
        metadata.lastSeen,
        metadata.last_seen
      ) || null;

    const phoneNumber =
      this.pickString(
        source.phoneNumber,
        statusRecord?.['phoneNumber'],
        statusRecord?.['phone_number'],
        statusRecord?.['msisdn'],
        statusRecord?.['phone'],
        metadata.phoneNumber,
        metadata.phone_number,
        metadata.msisdn,
        metadata.phone
      ) || null;

    const user =
      this.pickString(
        source.user,
        statusRecord?.['user'],
        statusRecord?.['operator'],
        metadata.user,
        metadata.userName,
        metadata.username,
        metadata.operator
      ) || null;

    const name =
      this.pickString(
        source.name,
        statusRecord?.['name'],
        statusRecord?.['displayName'],
        metadata.name,
        metadata.displayName,
        metadata.sessionName,
        metadata.instanceName,
        metadata.profileName
      ) || undefined;

    const statsCandidate =
      this.pickRecord(
        statusRecord?.['stats'],
        source.stats,
        metadata.stats
      );

    return {
      id: idCandidate,
      tenantId: resolvedTenantId,
      name,
      status,
      createdAt,
      lastActivity,
      connected,
      phoneNumber: phoneNumber ?? undefined,
      user: user ?? undefined,
      stats: statsCandidate ?? undefined,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private pickRecord(...values: unknown[]): Record<string, unknown> | null {
    for (const value of values) {
      const record = this.asRecord(value);
      if (record) {
        return record;
      }
    }

    return null;
  }

  private pickFirstDefined(...values: unknown[]): unknown {
    for (const value of values) {
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  private buildStatusFromRecords(
    primary: Record<string, unknown> | null,
    additional: Record<string, unknown>[] = []
  ): WhatsAppStatus | null {
    const sources = [primary, ...additional].filter(
      (entry): entry is Record<string, unknown> => Boolean(entry)
    );

    if (!sources.length) {
      return null;
    }

    const nestedStatusRecords = sources
      .map((source) => this.asRecord(source['status']))
      .filter((record): record is Record<string, unknown> => Boolean(record));
    const extendedSources = [...sources, ...nestedStatusRecords];

    const statusValue = this.pickString(
      ...extendedSources.map((source) => source['status']),
      ...extendedSources.map((source) => source['state']),
      ...extendedSources.map((source) => source['value'])
    );

    const connectedCandidate = this.pickFirstDefined(
      ...extendedSources.map((source) => source['connected']),
      ...extendedSources.map((source) => source['isConnected']),
      ...extendedSources.map((source) => source['connected_at']),
      ...extendedSources.map((source) => source['connectedAt']),
      ...extendedSources.map((source) => source['online']),
      ...extendedSources.map((source) => source['ready'])
    );

    const { status, connected } = this.normalizeStatus(statusValue, connectedCandidate);

    const qrSource: Record<string, unknown> = {};
    for (const source of extendedSources) {
      Object.assign(qrSource, source);
    }

    const statsCandidate = this.pickRecord(
      ...extendedSources.map((source) => source['stats']),
      ...extendedSources.map((source) => source['messages']),
      ...extendedSources.map((source) => source['counters'])
    );

    const metricsCandidate = this.pickRecord(
      ...extendedSources.map((source) => source['metrics']),
      ...extendedSources.map((source) => source['rateUsage']),
      statsCandidate ?? undefined
    );

    const messagesCandidate = this.pickRecord(
      ...extendedSources.map((source) => source['messages'])
    );

    const rateCandidate = this.pickRecord(
      ...extendedSources.map((source) => source['rate']),
      ...extendedSources.map((source) => source['rateLimiter']),
      ...extendedSources.map((source) => source['limits'])
    );

    const rateUsageCandidate = this.pickRecord(
      ...extendedSources.map((source) => source['rateUsage']),
      rateCandidate ?? undefined
    );

    const normalizedQr = this.normalizeQrPayload(qrSource);

    return {
      status,
      connected,
      ...normalizedQr,
      stats: statsCandidate ?? messagesCandidate ?? null,
      metrics: metricsCandidate ?? statsCandidate ?? null,
      messages: messagesCandidate ?? null,
      rate: rateCandidate ?? null,
      rateUsage: rateUsageCandidate ?? rateCandidate ?? null,
      raw: primary ?? (extendedSources.length > 0 ? extendedSources[0] : null),
    };
  }

  private normalizeStatusResponse(
    value: unknown,
    additional: Record<string, unknown>[] = []
  ): WhatsAppStatus | null {
    const record = this.asRecord(value);
    const aggregate: Record<string, unknown>[] = [...additional];

    if (record) {
      aggregate.push(record);
      const dataRecord = this.asRecord(record['data']);
      if (dataRecord) {
        aggregate.push(dataRecord);
      }
    }

    if (aggregate.length === 0) {
      return null;
    }

    const primary = this.pickRecord(
      record?.['status'],
      record?.['sessionStatus'],
      this.asRecord(record?.['data'])?.['status'],
      ...aggregate
    );

    return this.buildStatusFromRecords(primary, aggregate);
  }

  private normalizeInstanceSnapshot(
    tenantId: string,
    value: unknown
  ): WhatsAppBrokerInstanceSnapshot | null {
    const instance = this.normalizeBrokerInstance(tenantId, value);
    if (!instance) {
      return null;
    }

    const record = this.asRecord(value);
    const metadataRecord = record ? this.asRecord(record['metadata']) : null;
    const status = this.normalizeStatusResponse(value, [
      ...(metadataRecord ? [metadataRecord] : []),
    ]);

    return {
      instance,
      status,
    };
  }

  private findSessionPayloads(value: unknown): Record<string, unknown>[] {
    const sessions: Record<string, unknown>[] = [];
    const visited = new Set<unknown>();
    const queue: Record<string, unknown>[] = [];

    const enqueue = (entry: unknown): void => {
      if (!entry || visited.has(entry)) {
        return;
      }

      if (Array.isArray(entry)) {
        visited.add(entry);
        entry.forEach(enqueue);
        return;
      }

      if (typeof entry === 'object') {
        visited.add(entry);
        queue.push(entry as Record<string, unknown>);
      }
    };

    enqueue(value);

    const looksLikeSession = (candidate: Record<string, unknown>): boolean => {
      return [
        'id',
        '_id',
        'sessionId',
        'instanceId',
        'status',
        'metadata',
      ].some((key) => key in candidate);
    };

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (looksLikeSession(current)) {
        sessions.push(current);
      }

      Object.values(current).forEach(enqueue);
    }

    return sessions;
  }

  async listInstances(tenantId: string): Promise<WhatsAppBrokerInstanceSnapshot[]> {
    const normalizedTenantId =
      typeof tenantId === 'string' ? tenantId.trim() : '';
    const requestOptions: BrokerRequestOptions = normalizedTenantId.length > 0
      ? { searchParams: { tenantId: normalizedTenantId } }
      : {};

    const response = await this.request<unknown>(
      '/instances',
      {
        method: 'GET',
      },
      requestOptions
    );

    const sessions = this.findSessionPayloads(response);
    if (!sessions.length) {
      logger.debug('WhatsApp broker instances payload missing data', {
        tenantId,
        response,
      });
      return [];
    }

    const normalized = sessions
      .map((session) => this.normalizeInstanceSnapshot(tenantId, session))
      .filter((snapshot): snapshot is WhatsAppBrokerInstanceSnapshot => Boolean(snapshot));

    if (!normalized.length) {
      logger.debug('WhatsApp broker instances could not be normalised', {
        tenantId,
        response,
      });
      return [];
    }

    const deduped = new Map<string, WhatsAppBrokerInstanceSnapshot>();
    const fallbacks: WhatsAppBrokerInstanceSnapshot[] = [];

    for (const snapshot of normalized) {
      const normalizedId = snapshot.instance.id.trim();

      if (normalizedId.length > 0) {
        const existing = deduped.get(normalizedId);
        if (!existing || (!existing.status && snapshot.status)) {
          deduped.set(normalizedId, snapshot);
        }
      } else {
        fallbacks.push(snapshot);
      }
    }

    return [...deduped.values(), ...fallbacks];
  }

  async createInstance(args: {
    tenantId: string;
    name: string;
    instanceId?: string;
    webhookUrl?: string;
  }): Promise<WhatsAppInstance> {
    const config = this.resolveConfig();

    const requestedInstanceId =
      typeof args.instanceId === 'string' && args.instanceId.trim().length > 0
        ? args.instanceId.trim()
        : this.slugify(args.name, 'instance');

    const webhookUrl =
      typeof args.webhookUrl === 'string' && args.webhookUrl.trim().length > 0
        ? args.webhookUrl.trim()
        : config.webhookUrl;

    let response: unknown;

    try {
      response = await this.request<unknown>('/instances', {
        method: 'POST',
        body: JSON.stringify({
          id: requestedInstanceId,
          webhookUrl,
          verifyToken: config.verifyToken,
        }),
      });
    } catch (error) {
      logger.warn('Unable to create WhatsApp instance via broker', {
        tenantId: args.tenantId,
        instanceId: requestedInstanceId,
        error,
      });
      throw error;
    }

    const sessions = this.findSessionPayloads(response);
    for (const session of sessions) {
      const snapshot = this.normalizeInstanceSnapshot(args.tenantId, session);
      if (snapshot?.instance) {
        return snapshot.instance;
      }
    }

    const normalizedInstance = this.normalizeBrokerInstance(args.tenantId, response);
    if (normalizedInstance) {
      return normalizedInstance;
    }

    logger.warn('WhatsApp broker create response missing instance data, falling back to request payload', {
      tenantId: args.tenantId,
      instanceId: requestedInstanceId,
      response,
    });

    return {
      id: requestedInstanceId,
      tenantId: args.tenantId,
      name: args.name,
      status: 'connecting',
      connected: false,
    };
  }

  async connectInstance(
    brokerId: string,
    options: { instanceId?: string; code?: string; phoneNumber?: string } = {}
  ): Promise<void> {
    this.resolveConfig();
    await this.connectSession(brokerId, {
      instanceId: options.instanceId ?? brokerId,
      code: options.code,
      phoneNumber: options.phoneNumber,
    });
  }

  async disconnectInstance(
    brokerId: string,
    options: { instanceId?: string; wipe?: boolean } = {}
  ): Promise<void> {
    this.resolveConfig();
    const instanceId = options.instanceId ?? brokerId;
    await this.logoutSession(brokerId, { instanceId });
    if (options.wipe) {
      await this.wipeSession(brokerId, { instanceId });
    }
  }

  async deleteInstance(
    brokerId: string,
    options: DeleteInstanceOptions = {}
  ): Promise<void> {
    this.resolveConfig();

    const encodedBrokerId = encodeURIComponent(brokerId);
    const normalizedInstanceId =
      typeof options.instanceId === 'string' && options.instanceId.trim().length > 0
        ? options.instanceId.trim()
        : brokerId;

    if (options.wipe) {
      await this.wipeSession(brokerId, { instanceId: normalizedInstanceId });
    }

    await this.request<void>(`/instances/${encodedBrokerId}`, {
      method: 'DELETE',
    });
  }

  async getQrCode(brokerId: string, options: { instanceId?: string } = {}): Promise<WhatsAppQrCode> {
    const config = this.resolveConfig();

    const instanceId = options.instanceId ?? brokerId;
    const normalizedInstanceId =
      typeof options.instanceId === 'string' ? options.instanceId.trim() : '';
    const searchParams: BrokerRequestOptions['searchParams'] =
      normalizedInstanceId && normalizedInstanceId !== brokerId
        ? { instanceId: normalizedInstanceId }
        : undefined;

    const fallbackFromStatus = async (): Promise<WhatsAppQrCode> => {
      try {
        const statusPayload = await this.getSessionStatus<Record<string, unknown>>(
          brokerId,
          { instanceId }
        );
        return this.normalizeQrPayload(statusPayload);
      } catch (statusError) {
        if (statusError instanceof WhatsAppBrokerNotConfiguredError) {
          throw statusError;
        }

        if (statusError instanceof WhatsAppBrokerError) {
          if (statusError.brokerStatus === 404) {
            return { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null };
          }

          logger.warn('Failed to fetch WhatsApp QR code via status fallback', {
            instanceId,
            error: statusError,
          });
          return { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null };
        }

        logger.warn('Unexpected error while fetching WhatsApp QR code fallback', {
          instanceId,
          error: statusError,
        });
        return { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null };
      }
    };

    const encodedBrokerId = encodeURIComponent(brokerId);
    const url = buildWhatsAppBrokerUrl(config, `/instances/${encodedBrokerId}/qr.png`, searchParams);
    const headers = new Headers();
    headers.set('X-API-Key', config.apiKey);
    headers.set('Accept', 'image/png, application/json');
    headers.set('accept', 'image/png,application/json;q=0.9,*/*;q=0.8');

    const { signal, cancel } = createBrokerTimeoutSignal(config.timeoutMs);

    try {
      const response = await fetch(url, { method: 'GET', headers, signal });

      if (!response.ok) {
        if (response.status === 404) {
          return await fallbackFromStatus();
        }

        await handleWhatsAppBrokerError(response);
      }

      const contentType = response.headers?.get?.('content-type') || '';

      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as Record<string, unknown>;
        return this.normalizeQrPayload(payload);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return await fallbackFromStatus();
      }

      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        return await fallbackFromStatus();
      }

      const base64 = buffer.toString('base64');
      const expiresHeader =
        response.headers?.get?.('x-qr-expires-at') ||
        response.headers?.get?.('x-qr-expires') ||
        response.headers?.get?.('x-qr-expiresat') ||
        null;

      const payload: Record<string, unknown> = {
        qr: `data:image/png;base64,${base64}`,
        qrCode: `data:image/png;base64,${base64}`,
      };

      if (expiresHeader) {
        payload.qrExpiresAt = expiresHeader;
        payload.expiresAt = expiresHeader;
      }

      return this.normalizeQrPayload(payload);
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      if (error instanceof WhatsAppBrokerError && error.brokerStatus === 404) {
        return await fallbackFromStatus();
      }

      logger.warn('Failed to fetch WhatsApp QR code image from broker', {
        instanceId,
        error,
      });
    } finally {
      cancel();
    }

    return fallbackFromStatus();
  }

  async getStatus(brokerId: string, options: { instanceId?: string } = {}): Promise<WhatsAppStatus> {
    this.resolveConfig();

    const fallback: WhatsAppStatus = {
      status: 'disconnected',
      connected: false,
      qr: null,
      qrCode: null,
      qrExpiresAt: null,
      expiresAt: null,
      stats: null,
      metrics: null,
      messages: null,
      rate: null,
      rateUsage: null,
      raw: null,
    };

    try {
      const result = await this.getSessionStatus<unknown>(brokerId, {
        instanceId: options.instanceId ?? brokerId,
      });

      const normalized = this.normalizeStatusResponse(result);

      if (normalized) {
        logger.debug('🛰️ [BrokerClient] Session status normalizado', {
          brokerId,
          instanceId: options.instanceId ?? brokerId,
          status: normalized.status,
          connected: normalized.connected,
          hasStats: Boolean(normalized.stats),
          hasMetrics: Boolean(normalized.metrics),
          hasMessages: Boolean(normalized.messages),
        });

        return normalized;
      }
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      logger.warn('Failed to resolve WhatsApp session status via minimal broker; assuming disconnected', { error });
      return fallback;
    }

    logger.warn('WhatsApp broker status payload missing data; assuming disconnected', {
      brokerId,
      instanceId: options.instanceId ?? brokerId,
    });

    return fallback;
  }

}

export const whatsappBrokerClient = new WhatsAppBrokerClient();
