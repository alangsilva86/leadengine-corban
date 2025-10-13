import { getWhatsAppMode, type WhatsAppTransportMode } from '../../config/whatsapp';
import {
  WhatsAppBrokerNotConfiguredError,
  type WhatsAppMessageResult,
} from '../../services/whatsapp-broker-client';
import type {
  WhatsAppTransport,
  WhatsAppTransportSendMessagePayload,
} from './types';
import { HttpWhatsAppTransport } from './http-transport';

class DryRunTransport implements WhatsAppTransport {
  readonly mode = 'dryrun' as const;

  async sendMessage(
    instanceId: string,
    payload: WhatsAppTransportSendMessagePayload
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    const now = new Date();
    const externalId = (() => {
      if (typeof payload.externalId === 'string' && payload.externalId.trim().length > 0) {
        return payload.externalId.trim();
      }
      return `msg_${now.getTime()}`;
    })();

    return {
      externalId,
      status: 'sent',
      timestamp: now.toISOString(),
      raw: {
        dryrun: true,
        mode: 'dryrun',
        channel: 'whatsapp',
      },
    };
  }

  async checkRecipient(): Promise<Record<string, unknown>> {
    return { dryrun: true, exists: true } satisfies Record<string, unknown>;
  }

  async getGroups(): Promise<Record<string, unknown>> {
    return { dryrun: true, groups: [] } satisfies Record<string, unknown>;
  }

  async createPoll(): Promise<{
    id: string;
    status: string;
    ack: string | number | null;
    rate: unknown;
    raw: Record<string, unknown> | null;
  }> {
    return {
      id: `poll-${Date.now()}`,
      status: 'sent',
      ack: 'dryrun',
      rate: null,
      raw: { dryrun: true },
    };
  }
}

class UnsupportedTransport implements WhatsAppTransport {
  readonly mode: WhatsAppTransportMode;

  constructor(mode: WhatsAppTransportMode) {
    this.mode = mode;
  }

  private createError(): WhatsAppBrokerNotConfiguredError {
    return new WhatsAppBrokerNotConfiguredError(
      `WhatsApp transport mode "${this.mode}" is not supported by the HTTP transport`
    );
  }

  sendMessage(): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    return Promise.reject(this.createError());
  }

  checkRecipient(): Promise<Record<string, unknown>> {
    return Promise.reject(this.createError());
  }

  getGroups(): Promise<Record<string, unknown>> {
    return Promise.reject(this.createError());
  }

  createPoll(): Promise<{
    id: string;
    status: string;
    ack: string | number | null;
    rate: unknown;
    raw: Record<string, unknown> | null;
  }> {
    return Promise.reject(this.createError());
  }
}

let cachedTransport: WhatsAppTransport | null = null;

const createTransport = (): WhatsAppTransport => {
  const mode = getWhatsAppMode();
  if (mode === 'http') {
    return new HttpWhatsAppTransport();
  }

  if (mode === 'dryrun') {
    return new DryRunTransport();
  }

  return new UnsupportedTransport(mode);
};

export const getWhatsAppTransport = (): WhatsAppTransport => {
  if (!cachedTransport) {
    cachedTransport = createTransport();
  }
  return cachedTransport;
};

export const refreshWhatsAppTransport = () => {
  cachedTransport = null;
};

export type { WhatsAppTransport } from './types';
export type { WhatsAppTransportSendMessagePayload } from './types';
