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

  async connectSession(sessionId: string, payload: { webhookUrl?: string; forceReopen?: boolean } = {}): Promise<void> {
    await this.request<void>(
      '/broker/session/connect',
      {
        method: 'POST',
        body: JSON.stringify(
          compactObject({
            sessionId,
            webhookUrl: payload.webhookUrl,
            forceReopen: payload.forceReopen,
          })
        ),
      }
    );
  }

  async logoutSession(sessionId: string, options: { wipe?: boolean } = {}): Promise<void> {
    await this.request<void>('/broker/session/logout', {
      method: 'POST',
      body: JSON.stringify(compactObject({ sessionId, wipe: options.wipe })),
    });
  }

  async getSessionStatus<T = Record<string, unknown>>(sessionId: string): Promise<T> {
    return this.request<T>(
      '/broker/session/status',
      {
        method: 'GET',
      },
      {
        searchParams: { sessionId },
      }
    );
  }

  async sendText<T = Record<string, unknown>>(
    payload: {
      sessionId: string;
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
          to: payload.to,
          message: payload.message,
          previewUrl: payload.previewUrl,
          externalId: payload.externalId,
          type: 'text',
        })
      ),
    });
  }

  async createPoll<T = Record<string, unknown>>(
    payload: {
      sessionId: string;
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
          to: payload.to,
          question: payload.question,
          options: payload.options,
          allowMultipleAnswers: payload.allowMultipleAnswers,
        })
      ),
    });
  }

  async fetchEvents<T = { events: unknown[] }>(params: { limit?: number; cursor?: string } = {}): Promise<T> {
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
        },
      }
    );
  }

  async ackEvents(payload: { ids: string[] }): Promise<void> {
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
        body: JSON.stringify({ ids }),
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

  private findSessionPayload(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const queue: Record<string, unknown>[] = [value as Record<string, unknown>];
    const visited = new Set<unknown>();

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
        return current;
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

    return null;
  }

  async listInstances(tenantId: string): Promise<WhatsAppInstance[]> {
    const candidatePaths = [
      '/broker/session/status',
      '/broker/sessions/status',
      '/broker/sessionStatus',
    ];

    let lastError: unknown;

    const tenantApiKey = typeof tenantId === 'string' ? tenantId.trim() : '';
    const apiKey = tenantApiKey.length > 0 ? tenantApiKey : undefined;

    for (let index = 0; index < candidatePaths.length; index += 1) {
      const path = candidatePaths[index];

      try {
        const response = await this.request<unknown>(
          path,
          {
            method: 'GET',
          },
          {
            apiKey,
          }
        );

        const session = this.findSessionPayload(response);
        if (!session) {
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

        const normalized = this.normalizeBrokerInstance(tenantId, session);

        if (!normalized) {
          if (index === candidatePaths.length - 1) {
            return [];
          }
          continue;
        }

        return [normalized];
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

  async connectInstance(instanceId: string): Promise<void> {
    await this.connectSession(instanceId);
  }

  async disconnectInstance(instanceId: string, options: { wipe?: boolean } = {}): Promise<void> {
    await this.logoutSession(instanceId, options);
  }

  async deleteInstance(instanceId: string, options: { wipe?: boolean } = {}): Promise<void> {
    await this.logoutSession(instanceId, options);
  }

  async getQrCode(instanceId: string): Promise<WhatsAppQrCode> {
    this.ensureConfigured();

    try {
      const statusPayload = await this.getSessionStatus<Record<string, unknown>>(
        instanceId
      );
      const normalized = this.normalizeQrPayload(statusPayload);

      if (normalized.qr || normalized.qrCode || normalized.qrExpiresAt || normalized.expiresAt) {
        return normalized;
      }

      const payload = await this.request<Record<string, unknown>>(
        '/broker/session/qr',
        { method: 'GET' },
        { searchParams: { sessionId: instanceId } }
      );

      return this.normalizeQrPayload(payload);
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      logger.warn('Failed to fetch WhatsApp QR code from broker', {
        instanceId,
        error,
      });
      return { qr: null, qrCode: null, qrExpiresAt: null, expiresAt: null };
    }
  }

  async getStatus(instanceId: string): Promise<WhatsAppStatus> {
    this.ensureConfigured();

    try {
      const result = await this.getSessionStatus<Record<string, unknown>>(instanceId);
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

      return {
        status: normalizedStatus,
        connected,
        ...normalizedQr,
      };
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
      };
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

    const response = await this.sendText<{ externalId?: string; id?: string; status?: string }>(
      {
        sessionId: instanceId,
        to: payload.to,
        message: payload.content,
        previewUrl: payload.previewUrl,
        externalId: payload.externalId,
      }
    );

    const externalId =
      (typeof response?.externalId === 'string' && response.externalId) ||
      (typeof response?.id === 'string' && response.id) ||
      payload.externalId ||
      `msg-${Date.now()}`;

    const status = (typeof response?.status === 'string' && response.status) || 'sent';

    return {
      externalId,
      status,
      timestamp: new Date().toISOString(),
    };
  }
}

export const whatsappBrokerClient = new WhatsAppBrokerClient();
