import { fetch, type RequestInit } from 'undici';
import { logger } from '../config/logger';

export class WhatsAppBrokerNotConfiguredError extends Error {
  constructor(message = 'WhatsApp broker not configured') {
    super(message);
    this.name = 'WhatsAppBrokerNotConfiguredError';
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

interface RawInstance {
  id?: string;
  name?: string;
  connected?: boolean;
  user?: { id?: string; name?: string } | null;
  counters?: { sent?: number; status?: Record<string, unknown> };
}

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

class WhatsAppBrokerClient {
  private readonly baseUrl = process.env.WHATSAPP_BROKER_URL?.replace(/\/$/, '') || '';
  private readonly apiKey = process.env.WHATSAPP_BROKER_API_KEY || '';

  private get isConfigured() {
    return this.baseUrl.length > 0 && this.apiKey.length > 0;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new WhatsAppBrokerNotConfiguredError();
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.isConfigured) {
      throw new WhatsAppBrokerNotConfiguredError();
    }

    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    headers.set('x-api-key', this.apiKey);
    if (init?.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => response.statusText);
      const normalizedMessage = this.extractErrorMessage(rawText);

      if (response.status === 401 || response.status === 403) {
        throw new WhatsAppBrokerNotConfiguredError(
          normalizedMessage || 'WhatsApp broker rejected credentials'
        );
      }

      throw new Error(`Broker request failed (${response.status}): ${normalizedMessage}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  private async requestBuffer(path: string): Promise<Buffer> {
    if (!this.isConfigured) {
      throw new WhatsAppBrokerNotConfiguredError();
    }

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => response.statusText);
      const normalizedMessage = this.extractErrorMessage(rawText);

      if (response.status === 401 || response.status === 403) {
        throw new WhatsAppBrokerNotConfiguredError(
          normalizedMessage || 'WhatsApp broker rejected credentials'
        );
      }

      throw new Error(`Broker request failed (${response.status}): ${normalizedMessage}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private slugify(value: string, fallback = 'whatsapp'): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : fallback;
  }

  private tenantPrefix(tenantId: string): string {
    return `${this.slugify(tenantId, 'tenant') }--`;
  }

  private humanizeName(raw: string, prefix: string, fallback: string): string {
    if (!raw) {
      return fallback;
    }
    const withoutPrefix = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
    return withoutPrefix
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || fallback;
  }

  private extractPhone(user: RawInstance['user']): string | null {
    if (!user?.id) {
      return null;
    }

    const match = user.id.match(/^(\d{12,})/);
    return match ? match[1] : null;
  }

  private extractErrorMessage(rawText: string | null | undefined): string {
    if (!rawText) {
      return '';
    }

    try {
      const parsed = JSON.parse(rawText);
      const message =
        (typeof parsed?.message === 'string' && parsed.message) ||
        (typeof parsed?.error?.message === 'string' && parsed.error.message);
      if (message) {
        return message;
      }
    } catch (error) {
      logger.debug('Failed to parse broker error message as JSON', { error, rawText });
    }

    return rawText;
  }

  private mapInstance(
    raw: RawInstance | null | undefined,
    tenantId: string,
    fallbackName?: string,
    enforcePrefix = true
  ): WhatsAppInstance | null {
    if (!raw) {
      return null;
    }

    const id = raw.id || raw.name;
    if (!id) {
      return null;
    }

    const prefix = this.tenantPrefix(tenantId);
    if (
      enforcePrefix &&
      !id.startsWith(prefix) &&
      !(raw.name && raw.name.startsWith(prefix))
    ) {
      return null;
    }

    const displayName = this.humanizeName(raw.name || id, prefix, fallbackName || 'WhatsApp');
    const isConnected = Boolean(raw.connected);
    const status: WhatsAppInstance['status'] = isConnected ? 'connected' : 'qr_required';

    return {
      id,
      tenantId,
      name: displayName,
      status,
      connected: isConnected,
      lastActivity: null,
      user: raw.user?.id || raw.user?.name || null,
      phoneNumber: this.extractPhone(raw.user),
      stats: {
        sent: raw.counters?.sent,
        byStatus: raw.counters?.status,
      },
    };
  }

  async listInstances(tenantId: string): Promise<WhatsAppInstance[]> {
    this.ensureConfigured();

    try {
      const result = await this.request<RawInstance[]>(`/instances`);
      const rawList = Array.isArray(result) ? result : [];
      let mapped = rawList
        .map((item) => this.mapInstance(item, tenantId, undefined, true))
        .filter((item): item is WhatsAppInstance => Boolean(item));

      if (mapped.length === 0) {
        mapped = rawList
          .map((item) => this.mapInstance(item, tenantId, item.name || item.id || undefined, false))
          .filter((item): item is WhatsAppInstance => Boolean(item));
      }

      if (mapped.length === 0) {
        return [fallbackInstance(tenantId)];
      }

      return mapped;
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      logger.warn('Failed to list WhatsApp instances via broker, returning fallback', { error });
      return [fallbackInstance(tenantId)];
    }
  }

  async createInstance(args: {
    tenantId: string;
    name: string;
    webhookUrl?: string;
  }): Promise<WhatsAppInstance> {
    this.ensureConfigured();

    const tenantPrefix = this.tenantPrefix(args.tenantId);
    const normalizedName = `${tenantPrefix}${this.slugify(args.name)}`.slice(0, 60);

    try {
      const payload = await this.request<RawInstance>(`/instances`, {
        method: 'POST',
        body: JSON.stringify({
          name: normalizedName,
        }),
      });

      return (
        this.mapInstance(payload, args.tenantId, args.name) || {
          ...fallbackInstance(args.tenantId),
          name: args.name,
          status: 'qr_required',
        }
      );
    } catch (error) {
      logger.error('Failed to create WhatsApp instance via broker', {
        error,
      });
      throw error;
    }
  }

  async connectInstance(instanceId: string): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    const encodedId = encodeURIComponent(instanceId);
    const startEndpoints = [
      `/instances/${encodedId}/start`,
      `/instances/${encodedId}/request-pairing-code`,
    ];

    let lastError: unknown;

    for (const endpoint of startEndpoints) {
      try {
        await this.request(endpoint, {
          method: 'POST',
        });
        return;
      } catch (error) {
        lastError = error;
        logger.warn('Unable to trigger WhatsApp start endpoint via broker; attempting fallback', {
          instanceId,
          endpoint,
          error,
        });
      }
    }

    if (lastError) {
      logger.warn('All attempts to trigger WhatsApp instance start via broker failed; continuing anyway', {
        instanceId,
        error: lastError,
      });
    }
  }

  async disconnectInstance(instanceId: string): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    try {
      await this.request(`/instances/${encodeURIComponent(instanceId)}/logout`, {
        method: 'POST',
      });
    } catch (error) {
      logger.warn('Unable to disconnect WhatsApp instance via broker; continuing anyway', {
        instanceId,
        error,
      });
    }
  }

  async deleteInstance(instanceId: string): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    try {
      await this.request(`/instances/${encodeURIComponent(instanceId)}/session/wipe`, {
        method: 'POST',
      });
    } catch (error) {
      logger.error('Failed to wipe WhatsApp instance via broker', { instanceId, error });
      throw error;
    }
  }

  async getQrCode(instanceId: string): Promise<WhatsAppQrCode> {
    this.ensureConfigured();

    try {
      const buffer = await this.requestBuffer(`/instances/${encodeURIComponent(instanceId)}/qr.png`);
      const qrCode = `data:image/png;base64,${buffer.toString('base64')}`;
      return {
        qrCode,
        expiresAt: new Date(Date.now() + QR_EXPIRATION_MS).toISOString(),
      };
    } catch (error) {
      logger.error('Failed to fetch WhatsApp QR code via broker', { instanceId, error });
      throw error;
    }
  }

  async getStatus(instanceId: string): Promise<WhatsAppStatus> {
    this.ensureConfigured();
    try {
      // Alguns brokers não expõem /status; usar /instances e inferir
      const result = await this.request<RawInstance[]>(`/instances`);
      const item = (Array.isArray(result) ? result : []).find((i) => i.id === instanceId || i.name === instanceId);
      const connected = Boolean(item?.connected);
      return { status: connected ? 'connected' : 'qr_required', connected };
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }

      logger.warn('Failed to get WhatsApp instance status via broker; assuming disconnected', { instanceId, error });
      return { status: 'disconnected', connected: false };
    }
  }

  private resolveSendEndpoint(instanceId: string, type?: string, hasMedia?: boolean): string {
    const normalizedType = (type || '').toLowerCase();
    if (normalizedType === 'image' && hasMedia) {
      return `/instances/${encodeURIComponent(instanceId)}/send-image`;
    }
    return `/instances/${encodeURIComponent(instanceId)}/send-text`;
  }

  async sendMessage(instanceId: string, payload: {
    to: string;
    content: string;
    type?: string;
    mediaUrl?: string;
  }): Promise<WhatsAppMessageResult> {
    this.ensureConfigured();

    const hasMedia = Boolean(payload.mediaUrl);
    const endpoint = this.resolveSendEndpoint(instanceId, payload.type, hasMedia);
    const body = endpoint.includes('send-image')
      ? {
          to: payload.to,
          url: payload.mediaUrl,
          caption: payload.content,
        }
      : {
          to: payload.to,
          message: payload.content,
        };

    try {
      const result = await this.request<Record<string, unknown>>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const externalId =
        (typeof result?.id === 'string' && result.id) ||
        (typeof result?.externalId === 'string' && result.externalId) ||
        `msg-${Date.now()}`;
      const status =
        (typeof result?.status === 'string' && result.status) ||
        (result?.ok === true ? 'sent' : 'unknown');

      return {
        externalId,
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp message via broker', { instanceId, error });
      throw error;
    }
  }
}

export const whatsappBrokerClient = new WhatsAppBrokerClient();
