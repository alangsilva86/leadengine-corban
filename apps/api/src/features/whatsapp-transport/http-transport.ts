import {
  BrokerOutboundMessageSchema,
  BrokerOutboundResponseSchema,
  type BrokerOutboundMessage,
  type BrokerOutboundResponse,
} from '../whatsapp-inbound/schemas/broker-contracts';
import {
  performWhatsAppBrokerRequest,
  resolveWhatsAppBrokerConfig,
  type WhatsAppBrokerResolvedConfig,
  type WhatsAppMessageResult,
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
} from '../../services/whatsapp-broker-client';
import { logger } from '../../config/logger';
import type {
  WhatsAppTransport,
  WhatsAppTransportSendMessagePayload,
} from './types';

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
};

const supportedDirectTypes = new Set([
  'text',
  'image',
  'video',
  'document',
  'audio',
  'template',
  'location',
  'contact',
]);
const mediaDirectTypes = new Set(['image', 'video', 'document', 'audio']);

export class HttpWhatsAppTransport implements WhatsAppTransport {
  readonly mode = 'http' as const;

  private resolveConfig(): WhatsAppBrokerResolvedConfig {
    return resolveWhatsAppBrokerConfig();
  }

  private buildDirectMediaRequestPayload(
    normalizedPayload: BrokerOutboundMessage,
    rawPayload: WhatsAppTransportSendMessagePayload
  ): { caption?: string; mediaUrl?: string; mimetype?: string; fileName?: string } {
    if (!mediaDirectTypes.has(normalizedPayload.type)) {
      return {};
    }

    const toTrimmedString = (value: unknown): string | undefined => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const mediaRecord = normalizedPayload.media ?? null;
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

    return {
      mediaUrl:
        toTrimmedString(rawPayload.mediaUrl) ??
        toTrimmedString(mediaRecord?.url) ??
        toTrimmedString((mediaRecord as Record<string, unknown> | null)?.['mediaUrl']),
      mimetype:
        toTrimmedString(rawPayload.mediaMimeType) ??
        toTrimmedString(mediaRecord?.mimetype) ??
        toTrimmedString((mediaRecord as Record<string, unknown> | null)?.['mimeType']),
      fileName:
        toTrimmedString(rawPayload.mediaFileName) ??
        toTrimmedString(mediaRecord?.filename) ??
        toTrimmedString((mediaRecord as Record<string, unknown> | null)?.['fileName']),
      caption: captionCandidate,
    };
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
    config: WhatsAppBrokerResolvedConfig,
    instanceId: string,
    normalizedPayload: BrokerOutboundMessage,
    options: { rawPayload: WhatsAppTransportSendMessagePayload; idempotencyKey?: string }
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    if (!supportedDirectTypes.has(normalizedPayload.type)) {
      throw new WhatsAppBrokerError(
        `Direct route for ${normalizedPayload.type} messages is not supported yet`,
        { code: 'DIRECT_ROUTE_UNAVAILABLE', brokerStatus: 415 }
      );
    }

    const encodedInstanceId = encodeURIComponent(instanceId);
    const mediaPayload = this.buildDirectMediaRequestPayload(normalizedPayload, options.rawPayload);
    const isMediaType = mediaDirectTypes.has(normalizedPayload.type);

    if (isMediaType) {
      const mediaUrl = mediaPayload.mediaUrl;
      if (typeof mediaUrl !== 'string' || mediaUrl.length === 0) {
        throw new WhatsAppBrokerError(
          `Direct route for ${normalizedPayload.type} messages requires mediaUrl`,
          { code: 'INVALID_MEDIA_PAYLOAD', brokerStatus: 422 }
        );
      }
    }

    const directRequestBody = compactObject({
      sessionId: instanceId,
      instanceId,
      to: normalizedPayload.to,
      type: normalizedPayload.type,
      previewUrl: normalizedPayload.previewUrl,
      externalId: normalizedPayload.externalId,
      template:
        normalizedPayload.type === 'template' ? (normalizedPayload.template as unknown) : undefined,
      location:
        normalizedPayload.type === 'location' ? (normalizedPayload.location as unknown) : undefined,
      contact:
        normalizedPayload.type === 'contact' ? (normalizedPayload.contact as unknown) : undefined,
      metadata: normalizedPayload.metadata,
      ...(isMediaType
        ? (() => {
            const mediaDescriptor: Record<string, string> = {};
            if (typeof mediaPayload.mediaUrl === 'string' && mediaPayload.mediaUrl.length > 0) {
              mediaDescriptor.url = mediaPayload.mediaUrl;
            }
            if (typeof mediaPayload.mimetype === 'string' && mediaPayload.mimetype.length > 0) {
              mediaDescriptor.mimetype = mediaPayload.mimetype;
            }
            if (typeof mediaPayload.fileName === 'string' && mediaPayload.fileName.length > 0) {
              mediaDescriptor.fileName = mediaPayload.fileName;
            }

            return {
              caption: mediaPayload.caption,
              message: mediaPayload.caption,
              media: mediaDescriptor,
            };
          })()
        : {
            text: normalizedPayload.content,
            message: normalizedPayload.content,
          }),
    });

    const endpoint = isMediaType ? '/send-media' : '/send-text';
    const routePath = `/instances/${encodedInstanceId}${endpoint}`;

    const previewSnippet = (() => {
      const text = normalizedPayload.content ?? '';
      if (!text) {
        return null;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return null;
      }
      return trimmed.length > 64 ? `${trimmed.slice(0, 61)}...` : trimmed;
    })();

    logger.info('🧭 [WhatsApp Broker] Selecionando rota direta para envio', {
      instanceId,
      to: normalizedPayload.to,
      messageType: normalizedPayload.type,
      endpoint: routePath,
      idempotencyKey: options.idempotencyKey ?? null,
      hasMedia: isMediaType,
      mediaHasCaption: Boolean(mediaPayload.caption),
      previewSnippet,
    });

    const response = await performWhatsAppBrokerRequest<Record<string, unknown>>(
      routePath,
      {
        method: 'POST',
        body: JSON.stringify(directRequestBody),
      },
      { idempotencyKey: options.idempotencyKey },
      config
    );

    const normalizedResponse = BrokerOutboundResponseSchema.parse(response);

    logger.info('🎉 [WhatsApp Broker] Resposta recebida da rota direta', {
      instanceId,
      to: normalizedPayload.to,
      messageType: normalizedPayload.type,
      endpoint: routePath,
      externalId: normalizedResponse.externalId,
      status: normalizedResponse.status,
    });

    return this.buildMessageResult(normalizedPayload, normalizedResponse);
  }

  async sendMessage(
    instanceId: string,
    payload: WhatsAppTransportSendMessagePayload,
    options: { idempotencyKey?: string } = {}
  ): Promise<WhatsAppMessageResult & { raw?: Record<string, unknown> | null }> {
    let config: WhatsAppBrokerResolvedConfig;
    try {
      config = this.resolveConfig();
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }
      throw new WhatsAppBrokerNotConfiguredError(
        'WhatsApp broker is not configured for HTTP transport'
      );
    }

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
      contact: payload.contact as unknown,
      template: payload.template as unknown,
      poll: payload.poll as unknown,
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
      const provided = options.idempotencyKey;
      if (typeof provided === 'string') {
        const trimmed = provided.trim();
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

    try {
      return await this.sendViaDirectRoutes(config, instanceId, normalizedPayload, dispatchOptions);
    } catch (error) {
      if (error instanceof WhatsAppBrokerError) {
        throw error;
      }
      throw new WhatsAppBrokerError('Failed to send WhatsApp message via HTTP transport', {
        code: 'BROKER_ERROR',
        cause: error,
      });
    }
  }

  async checkRecipient(payload: {
    sessionId: string;
    instanceId?: string;
    to: string;
  }): Promise<Record<string, unknown>> {
    const config = this.resolveConfig();
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

    return performWhatsAppBrokerRequest<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/exists`,
      {
        method: 'POST',
        body,
      },
      undefined,
      config
    );
  }

  async createPoll(payload: {
    sessionId: string;
    instanceId?: string;
    to: string;
    question: string;
    options: string[];
    allowMultipleAnswers?: boolean;
  }): Promise<{
    id: string;
    status: string;
    ack: string | number | null;
    rate: unknown;
    raw: Record<string, unknown> | null;
  }> {
    const config = this.resolveConfig();
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

    const response = await performWhatsAppBrokerRequest<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/send-poll`,
      {
        method: 'POST',
        body: requestBody,
      },
      undefined,
      config
    );

    const rawResponse =
      response && typeof response === 'object' ? (response as Record<string, unknown>) : null;
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
      typeof ackCandidate === 'number' || typeof ackCandidate === 'string' ? ackCandidate : null;

    const rate = record['rate'] ?? null;

    return {
      id: resolvedId,
      status,
      ack,
      rate,
      raw: rawResponse,
    };
  }

  async getGroups(payload: {
    sessionId: string;
    instanceId?: string;
  }): Promise<Record<string, unknown>> {
    const config = this.resolveConfig();
    const sessionId = payload.sessionId;
    const instanceId = payload.instanceId ?? sessionId;
    const encodedInstanceId = encodeURIComponent(instanceId);

    return performWhatsAppBrokerRequest<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/groups`,
      { method: 'GET' },
      undefined,
      config
    );
  }
}
