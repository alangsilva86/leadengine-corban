import { Buffer } from 'node:buffer';
import { fetch, type RequestInit, type Response as UndiciResponse } from 'undici';
import { logger } from '../config/logger';
import {
  BrokerOutboundMessageSchema,
  BrokerOutboundResponseSchema,
  type BrokerOutboundMessage,
  type BrokerOutboundResponse,
} from '../features/whatsapp-inbound/schemas/broker-contracts';

export class WhatsAppBrokerNotConfiguredError extends Error {
  constructor(message = 'WhatsApp broker not configured') {
    super(message);
    this.name = 'WhatsAppBrokerNotConfiguredError';
  }
}

export class WhatsAppBrokerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, code: string, status: number, requestId?: string) {
    super(message);
    this.name = 'WhatsAppBrokerError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export type NormalizedWhatsAppBrokerErrorCode =
  | 'INSTANCE_NOT_CONNECTED'
  | 'INVALID_TO'
  | 'RATE_LIMITED'
  | 'BROKER_TIMEOUT';

export type NormalizedWhatsAppBrokerError = {
  code: NormalizedWhatsAppBrokerErrorCode;
  message: string;
};

const NORMALIZED_ERROR_COPY: Record<NormalizedWhatsAppBrokerErrorCode, NormalizedWhatsAppBrokerError> = {
  INSTANCE_NOT_CONNECTED: {
    code: 'INSTANCE_NOT_CONNECTED',
    message: 'Instância de WhatsApp desconectada. Reabra a sessão para continuar.',
  },
  INVALID_TO: {
    code: 'INVALID_TO',
    message: 'Número de destino inválido ou indisponível para receber mensagens.',
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Limite de envio do WhatsApp atingido. Aguarde alguns instantes e tente novamente.',
  },
  BROKER_TIMEOUT: {
    code: 'BROKER_TIMEOUT',
    message: 'Tempo limite ao contatar o broker do WhatsApp. Tente reenviar em instantes.',
  },
};

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
): NormalizedWhatsAppBrokerError | null => {
  if (!error) {
    return null;
  }

  const code = normalizeErrorCode(error.code);
  const status = Number.isFinite(error.status) ? (error.status as number) : null;
  const message = typeof error.message === 'string' ? error.message : '';

  if (status === 429 || RATE_LIMIT_CODES.has(code)) {
    return NORMALIZED_ERROR_COPY.RATE_LIMITED;
  }

  if (status === 408 || status === 504 || BROKER_TIMEOUT_CODES.has(code) || includesKeyword(message, ['timeout', 'timed out'])) {
    return NORMALIZED_ERROR_COPY.BROKER_TIMEOUT;
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
    return NORMALIZED_ERROR_COPY.INSTANCE_NOT_CONNECTED;
  }

  if (
    status === 422 ||
    status === 400 ||
    INVALID_TO_CODES.has(code) ||
    includesKeyword(message, ['invalid recipient', 'invalid to', 'destinat', 'recipient'])
  ) {
    return NORMALIZED_ERROR_COPY.INVALID_TO;
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

const DEFAULT_TIMEOUT_MS = 15_000;

type BrokerRequestOptions = {
  apiKey?: string;
  timeoutMs?: number;
  searchParams?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
};

type DeleteInstanceOptions = {
  instanceId?: string;
  wipe?: boolean;
  [key: string]: string | number | boolean | undefined;
};

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
};

type SendMessagePayload = {
  to: string;
  content?: string;
  caption?: string;
  type?: string;
  previewUrl?: boolean;
  externalId?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  media?: Record<string, unknown>;
  location?: Record<string, unknown>;
  template?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

class WhatsAppBrokerClient {
  private sessionRoutesPreference: 'unknown' | 'broker' | 'legacy' = 'unknown';

  private get mode(): string {
    return (process.env.WHATSAPP_MODE || '').trim().toLowerCase();
  }

  private get brokerMode(): 'broker' | 'instances' | 'default' {
    const normalized = (process.env.BROKER_MODE || '').trim().toLowerCase();

    if (['broker', 'session', 'sessions'].includes(normalized)) {
      return 'broker';
    }

    if (['instance', 'instances'].includes(normalized)) {
      return 'instances';
    }

    return 'default';
  }

  private get useBrokerSessions(): boolean {
    return this.brokerMode === 'broker';
  }

  private get deliveryMode(): 'broker' | 'instances' | 'auto' {
    const normalized = (process.env.WHATSAPP_BROKER_DELIVERY_MODE || '')
      .trim()
      .toLowerCase();

    if (normalized === 'broker' || normalized === 'instances') {
      return normalized;
    }

    return 'auto';
  }

  private get baseUrl(): string {
    const configured = (process.env.BROKER_BASE_URL || process.env.WHATSAPP_BROKER_URL || '').trim();
    return configured ? configured.replace(/\/$/, '') : '';
  }

  private get brokerApiKey(): string {
    const configured = (process.env.BROKER_API_KEY || process.env.WHATSAPP_BROKER_API_KEY || '').trim();
    return configured;
  }

  private get shouldStripLegacyPlus(): boolean {
    return (process.env.WHATSAPP_BROKER_LEGACY_STRIP_PLUS || '')
      .trim()
      .toLowerCase()
      .startsWith('t');
  }

  private get webhookApiKey(): string {
    return process.env.WHATSAPP_WEBHOOK_API_KEY || this.brokerApiKey;
  }

  private get timeoutMs(): number {
    const parsed = Number.parseInt(process.env.WHATSAPP_BROKER_TIMEOUT_MS || '', 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private ensureConfigured(): void {
    if (this.mode !== 'http') {
      const message = this.mode
        ? 'WhatsApp broker only available when WHATSAPP_MODE is set to "http"'
        : 'WhatsApp broker requires WHATSAPP_MODE=http to be enabled';
      throw new WhatsAppBrokerNotConfiguredError(message);
    }

    if (!this.baseUrl) {
      throw new WhatsAppBrokerNotConfiguredError(
        'WhatsApp broker base URL is not configured. Set BROKER_BASE_URL or WHATSAPP_BROKER_URL.'
      );
    }

    if (!this.brokerApiKey) {
      throw new WhatsAppBrokerNotConfiguredError(
        'WhatsApp broker API key is not configured. Set BROKER_API_KEY or WHATSAPP_BROKER_API_KEY.'
      );
    }
  }

  private buildUrl(path: string, searchParams?: BrokerRequestOptions['searchParams']): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && `${value}`.length > 0) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error('Request timed out'));
    }, timeoutMs);

    return {
      signal: controller.signal,
      cancel: () => clearTimeout(timeout),
    };
  }

  private slugify(value: string, fallback = 'whatsapp'): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : fallback;
  }

  private async handleError(response: UndiciResponse): Promise<never> {
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
      const candidate = parsed?.error && typeof parsed.error === 'object' ? (parsed.error as Record<string, unknown>) : parsed;
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

    if (response.status === 401 || response.status === 403) {
      const headerRequestId =
        response.headers?.get?.('x-request-id') ||
        response.headers?.get?.('x-requestid') ||
        undefined;

      throw new WhatsAppBrokerError(
        normalizedError.message || 'WhatsApp broker rejected credentials',
        'BROKER_AUTH',
        502,
        normalizedError.requestId || headerRequestId
      );
    }

    const code = normalizedError.code || 'BROKER_ERROR';
    const message =
      normalizedError.message || `WhatsApp broker request failed (${response.status})`;
    const headerRequestId =
      response.headers?.get?.('x-request-id') ||
      response.headers?.get?.('x-requestid') ||
      undefined;

    throw new WhatsAppBrokerError(
      message,
      code,
      response.status,
      normalizedError.requestId || headerRequestId
    );
  }

  private formatLegacyRecipient(to: string): string {
    const trimmed = to.trim();
    if (!this.shouldStripLegacyPlus) {
      return trimmed;
    }

    return trimmed.replace(/^\+/, '');
  }

  private normalizeLegacyTimestamp(candidate: unknown, fallback: string): string {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed.length > 0 ? trimmed : fallback;
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const ms = candidate > 1_000_000_000_000 ? candidate : candidate * 1000;
      try {
        return new Date(ms).toISOString();
      } catch (error) {
        logger.debug('Failed to normalise legacy broker timestamp', { error, candidate });
        return fallback;
      }
    }

    return fallback;
  }

  private normalizeLegacyResponse(
    payload: BrokerOutboundMessage,
    response: Record<string, unknown> | undefined
  ): WhatsAppMessageResult & { raw?: Record<string, unknown> | null } {
    const rawResponse = response ?? {};
    const fallbackId = payload.externalId ?? `msg-${Date.now()}`;
    const externalIdCandidate = (() => {
      const candidates = [rawResponse.externalId, rawResponse.messageId, rawResponse.id, fallbackId];
      for (const candidate of candidates) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed.length > 0) {
            return trimmed;
          }
        }
      }
      return fallbackId;
    })();

    const statusCandidate = (() => {
      const candidates = [rawResponse.status, rawResponse.state, 'sent'];
      for (const candidate of candidates) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed.length > 0) {
            return trimmed;
          }
        }
      }
      return 'sent';
    })();

    const fallbackTimestamp = new Date().toISOString();
    const timestampCandidate =
      rawResponse.timestamp ?? rawResponse.sentAt ?? rawResponse.createdAt ?? rawResponse.dispatchedAt;
    const timestamp = this.normalizeLegacyTimestamp(timestampCandidate, fallbackTimestamp);

    return {
      externalId: externalIdCandidate,
      status: statusCandidate,
      timestamp,
      raw: rawResponse ?? null,
    };
  }

  private buildDirectMediaRequestPayload(
    normalizedPayload: BrokerOutboundMessage,
    rawPayload: SendMessagePayload
  ): Record<string, unknown> {
    const supportedMediaTypes = new Set(['image', 'video', 'document', 'audio']);

    if (!supportedMediaTypes.has(normalizedPayload.type)) {
      return {};
    }

    const rawMedia =
      rawPayload.media && typeof rawPayload.media === 'object' ? rawPayload.media : undefined;

    const toTrimmedString = (value: unknown): string | undefined => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const captionCandidate = (() => {
      const directCaption = toTrimmedString(rawPayload.caption);
      if (directCaption) {
        return directCaption;
      }

      const normalized = toTrimmedString(normalizedPayload.content);
      if (normalized && normalizedPayload.type !== 'text') {
        return normalized;
      }

      return undefined;
    })();

    return compactObject({
      mediaUrl:
        toTrimmedString(rawPayload.mediaUrl) ??
        toTrimmedString(normalizedPayload.media?.url) ??
        (rawMedia ? toTrimmedString(rawMedia['url']) : undefined),
      mimeType:
        toTrimmedString(rawPayload.mediaMimeType) ??
        toTrimmedString(normalizedPayload.media?.mimetype) ??
        (rawMedia
          ? toTrimmedString(rawMedia['mimeType'] ?? rawMedia['mimetype'])
          : undefined),
      fileName:
        toTrimmedString(rawPayload.mediaFileName) ??
        toTrimmedString(normalizedPayload.media?.filename) ??
        (rawMedia
          ? toTrimmedString(rawMedia['fileName'] ?? rawMedia['filename'])
          : undefined),
      caption: captionCandidate,
    });
  }

  private buildMessageResult(
    normalizedPayload: BrokerOutboundMessage,
    normalizedResponse: BrokerOutboundResponse
  ): WhatsAppMessageResult & { raw?: Record<string, unknown> | null } {
    const externalId =
      normalizedResponse.externalId ?? normalizedPayload.externalId ?? normalizedResponse.id ?? `msg-${Date.now()}`;

    const status = normalizedResponse.status || 'sent';

    return {
      externalId,
      status,
      timestamp: normalizedResponse.timestamp ?? new Date().toISOString(),
      raw: normalizedResponse.raw ?? null,
    };
  }

  private createInstanceDisconnectedError(source: WhatsAppBrokerError): WhatsAppBrokerError {
    return new WhatsAppBrokerError(
      NORMALIZED_ERROR_COPY.INSTANCE_NOT_CONNECTED.message,
      'INSTANCE_NOT_CONNECTED',
      409,
      source.requestId
    );
  }

  private async sendViaDirectRoutes(
    instanceId: string,
    normalizedPayload: BrokerOutboundMessage,
    options: { rawPayload: SendMessagePayload; idempotencyKey?: string }
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    const supportedTypes = new Set([
      'text',
      'image',
      'video',
      'document',
      'audio',
      'template',
      'location',
    ]);

    if (!supportedTypes.has(normalizedPayload.type)) {
      const unsupportedMessage = `Direct route for ${normalizedPayload.type} messages is not supported yet`;
      throw new WhatsAppBrokerError(unsupportedMessage, 'DIRECT_ROUTE_UNAVAILABLE', 415);
    }

    const encodedInstanceId = encodeURIComponent(instanceId);

    const mediaPayload = this.buildDirectMediaRequestPayload(
      normalizedPayload,
      options.rawPayload
    );

    const requiresMedia = ['image', 'video', 'document', 'audio'].includes(
      normalizedPayload.type
    );

    if (requiresMedia) {
      const mediaUrl = mediaPayload['mediaUrl'];
      if (typeof mediaUrl !== 'string' || mediaUrl.length === 0) {
        throw new WhatsAppBrokerError(
          `Direct route for ${normalizedPayload.type} messages requires mediaUrl`,
          'INVALID_MEDIA_PAYLOAD',
          422
        );
      }
    }

    const directRequestBody = compactObject({
      sessionId: instanceId,
      instanceId,
      to: normalizedPayload.to,
      type: normalizedPayload.type,
      message: normalizedPayload.content,
      text: normalizedPayload.type === 'text' ? normalizedPayload.content : undefined,
      previewUrl: normalizedPayload.previewUrl,
      externalId: normalizedPayload.externalId,
      template:
        normalizedPayload.type === 'template' ? (normalizedPayload.template as unknown) : undefined,
      location:
        normalizedPayload.type === 'location' ? (normalizedPayload.location as unknown) : undefined,
      metadata: normalizedPayload.metadata,
      ...mediaPayload,
    });

    const sendRequest = async (
      path: string
    ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> => {
      const response = await this.request<Record<string, unknown>>(
        path,
        {
          method: 'POST',
          body: JSON.stringify(directRequestBody),
        },
        { idempotencyKey: options.idempotencyKey }
      );

      const normalizedResponse = BrokerOutboundResponseSchema.parse(response);
      return this.buildMessageResult(normalizedPayload, normalizedResponse);
    };

    const sendViaBrokerEndpoint = async (): Promise<
      WhatsAppMessageResult & { raw?: Record<string, unknown> | null }
    > => {
      try {
        return await sendRequest('/broker/messages');
      } catch (brokerError) {
        if (
          brokerError instanceof WhatsAppBrokerError &&
          (brokerError.status === 404 || brokerError.status === 405)
        ) {
          throw this.createInstanceDisconnectedError(brokerError);
        }

        throw brokerError;
      }
    };

    if (this.deliveryMode === 'broker') {
      return sendViaBrokerEndpoint();
    }

    try {
      return await sendRequest(`/instances/${encodedInstanceId}/send-text`);
    } catch (error) {
      if (
        error instanceof WhatsAppBrokerError &&
        (error.status === 404 || error.status === 405)
      ) {
        logger.warn('Direct route unavailable, retrying via broker endpoint', {
          instanceId,
          status: error.status,
          code: error.code,
        });
        return sendViaBrokerEndpoint();
      }

      throw error;
    }
  }

  private async sendViaInstanceRoutes(
    instanceId: string,
    normalizedPayload: BrokerOutboundMessage,
    options: { rawPayload: SendMessagePayload; idempotencyKey?: string }
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    if (normalizedPayload.type !== 'text') {
      throw new WhatsAppBrokerError(
        'Legacy instance routes only support text payloads',
        'UNSUPPORTED_MESSAGE_TYPE',
        415
      );
    }

    try {
      const response = await this.request<Record<string, unknown>>(
        `/instances/${encodeURIComponent(instanceId)}/send-text`,
        {
          method: 'POST',
          body: JSON.stringify(
            compactObject({
              to: this.formatLegacyRecipient(normalizedPayload.to),
              message: normalizedPayload.content,
              text: normalizedPayload.content,
              previewUrl: normalizedPayload.previewUrl,
              externalId: normalizedPayload.externalId,
            })
          ),
        },
        { idempotencyKey: options.idempotencyKey }
      );

      return this.normalizeLegacyResponse(normalizedPayload, response);
    } catch (error) {
      if (
        error instanceof WhatsAppBrokerError &&
        (error.status === 404 || error.status === 405)
      ) {
        throw this.createInstanceDisconnectedError(error);
      }

      throw error;
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: BrokerRequestOptions = {}
  ): Promise<T> {
    this.ensureConfigured();

    const url = this.buildUrl(path, options.searchParams);
    const headers = new Headers(init.headers as HeadersInit | undefined);

    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    headers.set('x-api-key', options.apiKey || this.brokerApiKey);
    if (options.idempotencyKey && !headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }

    const { signal, cancel } = this.createTimeoutSignal(options.timeoutMs ?? this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal,
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers?.get?.('content-type') || '';
      if (!contentType.includes('application/json')) {
        const empty = (await response.text()) || '';
        return (empty ? (JSON.parse(empty) as T) : (undefined as T));
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof WhatsAppBrokerError || error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new WhatsAppBrokerError(
          'WhatsApp broker request timed out',
          'REQUEST_TIMEOUT',
          408
        );
      }

      const originalMessage =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      const contextMessage = originalMessage
        ? `Unexpected error contacting WhatsApp broker for ${path}: ${originalMessage}`
        : `Unexpected error contacting WhatsApp broker for ${path}`;

      const wrappedError = new WhatsAppBrokerError(contextMessage, 'BROKER_ERROR', 502);

      if (error instanceof Error && error.stack) {
        wrappedError.stack = `${wrappedError.name}: ${wrappedError.message}\nCaused by: ${error.stack}`;
      }

      logger.error('Unexpected WhatsApp broker request failure', { path, error });
      throw wrappedError;
    } finally {
      cancel();
    }
  }

  async connectSession(
    sessionId: string,
    payload: { instanceId?: string; webhookUrl?: string; forceReopen?: boolean } = {}
  ): Promise<void> {
    const normalizedPayload = compactObject({
      sessionId,
      instanceId: payload.instanceId ?? sessionId,
      webhookUrl: payload.webhookUrl,
      forceReopen: payload.forceReopen,
    });

    if (this.useBrokerSessions) {
      await this.request<void>('/broker/session/connect', {
        method: 'POST',
        body: JSON.stringify(normalizedPayload),
      });
      return;
    }
    const normalizedInstanceId =
      typeof payload.instanceId === 'string' && payload.instanceId.trim().length > 0
        ? payload.instanceId.trim()
        : sessionId;

    const encodedSessionId = encodeURIComponent(sessionId);
    const preferBroker = this.shouldAttemptBrokerSessionRoutes();

    const connectViaLegacyRoute = async (): Promise<void> => {
      await this.request<void>(
        `/instances/${encodedSessionId}/connect`,
        {
          method: 'POST',
          body: JSON.stringify(
            compactObject({
              instanceId: normalizedInstanceId,
              webhookUrl: payload.webhookUrl,
              forceReopen: payload.forceReopen,
            })
          ),
        }
      );
      this.sessionRoutesPreference = 'legacy';
    };

    const connectViaBrokerRoute = async (): Promise<void> => {
      await this.request<void>(
        '/broker/session/connect',
        {
          method: 'POST',
          body: JSON.stringify(
            compactObject({
              sessionId,
              instanceId: normalizedInstanceId,
              webhookUrl: payload.webhookUrl,
              forceReopen: payload.forceReopen,
            })
          ),
        }
      );
      this.sessionRoutesPreference = 'broker';
    };

    if (preferBroker) {
      try {
        await connectViaBrokerRoute();
        return;
      } catch (error) {
        if (!this.isRecoverableSessionRouteError(error)) {
          throw error;
        }

        try {
          await connectViaLegacyRoute();
          return;
        } catch (legacyError) {
          if (this.isRecoverableSessionRouteError(legacyError)) {
            await connectViaBrokerRoute();
            return;
          }

          throw legacyError;
        }
      }
    }

    try {
      await connectViaLegacyRoute();
    } catch (error) {
      if (!this.isRecoverableSessionRouteError(error)) {
        throw error;
      }

      await connectViaBrokerRoute();
    }
  }

  async logoutSession(
    sessionId: string,
    options: { instanceId?: string; wipe?: boolean } = {}
  ): Promise<void> {
    const normalizedPayload = compactObject({
      sessionId,
      instanceId: options.instanceId ?? sessionId,
      wipe: options.wipe,
    });

    if (this.useBrokerSessions) {
      await this.request<void>('/broker/session/logout', {
        method: 'POST',
        body: JSON.stringify(normalizedPayload),
      });
      return;
    }
    const normalizedInstanceId =
      typeof options.instanceId === 'string' && options.instanceId.trim().length > 0
        ? options.instanceId.trim()
        : sessionId;

    const encodedSessionId = encodeURIComponent(sessionId);
    const preferBroker = this.shouldAttemptBrokerSessionRoutes();

    const logoutViaLegacyRoute = async (): Promise<void> => {
      await this.request<void>(
        `/instances/${encodedSessionId}/logout`,
        {
          method: 'POST',
          body: JSON.stringify(
            compactObject({
              instanceId: normalizedInstanceId,
              wipe: options.wipe,
            })
          ),
        }
      );
      this.sessionRoutesPreference = 'legacy';
    };

    const logoutViaBrokerRoute = async (): Promise<void> => {
      await this.request<void>(
        '/broker/session/logout',
        {
          method: 'POST',
          body: JSON.stringify(
            compactObject({
              sessionId,
              instanceId: normalizedInstanceId,
              wipe: options.wipe,
            })
          ),
        }
      );
      this.sessionRoutesPreference = 'broker';
    };

    if (preferBroker) {
      try {
        await logoutViaBrokerRoute();
        return;
      } catch (error) {
        if (!this.isRecoverableSessionRouteError(error)) {
          throw error;
        }

        try {
          await logoutViaLegacyRoute();
          return;
        } catch (legacyError) {
          if (this.isRecoverableSessionRouteError(legacyError)) {
            await logoutViaBrokerRoute();
            return;
          }

          throw legacyError;
        }
      }
    }

    try {
      await logoutViaLegacyRoute();
    } catch (error) {
      if (!this.isRecoverableSessionRouteError(error)) {
        throw error;
      }

      await logoutViaBrokerRoute();
    }
  }

  async getSessionStatus<T = Record<string, unknown>>(
    sessionId: string,
    options: { instanceId?: string } = {}
  ): Promise<T> {
    const normalizedInstanceId =
      typeof options.instanceId === 'string' && options.instanceId.trim().length > 0
        ? options.instanceId.trim()
        : sessionId;

    if (this.useBrokerSessions) {
      const payload = compactObject({
        sessionId,
        instanceId: normalizedInstanceId || sessionId,
      });

      return this.request<T>(
        '/broker/session/status',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    }

    const encodedSessionId = encodeURIComponent(sessionId);
    const preferBroker = this.shouldAttemptBrokerSessionRoutes();

    const readViaLegacyRoute = async (): Promise<T> => {
      const requestOptions: BrokerRequestOptions =
        normalizedInstanceId && normalizedInstanceId !== sessionId
          ? { searchParams: { instanceId: normalizedInstanceId } }
          : {};

      const response = await this.request<T>(
        `/instances/${encodedSessionId}/status`,
        {
          method: 'GET',
        },
        requestOptions
      );

      this.sessionRoutesPreference = 'legacy';
      return response;
    };

    const readViaBrokerRoute = async (): Promise<T> => {
      const response = await this.request<T>(
        '/broker/session/status',
        {
          method: 'GET',
        },
        {
          searchParams: {
            sessionId,
            instanceId: normalizedInstanceId,
          },
        }
      );

      this.sessionRoutesPreference = 'broker';
      return response;
    };

    if (preferBroker) {
      try {
        return await readViaBrokerRoute();
      } catch (error) {
        if (!this.isRecoverableSessionRouteError(error)) {
          throw error;
        }

        try {
          return await readViaLegacyRoute();
        } catch (legacyError) {
          if (this.isRecoverableSessionRouteError(legacyError)) {
            return await readViaBrokerRoute();
          }

          throw legacyError;
        }
      }
    }

    try {
      return await readViaLegacyRoute();
    } catch (error) {
      if (!this.isRecoverableSessionRouteError(error)) {
        throw error;
      }

      return await readViaBrokerRoute();
    }
  }

  async sendText<T = Record<string, unknown>>(
    payload: {
      sessionId: string;
      instanceId?: string;
      to: string;
      message: string;
      previewUrl?: boolean;
      externalId?: string;
    }
  ): Promise<T> {
    const sessionId = payload.sessionId;
    const instanceId = payload.instanceId ?? sessionId;
    const encodedInstanceId = encodeURIComponent(instanceId);
    const requestBody = JSON.stringify(
      compactObject({
        sessionId,
        instanceId,
        to: payload.to,
        type: 'text',
        message: payload.message,
        text: payload.message,
        previewUrl: payload.previewUrl,
        externalId: payload.externalId,
      })
    );

    const sendRequest = async (path: string): Promise<T> => {
      return await this.request<T>(
        path,
        {
          method: 'POST',
          body: requestBody,
        }
      );
    };

    const sendViaBrokerEndpoint = async (): Promise<T> => {
      try {
        return await sendRequest('/broker/messages');
      } catch (brokerError) {
        if (
          brokerError instanceof WhatsAppBrokerError &&
          (brokerError.status === 404 || brokerError.status === 405)
        ) {
          throw this.createInstanceDisconnectedError(brokerError);
        }

        throw brokerError;
      }
    };

    if (this.deliveryMode === 'broker') {
      return sendViaBrokerEndpoint();
    }

    try {
      return await sendRequest(`/instances/${encodedInstanceId}/send-text`);
    } catch (error) {
      if (
        error instanceof WhatsAppBrokerError &&
        (error.status === 404 || error.status === 405)
      ) {
        logger.warn('Direct send-text route unavailable, retrying via broker endpoint', {
          instanceId,
          status: error.status,
          code: error.code,
        });
        return sendViaBrokerEndpoint();
      }

      throw error;
    }
  }

  async createPoll(
    payload: {
      sessionId: string;
      instanceId?: string;
      to: string;
      question: string;
      options: string[];
      allowMultipleAnswers?: boolean;
    }
  ): Promise<{
    id: string;
    status: string;
    ack: string | number | null;
    rate: unknown;
    raw: Record<string, unknown> | null;
  }> {
    const sessionId = payload.sessionId;
    const instanceId = payload.instanceId ?? sessionId;
    const encodedInstanceId = encodeURIComponent(instanceId);
    const selectableCount = payload.allowMultipleAnswers ? Math.max(2, payload.options.length) : 1;

    const requestBody = JSON.stringify(
      compactObject({
        sessionId,
        instanceId,
        to: payload.to,
        question: payload.question,
        options: payload.options,
        selectableCount,
      })
    );

    const response = await this.request<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/send-poll`,
      {
        method: 'POST',
        body: requestBody,
      }
    );

    const rawResponse =
      response && typeof response === 'object'
        ? (response as Record<string, unknown>)
        : null;
    const record = rawResponse ?? {};
    const fallbackId = `poll-${Date.now()}`;
    const idCandidates = [
      record['id'],
      record['messageId'],
      record['externalId'],
      fallbackId,
    ];
    let resolvedId = fallbackId;
    for (const candidate of idCandidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          resolvedId = trimmed;
          break;
        }
      }
    }

    const status = typeof record['status'] === 'string' ? (record['status'] as string) : 'pending';
    const ackCandidate = record['ack'];
    const ack =
      typeof ackCandidate === 'number' || typeof ackCandidate === 'string'
        ? ackCandidate
        : null;

    const rate = record['rate'] ?? null;

    return {
      id: resolvedId,
      status,
      ack,
      rate,
      raw: rawResponse,
    };
  }

  async fetchEvents<T = { events: unknown[] }>(
    params: { limit?: number; cursor?: string; instanceId?: string } = {}
  ): Promise<T> {
    return this.request<T>(
      '/broker/events',
      {
        method: 'GET',
      },
      {
        apiKey: this.webhookApiKey,
        searchParams: {
          limit: params.limit,
          cursor: params.cursor,
          instanceId: params.instanceId,
        },
      }
    );
  }

  async ackEvents(payload: { ids: string[]; instanceId?: string }): Promise<void> {
    const ids = Array.isArray(payload?.ids)
      ? payload.ids
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id) => id.length > 0)
      : [];

    if (ids.length === 0) {
      return;
    }

    const body = JSON.stringify(
      compactObject({
        ids,
        instanceId: payload.instanceId,
      })
    );

    await this.request<void>(
      '/broker/events/ack',
      {
        method: 'POST',
        body,
      },
      {
        apiKey: this.webhookApiKey,
      }
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
      source.id,
      source._id,
      source.instanceId,
      source.sessionId,
      metadata.id,
      metadata._id,
      metadata.instanceId,
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
    this.ensureConfigured();

    const requestedInstanceId =
      typeof args.instanceId === 'string' && args.instanceId.trim().length > 0
        ? args.instanceId.trim()
        : this.slugify(args.name, 'instance');

    let response: unknown;

    try {
      response = await this.request<unknown>('/instances', {
        method: 'POST',
        body: JSON.stringify(
          compactObject({
            tenantId: args.tenantId,
            instanceId: requestedInstanceId,
            name: args.name,
            webhookUrl: args.webhookUrl,
          })
        ),
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
    options: { instanceId?: string; webhookUrl?: string; forceReopen?: boolean } = {}
  ): Promise<void> {
    this.ensureConfigured();
    await this.connectSession(brokerId, { ...options, instanceId: options.instanceId ?? brokerId });
  }

  async disconnectInstance(
    brokerId: string,
    options: { instanceId?: string; wipe?: boolean } = {}
  ): Promise<void> {
    this.ensureConfigured();
    await this.logoutSession(brokerId, { ...options, instanceId: options.instanceId ?? brokerId });
  }

  async deleteInstance(
    brokerId: string,
    options: DeleteInstanceOptions = {}
  ): Promise<void> {
    this.ensureConfigured();

    const encodedBrokerId = encodeURIComponent(brokerId);
    const normalizedInstanceId =
      typeof options.instanceId === 'string' ? options.instanceId.trim() : '';

    const { instanceId: _instanceId, ...flags } = options;
    const searchParams: Record<string, string | number | undefined> = {};

    if (normalizedInstanceId) {
      searchParams.instanceId = normalizedInstanceId;
    }

    Object.entries(flags).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      if (typeof value === 'boolean') {
        searchParams[key] = value ? 'true' : 'false';
        return;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        searchParams[key] = value;
        return;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          searchParams[key] = trimmed;
        }
      }
    });

    const requestOptions: BrokerRequestOptions =
      Object.keys(searchParams).length > 0 ? { searchParams } : {};

    await this.request<void>(
      `/instances/${encodedBrokerId}`,
      {
        method: 'DELETE',
      },
      requestOptions
    );
  }

  async getQrCode(brokerId: string, options: { instanceId?: string } = {}): Promise<WhatsAppQrCode> {
    this.ensureConfigured();

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
          if (statusError.status === 404) {
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
    const url = this.buildUrl(`/instances/${encodedBrokerId}/qr.png`, searchParams);
    const headers = new Headers();
    headers.set('x-api-key', this.brokerApiKey);
    headers.set('accept', 'image/png,application/json;q=0.9,*/*;q=0.8');

    const { signal, cancel } = this.createTimeoutSignal(this.timeoutMs);

    try {
      const response = await fetch(url, { method: 'GET', headers, signal });

      if (!response.ok) {
        if (response.status === 404) {
          return await fallbackFromStatus();
        }

        await this.handleError(response);
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

      if (error instanceof WhatsAppBrokerError && error.status === 404) {
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
    this.ensureConfigured();

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

  async sendMessage(
    instanceId: string,
    payload: SendMessagePayload,
    idempotencyKey?: string
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    const contentValue = payload.content ?? payload.caption ?? '';

    const mediaPayload = payload.media
      ? (payload.media as Record<string, unknown>)
      : payload.mediaUrl
      ? {
          url: payload.mediaUrl,
          mimetype: payload.mediaMimeType,
          filename: payload.mediaFileName,
        }
      : undefined;

    const normalizedPayload = BrokerOutboundMessageSchema.parse({
      sessionId: instanceId,
      instanceId,
      to: payload.to,
      type: payload.type ?? (mediaPayload ? 'image' : 'text'),
      content: contentValue,
      externalId: payload.externalId,
      previewUrl: payload.previewUrl,
      media: mediaPayload as unknown,
      location: payload.location as unknown,
      template: payload.template as unknown,
      metadata: payload.metadata,
    });

    const metadataKey = (() => {
      const candidate = payload.metadata?.['idempotencyKey'];
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      return undefined;
    })();

    const normalizedIdempotencyKey = (() => {
      if (typeof idempotencyKey === 'string') {
        const trimmed = idempotencyKey.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
      return metadataKey;
    })();

    const dispatchOptions = {
      rawPayload: payload,
      idempotencyKey: normalizedIdempotencyKey,
    } as const;

    const mode = this.deliveryMode;

    if (mode === 'broker') {
      return this.sendViaDirectRoutes(instanceId, normalizedPayload, dispatchOptions);
    }

    if (mode === 'instances') {
      return this.sendViaInstanceRoutes(instanceId, normalizedPayload, dispatchOptions);
    }

    try {
      return await this.sendViaDirectRoutes(instanceId, normalizedPayload, dispatchOptions);
    } catch (error) {
      if (error instanceof WhatsAppBrokerError && this.shouldRetryWithInstanceRoutes(error)) {
        logger.warn('Direct route rejected payload; retrying via legacy instance endpoint', {
          instanceId,
          status: error.status,
          code: error.code,
        });
        return this.sendViaInstanceRoutes(instanceId, normalizedPayload, dispatchOptions);
      }

      throw error;
    }
  }

  private shouldRetryWithInstanceRoutes(error: WhatsAppBrokerError): boolean {
    if (error.status === 404 || error.status === 405) {
      return true;
    }

    if (error.status === 400) {
      const message = error.message.toLowerCase();
      return message.includes('route') || message.includes('path');
    }

    return false;
  }

  private shouldAttemptBrokerSessionRoutes(): boolean {
    if (this.sessionRoutesPreference === 'broker') {
      return true;
    }

    if (this.sessionRoutesPreference === 'legacy') {
      return false;
    }

    const mode = this.deliveryMode;
    if (mode === 'broker') {
      return true;
    }

    if (mode === 'instances') {
      return false;
    }

    return true;
  }

  private isRecoverableSessionRouteError(error: unknown): error is WhatsAppBrokerError {
    if (!(error instanceof WhatsAppBrokerError)) {
      return false;
    }

    if (error.status !== 404) {
      return false;
    }

    const normalizedCode = normalizeErrorCode(error.code);
    if (!normalizedCode || normalizedCode === 'NOT_FOUND') {
      return true;
    }

    return !INSTANCE_DISCONNECTED_CODES.has(normalizedCode);
  }
}

export const whatsappBrokerClient = new WhatsAppBrokerClient();
