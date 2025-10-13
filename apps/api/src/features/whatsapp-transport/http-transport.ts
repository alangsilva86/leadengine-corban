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
]);

export class HttpWhatsAppTransport implements WhatsAppTransport {
  readonly mode = 'http' as const;

  private resolveConfig(): WhatsAppBrokerResolvedConfig {
    return resolveWhatsAppBrokerConfig();
  }

  private buildDirectMediaRequestPayload(
    normalizedPayload: BrokerOutboundMessage,
    rawPayload: WhatsAppTransportSendMessagePayload
  ): Record<string, unknown> {
    if (!['image', 'video', 'document', 'audio'].includes(normalizedPayload.type)) {
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

    if (['image', 'video', 'document', 'audio'].includes(normalizedPayload.type)) {
      const mediaUrl = mediaPayload['mediaUrl'];
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

    const response = await performWhatsAppBrokerRequest<Record<string, unknown>>(
      `/instances/${encodedInstanceId}/send-text`,
      {
        method: 'POST',
        body: JSON.stringify(directRequestBody),
      },
      { idempotencyKey: options.idempotencyKey },
      config
    );

    const normalizedResponse = BrokerOutboundResponseSchema.parse(response);
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
