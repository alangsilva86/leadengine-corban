import { fetch, type RequestInit } from 'undici';
import { logger } from '../config/logger';

export class WhatsAppBrokerNotConfiguredError extends Error {
  constructor(message = 'WhatsApp broker not configured') {
    super(message);
    this.name = 'WhatsAppBrokerNotConfiguredError';
  }
}

export class WhatsAppBrokerError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'WhatsAppBrokerError';
    this.code = code;
    this.status = status;
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
  qrCode: string;
  expiresAt: string;
}

export interface WhatsAppStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_required';
  connected: boolean;
}

export interface WhatsAppMessageResult {
  externalId: string;
  status: string;
  timestamp?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

const FALLBACK_QR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const QR_EXPIRATION_MS = 60_000;

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
};

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
};

class WhatsAppBrokerClient {
  private get mode(): string {
    return (process.env.WHATSAPP_MODE || '').trim().toLowerCase();
  }

  private get baseUrl(): string {
    return process.env.WHATSAPP_BROKER_URL?.replace(/\/$/, '') || '';
  }

  private get brokerApiKey(): string {
    return process.env.WHATSAPP_BROKER_API_KEY || '';
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
    if (this.mode && this.mode !== 'http') {
      throw new WhatsAppBrokerNotConfiguredError(
        'WhatsApp broker only available when WHATSAPP_MODE is set to "http"'
      );
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

  private async handleError(response: Response): Promise<never> {
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

    const normalizedError = (() => {
      const candidate = parsed?.error && typeof parsed.error === 'object' ? (parsed.error as Record<string, unknown>) : parsed;
      const code = typeof candidate?.code === 'string' ? candidate.code : undefined;
      const message = typeof candidate?.message === 'string' ? candidate.message : undefined;
      return { code, message };
    })();

    if (response.status === 401 || response.status === 403) {
      throw new WhatsAppBrokerNotConfiguredError(
        normalizedError.message || 'WhatsApp broker rejected credentials'
      );
    }

    const code = normalizedError.code || 'BROKER_ERROR';
    const message =
      normalizedError.message || `WhatsApp broker request failed (${response.status})`;

    throw new WhatsAppBrokerError(message, code, response.status);
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
        throw new WhatsAppBrokerError('WhatsApp broker request timed out', 'REQUEST_TIMEOUT', 408);
      }

      logger.error('Unexpected WhatsApp broker request failure', { path, error });
      throw error;
    } finally {
      cancel();
    }
  }

  async connectSession(
    instanceId: string,
    payload: { webhookUrl?: string; forceReopen?: boolean } = {}
  ): Promise<void> {
    await this.request<void>(
      '/broker/session/connect',
      {
        method: 'POST',
        body: JSON.stringify(
          compactObject({
            instanceId,
            webhookUrl: payload.webhookUrl,
            forceReopen: payload.forceReopen,
          })
        ),
      }
    );
  }

  async logoutSession(instanceId: string): Promise<void> {
    await this.request<void>('/broker/session/logout', {
      method: 'POST',
      body: JSON.stringify({ instanceId }),
    });
  }

  async getSessionStatus<T extends Record<string, unknown> = Record<string, unknown>>(
    instanceId: string
  ): Promise<T> {
    const path = `/broker/session/${encodeURIComponent(instanceId)}/status`;
    const response = (await this.request<Record<string, unknown>>(path, {
      method: 'GET',
    })) as Record<string, unknown>;

    const connected = Boolean(response?.connected);
    const rate =
      response?.rate && typeof response.rate === 'object' ? (response.rate as Record<string, unknown>) : undefined;
    const user =
      response?.user && typeof response.user === 'object' ? (response.user as Record<string, unknown>) : undefined;
    const qr = (() => {
      const raw = response?.qr;
      if (!raw || typeof raw !== 'object') {
        return undefined;
      }

      const record = raw as Record<string, unknown>;
      const content = typeof record.content === 'string' && record.content.trim().length > 0 ? record.content : undefined;
      if (!content) {
        return undefined;
      }

      const expiresAt = typeof record.expiresAt === 'string' ? record.expiresAt : undefined;
      return compactObject({ content, expiresAt });
    })();

    return {
      ...response,
      connected,
      rate,
      user,
      qr,
    } as unknown as T;
  }

  async sendText<T = Record<string, unknown>>(
    payload: {
      instanceId: string;
      to: string;
      text: string;
      previewUrl?: boolean;
      externalId?: string;
      waitAckMs?: number;
      timeoutMs?: number;
      skipNormalize?: boolean;
    }
  ): Promise<T> {
    return this.request<T>('/broker/messages', {
      method: 'POST',
      body: JSON.stringify(
        compactObject({
          instanceId: payload.instanceId,
          to: payload.to,
          text: payload.text,
          previewUrl: payload.previewUrl,
          externalId: payload.externalId,
          waitAckMs: payload.waitAckMs,
          timeoutMs: payload.timeoutMs,
          skipNormalize: payload.skipNormalize,
          type: 'text',
        })
      ),
    });
  }

  async createPoll<T = Record<string, unknown>>(
    payload: {
      instanceId: string;
      to: string;
      question: string;
      options: string[];
      allowMultipleAnswers?: boolean;
      selectableCount?: number;
    }
  ): Promise<T> {
    return this.request<T>('/broker/polls', {
      method: 'POST',
      body: JSON.stringify(
        compactObject({
          instanceId: payload.instanceId,
          to: payload.to,
          question: payload.question,
          options: payload.options,
          selectableCount:
            typeof payload.selectableCount === 'number'
              ? payload.selectableCount
              : payload.allowMultipleAnswers
              ? payload.options.length
              : 1,
        })
      ),
    });
  }

  async fetchEvents<T = { events: unknown[] }>(params: { limit?: number; cursor?: string } = {}): Promise<T> {
    const response = (await this.request<Record<string, unknown>>(
      '/broker/events',
      {
        method: 'GET',
      },
      {
        apiKey: this.webhookApiKey,
        searchParams: {
          limit: params.limit,
          after: params.cursor,
        },
      }
    )) as Record<string, unknown>;

    const items = Array.isArray(response?.items) ? response.items : [];
    const nextCursor = typeof response?.nextCursor === 'string' ? response.nextCursor : null;
    const pending = typeof response?.pending === 'number' ? response.pending : undefined;
    const ack =
      response?.ack && typeof response.ack === 'object' ? (response.ack as Record<string, unknown>) : undefined;

    return {
      ...response,
      items,
      events: items,
      nextCursor,
      pending,
      ack,
    } as unknown as T;
  }

  async ackEvents(eventIds: string[]): Promise<void> {
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return;
    }

    await this.request<void>(
      '/broker/events/ack',
      {
        method: 'POST',
        body: JSON.stringify({ ids: eventIds }),
      },
      {
        apiKey: this.webhookApiKey,
      }
    );
  }

  async listInstances(tenantId: string): Promise<WhatsAppInstance[]> {
    this.ensureConfigured();
    logger.warn('WhatsApp minimal broker does not expose instance listing; returning fallback instance');
    return [fallbackInstance(tenantId)];
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

  async connectInstance(instanceId: string): Promise<void> {
    await this.connectSession(instanceId);
  }

  async disconnectInstance(instanceId: string): Promise<void> {
    await this.logoutSession(instanceId);
  }

  async deleteInstance(instanceId: string): Promise<void> {
    await this.logoutSession(instanceId);
  }

  async getQrCode(_instanceId: string): Promise<WhatsAppQrCode> {
    this.ensureConfigured();
    return {
      qrCode: FALLBACK_QR,
      expiresAt: new Date(Date.now() + QR_EXPIRATION_MS).toISOString(),
    };
  }

  async getStatus(instanceId: string): Promise<WhatsAppStatus> {
    this.ensureConfigured();

    try {
      const result = await this.getSessionStatus<{ status?: string; connected?: boolean }>(instanceId);
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

      return {
        status: normalizedStatus,
        connected,
      };
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      logger.warn('Failed to resolve WhatsApp session status via minimal broker; assuming disconnected', { error });
      return { status: 'disconnected', connected: false };
    }
  }

  async sendMessage(
    instanceId: string,
    payload: {
      to: string;
      content: string;
      type?: string;
      previewUrl?: boolean;
      externalId?: string;
    }
  ): Promise<WhatsAppMessageResult> {
    const normalizedType = (payload.type || 'text').toLowerCase();
    if (normalizedType !== 'text') {
      throw new WhatsAppBrokerError(
        `Message type "${payload.type}" is not supported by the HTTP WhatsApp broker`,
        'NOT_SUPPORTED',
        400
      );
    }

    const response = await this.sendText<
      {
        externalId?: string;
        id?: string;
        status?: string;
        ack?: Record<string, unknown>;
      }
    >(
      {
        instanceId,
        to: payload.to,
        text: payload.content,
        previewUrl: payload.previewUrl,
        externalId: payload.externalId,
      }
    );

    const ackRecord =
      response?.ack && typeof response.ack === 'object' ? (response.ack as Record<string, unknown>) : undefined;

    const externalId = (() => {
      const ackId = typeof ackRecord?.id === 'string' && ackRecord.id.trim().length > 0 ? ackRecord.id.trim() : null;
      if (ackId) {
        return ackId;
      }
      if (typeof response?.externalId === 'string' && response.externalId.trim().length > 0) {
        return response.externalId.trim();
      }
      if (typeof response?.id === 'string' && response.id.trim().length > 0) {
        return response.id.trim();
      }
      if (payload.externalId && payload.externalId.trim().length > 0) {
        return payload.externalId.trim();
      }
      return `msg-${Date.now()}`;
    })();

    const status = (() => {
      const ackStatus = typeof ackRecord?.status === 'string' ? ackRecord.status : undefined;
      if (ackStatus) {
        return ackStatus;
      }
      if (typeof response?.status === 'string' && response.status.trim().length > 0) {
        return response.status.trim();
      }
      return 'sent';
    })();

    const timestamp = (() => {
      if (typeof ackRecord?.timestamp === 'string' && ackRecord.timestamp.trim().length > 0) {
        return ackRecord.timestamp.trim();
      }
      return new Date().toISOString();
    })();

    return {
      externalId,
      status,
      timestamp,
    };
  }
}

export const whatsappBrokerClient = new WhatsAppBrokerClient();
