import type { WhatsAppInstanceManager, WhatsAppMessage } from '@ticketz/integrations';

import { logger } from '../../config/logger';
import { ingestInboundWhatsAppMessage, type InboundWhatsAppEnvelope } from './services/inbound-lead-service';

type SidecarBridgeOptions = {
  dedupeTtlMs?: number;
};

const normalizeChatId = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('@')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  const base = digits.length > 0 ? `${digits}@s.whatsapp.net` : `${trimmed}@s.whatsapp.net`;
  return base;
};

const normalizePhone = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  return digits.startsWith('+') ? digits : `+${digits}`;
};

const buildEnvelopeFromMessage = (
  instanceId: string,
  tenantId: string | null,
  message: WhatsAppMessage,
  dedupeTtlMs: number | undefined
): InboundWhatsAppEnvelope => {
  const chatId = normalizeChatId(message.from) ?? `${tenantId ?? 'unknown'}@sidecar`;
  const phone = normalizePhone(message.from) ?? normalizePhone(message.to);
  const timestampIso = message.timestamp?.toISOString?.() ?? null;
  const metadata: Record<string, unknown> = {
    source: 'sidecar',
    mediaUrl: message.mediaUrl ?? null,
    mediaType: message.mediaType ?? null,
    mediaFileName: message.mediaFileName ?? null,
    mediaSizeBytes: message.mediaSizeBytes ?? null,
    mediaExpiresAt: message.mediaExpiresAt?.toISOString?.() ?? null,
    quotedMessage: message.quotedMessage ?? null,
    to: message.to ?? null,
  };

  const payload: Record<string, unknown> = {
    id: message.id,
    type: message.type,
    text: message.content,
    messageTimestamp: Math.floor(message.timestamp.getTime() / 1000),
  };

  if (message.mediaUrl) {
    payload['imageMessage'] = {
      url: message.mediaUrl,
      mimetype: message.mediaType ?? null,
      caption: message.content ?? null,
    };
  }

  return {
    origin: 'sidecar',
    transport: 'whatsapp',
    instanceId,
    chatId,
    tenantId,
    dedupeTtlMs,
    message: {
      kind: 'message',
      id: message.id,
      externalId: message.id,
      brokerMessageId: message.id,
      timestamp: timestampIso,
      direction: 'INBOUND',
      contact: {
        phone,
        name: message.from,
        pushName: message.from,
      },
      payload,
      metadata,
    },
    raw: {
      sidecar: true,
    },
  };
};

export const registerWhatsAppSidecarBridge = (
  manager: WhatsAppInstanceManager,
  options: SidecarBridgeOptions = {}
): (() => void) => {
  const { dedupeTtlMs } = options;

  const handleMessage = async (event: { instanceId: string; tenantId: string; message: WhatsAppMessage }) => {
    try {
      const envelope = buildEnvelopeFromMessage(event.instanceId, event.tenantId, event.message, dedupeTtlMs);
      await ingestInboundWhatsAppMessage(envelope);
    } catch (error) {
      logger.error('whatsappSidecarBridge.message.failed', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        instanceId: event.instanceId,
        tenantId: event.tenantId,
        messageId: event.message.id,
      });
    }
  };

  const handleUpdate = async (event: { instanceId: string; tenantId: string; update: { id?: string; status?: string; timestamp?: Date } }) => {
    try {
      await ingestInboundWhatsAppMessage({
        origin: 'sidecar',
        transport: 'whatsapp',
        instanceId: event.instanceId,
        chatId: null,
        tenantId: event.tenantId,
        dedupeTtlMs,
        message: {
          kind: 'update',
          id: event.update.id ?? 'unknown-update',
          status: event.update.status ?? null,
          timestamp: event.update.timestamp?.toISOString?.() ?? null,
          metadata: {
            status: event.update.status ?? null,
          },
        },
        raw: {
          sidecar: true,
          type: 'update',
        },
      });
    } catch (error) {
      logger.error('whatsappSidecarBridge.update.failed', {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        instanceId: event.instanceId,
        tenantId: event.tenantId,
        messageId: event.update.id ?? null,
      });
    }
  };

  manager.on('message.received', handleMessage);
  manager.on('message.update', handleUpdate);

  return () => {
    manager.off('message.received', handleMessage);
    manager.off('message.update', handleUpdate);
  };
};
