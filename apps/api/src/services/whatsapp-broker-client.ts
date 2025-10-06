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
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_required';
  connected: boolean;
  stats?: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  rate?: Record<string, unknown> | null;
  rateUsage?: Record<string, unknown> | null;
  messages?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
}

export interface WhatsAppMessageResult {
  externalId: string;
  status: string;
  timestamp?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

const fallbackInstance = (tenantId: string): WhatsAppInstance => ({
  id: 'whatsapp-demo',
  tenantId,
  name: 'WhatsApp Demo',
  status: 'connected',
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
  connected: true,
});

type BrokerRequestOptions = {
  apiKey?: string;
  timeoutMs?: number;
  searchParams?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
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
    return process.env.WHATSAPP_BROKER_URL?.replace(/\/$/, '') || '';
  }

  private get brokerApiKey(): string {
    return process.env.WHATSAPP_BROKER_API_KEY || '';
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

    if (!this.baseUrl || !this.brokerApiKey) {
      throw new WhatsAppBrokerNotConfiguredError();
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

  private buildDirectMessagePayload(
    instanceId: string,
    normalizedPayload: BrokerOutboundMessage,
    rawPayload: SendMessagePayload
  ): Record<string, unknown> {
    const media = rawPayload.media ?? normalizedPayload.media ?? undefined;

    const mediaUrl = (() => {
      if (typeof rawPayload.mediaUrl === 'string' && rawPayload.mediaUrl.length > 0) {
        return rawPayload.mediaUrl;
      }
      if (media && typeof (media as Record<string, unknown>).url === 'string') {
        return ((media as Record<string, unknown>).url as string) || undefined;
      }
      return undefined;
    })();

    const mediaMimeType = (() => {
      if (typeof rawPayload.mediaMimeType === 'string') {
        const trimmed = rawPayload.mediaMimeType.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
      if (media && typeof (media as Record<string, unknown>).mimetype === 'string') {
        const trimmed = ((media as Record<string, unknown>).mimetype as string).trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      return undefined;
    })();

    const mediaFileName = (() => {
      if (typeof rawPayload.mediaFileName === 'string') {
        const trimmed = rawPayload.mediaFileName.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
      if (media && typeof (media as Record<string, unknown>).filename === 'string') {
        const trimmed = ((media as Record<string, unknown>).filename as string).trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      return undefined;
    })();

    const mediaSize = (() => {
      if (media && typeof media === 'object' && 'size' in media) {
        const candidate = (media as { size?: unknown }).size;
        return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
      }
      return undefined;
    })();

    const captionCandidate = (() => {
      if (typeof rawPayload.caption === 'string') {
        const trimmed = rawPayload.caption.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }

      if (normalizedPayload.type !== 'text') {
        const trimmed = normalizedPayload.content.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }

      return undefined;
    })();

    return compactObject({
      sessionId: normalizedPayload.sessionId ?? instanceId,
      instanceId: normalizedPayload.instanceId ?? instanceId,
      to: normalizedPayload.to,
      type: normalizedPayload.type,
      text: normalizedPayload.content,
      caption: captionCandidate,
      mediaUrl,
      mimeType: mediaMimeType,
      fileName: mediaFileName,
      mediaSize,
      previewUrl: normalizedPayload.previewUrl,
      externalId: normalizedPayload.externalId,
      template: normalizedPayload.template,
      location: normalizedPayload.location,
      metadata: normalizedPayload.metadata,
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

  private async sendViaBrokerRoutes(
    instanceId: string,
    normalizedPayload: BrokerOutboundMessage,
    options: { rawPayload: SendMessagePayload; idempotencyKey?: string }
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    try {
      const response = await this.request<Record<string, unknown>>(
        `/instances/${encodeURIComponent(instanceId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(
            this.buildDirectMessagePayload(instanceId, normalizedPayload, options.rawPayload)
          ),
        },
        { idempotencyKey: options.idempotencyKey }
      );

      const normalizedResponse = BrokerOutboundResponseSchema.parse(response);
      return this.buildMessageResult(normalizedPayload, normalizedResponse);
    } catch (error) {
      if (error instanceof WhatsAppBrokerError && error.status === 404) {
        logger.debug('Direct message route unavailable; falling back to broker endpoint', {
          instanceId,
        });
      } else {
        throw error;
      }
    }

    const fallbackResponse = await this.request<Record<string, unknown>>(
      '/broker/messages',
      {
        method: 'POST',
        body: JSON.stringify(normalizedPayload),
      },
      { idempotencyKey: options.idempotencyKey }
    );

    const normalizedFallback = BrokerOutboundResponseSchema.parse(fallbackResponse);
    return this.buildMessageResult(normalizedPayload, normalizedFallback);
  }

  private async sendViaInstanceRoutes(
    instanceId: string,
    normalizedPayload: BrokerOutboundMessage,
    options: { rawPayload: SendMessagePayload; idempotencyKey?: string }
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    if (normalizedPayload.type !== 'text') {
      logger.warn('Legacy instance routes only support text payloads; falling back to broker dispatch', {
        instanceId,
        type: normalizedPayload.type,
      });
      return this.sendViaBrokerRoutes(instanceId, normalizedPayload, options);
    }

    const response = await this.request<Record<string, unknown>>(
      `/instances/${encodeURIComponent(instanceId)}/send-text`,
      {
        method: 'POST',
        body: JSON.stringify(
          compactObject({
            to: this.formatLegacyRecipient(normalizedPayload.to),
            text: normalizedPayload.content,
            previewUrl: normalizedPayload.previewUrl,
            externalId: normalizedPayload.externalId,
          })
        ),
      },
      { idempotencyKey: options.idempotencyKey }
    );

    return this.normalizeLegacyResponse(normalizedPayload, response);
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

      logger.error('Unexpected WhatsApp broker request failure', { path, error });
      throw error;
    } finally {
      cancel();
    }
  }

  async connectSession(
    sessionId: string,
    payload: { instanceId?: string; webhookUrl?: string; forceReopen?: boolean } = {}
  ): Promise<void> {
    await this.request<void>(
      '/broker/session/connect',
      {
        method: 'POST',
        body: JSON.stringify(
          compactObject({
            sessionId,
            instanceId: payload.instanceId ?? sessionId,
            webhookUrl: payload.webhookUrl,
            forceReopen: payload.forceReopen,
          })
        ),
      }
    );
  }

  async logoutSession(
    sessionId: string,
    options: { instanceId?: string; wipe?: boolean } = {}
  ): Promise<void> {
    await this.request<void>('/broker/session/logout', {
      method: 'POST',
      body: JSON.stringify(
        compactObject({
          sessionId,
          instanceId: options.instanceId ?? sessionId,
          wipe: options.wipe,
        })
      ),
    });
  }

  async getSessionStatus<T = Record<string, unknown>>(
    sessionId: string,
    options: { instanceId?: string } = {}
  ): Promise<T> {
    return this.request<T>(
      '/broker/session/status',
      {
        method: 'GET',
      },
      {
        searchParams: {
          sessionId,
          instanceId: options.instanceId ?? sessionId,
        },
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
    return this.request<T>('/broker/messages', {
      method: 'POST',
      body: JSON.stringify(
        compactObject({
          sessionId: payload.sessionId,
          instanceId: payload.instanceId ?? payload.sessionId,
          to: payload.to,
          type: 'text',
          content: payload.message,
          previewUrl: payload.previewUrl,
          externalId: payload.externalId,
        })
      ),
    });
  }

  async createPoll<T = Record<string, unknown>>(
    payload: {
      sessionId: string;
      instanceId?: string;
      to: string;
      question: string;
      options: string[];
      allowMultipleAnswers?: boolean;
    }
  ): Promise<T> {
    return this.request<T>('/broker/polls', {
      method: 'POST',
      body: JSON.stringify(
        compactObject({
          sessionId: payload.sessionId,
          instanceId: payload.instanceId ?? payload.sessionId,
          to: payload.to,
          question: payload.question,
          options: payload.options,
          allowMultipleAnswers: payload.allowMultipleAnswers,
        })
      ),
    });
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

    await this.request<void>(
      '/broker/events/ack',
      {
        method: 'POST',
        body: JSON.stringify(
          compactObject({
            ids,
            instanceId: payload.instanceId,
          })
        ),
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
    if (!value || typeof value !== 'object') {
      return { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null };
    }

    const source = value as Record<string, unknown>;
    const qrSource =
      typeof source.qr === 'object' && source.qr !== null
        ? (source.qr as Record<string, unknown>)
        : {};

    const directQr = this.pickString(
      typeof source.qr === 'string' ? source.qr : null,
      qrSource.code,
      qrSource.qr,
      qrSource.qrCode,
      qrSource.qr_code
    );

    const qrCodeCandidate = this.pickString(
      typeof source.qrCode === 'string' ? source.qrCode : null,
      source.qr_code,
      qrSource.qrCode,
      qrSource.qr_code,
      qrSource.code
    );
    const resolvedQr = directQr ?? qrCodeCandidate;

    const qrExpiresAt =
      this.pickString(
        source.qrExpiresAt,
        source.qr_expires_at,
        qrSource.expiresAt,
        qrSource.expires_at
      ) ?? null;

    const expiresAt =
      this.pickString(
        source.expiresAt,
        source.expires_at,
        qrSource.expiresAt,
        qrSource.expires_at
      ) ?? qrExpiresAt;

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

    const { status, connected } = this.normalizeStatus(
      source.status ?? metadata.status ?? metadata.state,
      source.connected ?? metadata.connected ?? metadata.isConnected ?? metadata.connected_at
    );

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
        metadata.phoneNumber,
        metadata.phone_number,
        metadata.msisdn,
        metadata.phone
      ) || null;

    const user =
      this.pickString(
        source.user,
        metadata.user,
        metadata.userName,
        metadata.username,
        metadata.operator
      ) || null;

    const name =
      this.pickString(
        source.name,
        metadata.name,
        metadata.displayName,
        metadata.sessionName,
        metadata.instanceName,
        metadata.profileName
      ) || undefined;

    const statsCandidate =
      (typeof source.stats === 'object' && source.stats !== null
        ? (source.stats as Record<string, unknown>)
        : null) ||
      (typeof metadata.stats === 'object' && metadata.stats !== null
        ? (metadata.stats as Record<string, unknown>)
        : null);

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

  private findSessionPayloads(value: unknown): Record<string, unknown>[] {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const queue: Record<string, unknown>[] = [value as Record<string, unknown>];
    const visited = new Set<unknown>();
    const sessions: Record<string, unknown>[] = [];

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
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (looksLikeSession(current)) {
        sessions.push(current);
        // do not `continue`; other nested sessions may exist
      }

      Object.values(current).forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }

        if (Array.isArray(entry)) {
          entry.forEach((item) => {
            if (item && typeof item === 'object') {
              queue.push(item as Record<string, unknown>);
            }
          });
          return;
        }

        queue.push(entry as Record<string, unknown>);
      });
    }

    return sessions;
  }

  async listInstances(tenantId: string): Promise<WhatsAppInstance[]> {
    const candidatePaths = [
      '/broker/session/status',
      '/broker/sessions/status',
      '/broker/sessionStatus',
    ];

    let lastError: unknown;

    const normalizedTenantId =
      typeof tenantId === 'string' ? tenantId.trim() : '';
    const requestOptions: BrokerRequestOptions = normalizedTenantId.length > 0
      ? { searchParams: { tenantId: normalizedTenantId } }
      : {};

    for (let index = 0; index < candidatePaths.length; index += 1) {
      const path = candidatePaths[index];

      try {
        const response = await this.request<unknown>(
          path,
          {
            method: 'GET',
          },
          requestOptions
        );

        const sessions = this.findSessionPayloads(response);
        if (!sessions.length) {
          logger.debug('WhatsApp broker session status payload missing session data', {
            tenantId,
            path,
            response,
          });

          if (index === candidatePaths.length - 1) {
            return [];
          }

          continue;
        }

        const normalized = sessions
          .map((session) => this.normalizeBrokerInstance(tenantId, session))
          .filter((instance): instance is WhatsAppInstance => Boolean(instance));

        if (!normalized.length) {
          if (index === candidatePaths.length - 1) {
            return [];
          }
          continue;
        }

        return normalized;
      } catch (error) {
        if (error instanceof WhatsAppBrokerNotConfiguredError) {
          throw error;
        }

        if (
          error instanceof WhatsAppBrokerError &&
          (error.status === 404 || error.status === 405)
        ) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    if (lastError) {
      logger.debug('All WhatsApp broker session status endpoints unavailable', {
        tenantId,
        error: lastError,
      });
    }

    return [];
  }

  async createInstance(args: { tenantId: string; name: string; webhookUrl?: string }): Promise<WhatsAppInstance> {
    this.ensureConfigured();

    const sessionId = `${this.slugify(args.tenantId, 'tenant')}--${this.slugify(args.name)}`;

    try {
      await this.connectSession(sessionId, { webhookUrl: args.webhookUrl });
    } catch (error) {
      logger.warn('Unable to pre-connect WhatsApp session via minimal broker', { error });
    }

    return {
      ...fallbackInstance(args.tenantId),
      id: sessionId,
      name: args.name,
      connected: false,
      status: 'connecting',
    };
  }

  async connectInstance(
    brokerId: string,
    options: { instanceId?: string; webhookUrl?: string; forceReopen?: boolean } = {}
  ): Promise<void> {
    await this.connectSession(brokerId, { ...options, instanceId: options.instanceId ?? brokerId });
  }

  async disconnectInstance(
    brokerId: string,
    options: { instanceId?: string; wipe?: boolean } = {}
  ): Promise<void> {
    await this.logoutSession(brokerId, { ...options, instanceId: options.instanceId ?? brokerId });
  }

  async deleteInstance(
    brokerId: string,
    options: { instanceId?: string; wipe?: boolean } = {}
  ): Promise<void> {
    await this.logoutSession(brokerId, { ...options, instanceId: options.instanceId ?? brokerId });
  }

  async getQrCode(brokerId: string, options: { instanceId?: string } = {}): Promise<WhatsAppQrCode> {
    this.ensureConfigured();

    try {
      const statusPayload = await this.getSessionStatus<Record<string, unknown>>(
        brokerId,
        { instanceId: options.instanceId ?? brokerId }
      );
      const normalized = this.normalizeQrPayload(statusPayload);

      if (normalized.qr || normalized.qrCode || normalized.qrExpiresAt || normalized.expiresAt) {
        return normalized;
      }

      const payload = await this.request<Record<string, unknown>>(
        '/broker/session/qr',
        { method: 'GET' },
        {
          searchParams: {
            sessionId: brokerId,
            instanceId: options.instanceId ?? brokerId,
          },
        }
      );

      return this.normalizeQrPayload(payload);
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      logger.warn('Failed to fetch WhatsApp QR code from broker', {
        instanceId: options.instanceId ?? brokerId,
        error,
      });
      return { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null };
    }
  }

  async getStatus(brokerId: string, options: { instanceId?: string } = {}): Promise<WhatsAppStatus> {
    this.ensureConfigured();

    try {
      const result = await this.getSessionStatus<Record<string, unknown>>(brokerId, {
        instanceId: options.instanceId ?? brokerId,
      });
      const normalizedQr = this.normalizeQrPayload(result);
      const connected = Boolean(result?.connected ?? (result?.status === 'connected'));
      const normalizedStatus = ((): WhatsAppStatus['status'] => {
        const raw = typeof result?.status === 'string' ? result.status.toLowerCase() : undefined;
        switch (raw) {
          case 'connected':
          case 'connecting':
          case 'qr_required':
          case 'disconnected':
            return raw;
          default:
            return connected ? 'connected' : 'disconnected';
        }
      })();

      const statsCandidate =
        typeof result?.stats === 'object' && result.stats !== null ? (result.stats as Record<string, unknown>) : undefined;
      const metricsCandidate =
        typeof result?.metrics === 'object' && result.metrics !== null
          ? (result.metrics as Record<string, unknown>)
          : undefined;
      const messagesCandidate =
        typeof result?.messages === 'object' && result.messages !== null
          ? (result.messages as Record<string, unknown>)
          : undefined;
      const rateUsageCandidate =
        typeof result?.rateUsage === 'object' && result.rateUsage !== null
          ? (result.rateUsage as Record<string, unknown>)
          : undefined;
      const rateCandidate =
        typeof result?.rate === 'object' && result.rate !== null
          ? (result.rate as Record<string, unknown>)
          : typeof result?.rateLimiter === 'object' && result.rateLimiter !== null
            ? (result.rateLimiter as Record<string, unknown>)
            : typeof result?.limits === 'object' && result.limits !== null
              ? (result.limits as Record<string, unknown>)
              : undefined;

      const normalized: WhatsAppStatus = {
        status: normalizedStatus,
        connected,
        ...normalizedQr,
        stats: statsCandidate ?? messagesCandidate ?? null,
        metrics: metricsCandidate ?? statsCandidate ?? null,
        messages: messagesCandidate ?? null,
        rate: rateCandidate ?? null,
        rateUsage: rateUsageCandidate ?? rateCandidate ?? null,
        raw: result ?? null,
      };

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
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      logger.warn('Failed to resolve WhatsApp session status via minimal broker; assuming disconnected', { error });
      return {
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
    }
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
      return this.sendViaBrokerRoutes(instanceId, normalizedPayload, dispatchOptions);
    }

    if (mode === 'instances') {
      return this.sendViaInstanceRoutes(instanceId, normalizedPayload, dispatchOptions);
    }

    try {
      return await this.sendViaBrokerRoutes(instanceId, normalizedPayload, dispatchOptions);
    } catch (error) {
      if (error instanceof WhatsAppBrokerError && this.shouldRetryWithInstanceRoutes(error)) {
        logger.warn('Broker route rejected payload; retrying via legacy instance endpoint', {
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
}

export const whatsappBrokerClient = new WhatsAppBrokerClient();
