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
  const status = Number.isFinite(error.brokerStatus)
    ? (error.brokerStatus as number)
    : null;
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
  private get mode(): string {
    return (process.env.WHATSAPP_MODE || '').trim().toLowerCase();
  }

  private get baseUrl(): string {
    const configured = (process.env.BROKER_BASE_URL || process.env.WHATSAPP_BROKER_URL || '').trim();
    return configured ? configured.replace(/\/$/, '') : '';
  }

  private get brokerApiKey(): string {
    const configured = (process.env.BROKER_API_KEY || process.env.WHATSAPP_BROKER_API_KEY || '').trim();
    return configured;
  }

  private get timeoutMs(): number {
    const read = (value: string | undefined): number | null => {
      if (!value) {
        return null;
      }

      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }

      return null;
    };

    const candidates = [
      process.env.WHATSAPP_BROKER_TIMEOUT_MS,
      process.env.LEAD_ENGINE_TIMEOUT_MS,
    ];

    for (const candidate of candidates) {
      const resolved = read(candidate);
      if (resolved) {
        return resolved;
      }
    }

    return DEFAULT_TIMEOUT_MS;
  }

  private get brokerWebhookUrl(): string {
    const configured =
      (process.env.WHATSAPP_BROKER_WEBHOOK_URL ||
        process.env.WHATSAPP_WEBHOOK_URL ||
        process.env.WEBHOOK_URL ||
        '').trim();

    if (configured) {
      return configured;
    }

    return 'https://ticketzapi-production.up.railway.app/api/integrations/whatsapp/webhook';
  }

  private get webhookVerifyToken(): string {
    return (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();
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

    if (!this.webhookVerifyToken) {
      throw new WhatsAppBrokerNotConfiguredError(
        'WhatsApp webhook verify token is not configured. Set WHATSAPP_WEBHOOK_VERIFY_TOKEN.'
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

    const headerRequestId =
      response.headers?.get?.('x-request-id') ||
      response.headers?.get?.('x-requestid') ||
      undefined;

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
    const message =
      normalizedError.message || `WhatsApp broker request failed (${response.status})`;

    throw new WhatsAppBrokerError(message, {
      code,
      brokerStatus: response.status,
      requestId: normalizedError.requestId || headerRequestId,
    });
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
    const responseRecord = normalizedResponse as Record<string, unknown>;
    const fallbackId = `msg-${Date.now()}`;
    const responseId = (() => {
      const candidate = responseRecord['id'];
      return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
    })();

    const externalId =
      normalizedResponse.externalId ??
      normalizedPayload.externalId ??
      responseId ??
      fallbackId;

    const status = normalizedResponse.status || 'sent';

    return {
      externalId,
      status,
      timestamp: normalizedResponse.timestamp ?? new Date().toISOString(),
      raw: normalizedResponse.raw ?? null,
    };
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
      throw new WhatsAppBrokerError(unsupportedMessage, {
        code: 'DIRECT_ROUTE_UNAVAILABLE',
        brokerStatus: 415,
      });
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
          {
            code: 'INVALID_MEDIA_PAYLOAD',
            brokerStatus: 422,
          }
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

    const path = `/instances/${encodedInstanceId}/send-text`;

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
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options: BrokerRequestOptions = {}
  ): Promise<T> {
    this.ensureConfigured();

    const url = this.buildUrl(path, options.searchParams);
    const headers = new Headers(init.headers as HeadersInit | undefined);

    if (init.body && !headers.has('content-type') && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (!headers.has('accept') && !headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    headers.set('X-API-Key', options.apiKey || this.brokerApiKey);
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
    options: { instanceId?: string; wipe?: boolean } = {}
  ): Promise<void> {
    const instanceId =
      typeof options.instanceId === 'string' && options.instanceId.trim().length > 0
        ? options.instanceId.trim()
        : sessionId;

    const encodedInstanceId = encodeURIComponent(instanceId);

    await this.request<void>(
      `/instances/${encodedInstanceId}/logout`,
      {
        method: 'POST',
        body: JSON.stringify(compactObject({ wipe: options.wipe })),
      }
    );
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

    return this.request<T>(
      `/instances/${encodedInstanceId}/send-text`,
      {
        method: 'POST',
        body: requestBody,
      }
    );
  }

  async checkRecipient(
    payload: {
      sessionId: string;
      instanceId?: string;
      to: string;
    }
  ): Promise<Record<string, unknown>> {
    const sessionId = payload.sessionId;
    const instanceId = payload.instanceId ?? sessionId;
    const encodedInstanceId = encodeURIComponent(instanceId);
    const normalizedTo = `${payload.to ?? ''}`.trim();

    const body = JSON.stringify(
      compactObject({
        sessionId,
        instanceId,
        to: normalizedTo,
      })
    );

    return this.request<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/exists`,
      {
        method: 'POST',
        body,
      }
    );
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

  async getGroups(
    payload: { sessionId: string; instanceId?: string }
  ): Promise<Record<string, unknown>> {
    const sessionId = payload.sessionId;
    const instanceId = payload.instanceId ?? sessionId;
    const encodedInstanceId = encodeURIComponent(instanceId);

    return this.request<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/groups`,
      { method: 'GET' }
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

    const webhookUrl =
      typeof args.webhookUrl === 'string' && args.webhookUrl.trim().length > 0
        ? args.webhookUrl.trim()
        : this.brokerWebhookUrl;

    let response: unknown;

    try {
      response = await this.request<unknown>('/instances', {
        method: 'POST',
        body: JSON.stringify({
          id: requestedInstanceId,
          webhookUrl,
          verifyToken: this.webhookVerifyToken,
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
    this.ensureConfigured();
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
    const url = this.buildUrl(`/instances/${encodedBrokerId}/qr.png`, searchParams);
    const headers = new Headers();
    headers.set('X-API-Key', this.brokerApiKey);
    headers.set('Accept', 'image/png, application/json');
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

    return this.sendViaDirectRoutes(instanceId, normalizedPayload, dispatchOptions);
  }
}

export const whatsappBrokerClient = new WhatsAppBrokerClient();
