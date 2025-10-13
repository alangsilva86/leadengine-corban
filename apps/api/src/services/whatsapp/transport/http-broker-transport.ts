import {
  type SendMediaInput,
  type SendResult,
  type SendTextInput,
  type ExistsResult,
  type StatusResult,
  WhatsAppTransportError,
  resolveCanonicalError,
  SendResultSchema,
  ExistsResultSchema,
  StatusResultSchema,
} from '@ticketz/wa-contracts';

import {
  whatsappBrokerClient,
  WhatsAppBrokerError,
  translateWhatsAppBrokerError,
} from '../../whatsapp-broker-client';

const inferInstanceId = (input: { sessionId: string; instanceId?: string | null }): string => {
  if (input.instanceId && input.instanceId.trim().length > 0) {
    return input.instanceId;
  }
  return input.sessionId;
};

const normalizeSendResult = (payload: SendResult): SendResult => {
  return SendResultSchema.parse({ ...payload, transport: 'http' });
};

const normalizeExistsResult = (payload: ExistsResult): ExistsResult => {
  return ExistsResultSchema.parse(payload);
};

const normalizeStatusResult = (payload: StatusResult): StatusResult => {
  return StatusResultSchema.parse(payload);
};

export class HttpBrokerTransport {
  readonly mode = 'http' as const;

  async sendText(input: SendTextInput): Promise<SendResult> {
    try {
      const instanceId = inferInstanceId(input);
      const response = await whatsappBrokerClient.sendMessage(
        instanceId,
        {
          to: input.to,
          content: input.message,
          type: 'text',
          previewUrl: input.previewUrl,
          externalId: input.externalId,
          metadata: input.metadata ?? undefined,
        },
        input.idempotencyKey
      );

      return normalizeSendResult({
        externalId: response.externalId,
        status: response.status,
        timestamp: response.timestamp ?? null,
        raw: response.raw ?? null,
        transport: 'http',
      });
    } catch (error) {
      throw this.wrapError(error, 'Falha ao enviar mensagem de texto via broker WhatsApp');
    }
  }

  async sendMedia(input: SendMediaInput): Promise<SendResult> {
    try {
      const instanceId = inferInstanceId(input);
      const response = await whatsappBrokerClient.sendMessage(
        instanceId,
        {
          to: input.to,
          content: input.caption ?? '',
          caption: input.caption,
          type: input.mediaType ?? 'image',
          mediaUrl: input.mediaUrl,
          mediaMimeType: input.mediaMimeType,
          mediaFileName: input.mediaFileName,
          externalId: input.externalId,
          metadata: input.metadata ?? undefined,
        },
        input.idempotencyKey
      );

      return normalizeSendResult({
        externalId: response.externalId,
        status: response.status,
        timestamp: response.timestamp ?? null,
        raw: response.raw ?? null,
        transport: 'http',
      });
    } catch (error) {
      throw this.wrapError(error, 'Falha ao enviar mídia via broker WhatsApp');
    }
  }

  async checkRecipient(input: { sessionId: string; instanceId?: string; to: string }): Promise<ExistsResult> {
    try {
      const result = await whatsappBrokerClient.checkRecipient({
        sessionId: input.sessionId,
        instanceId: input.instanceId,
        to: input.to,
      });

      const exists = Boolean((result as Record<string, unknown>)?.exists);
      const canReceive = exists || Boolean((result as Record<string, unknown>)?.canReceive);

      return normalizeExistsResult({
        exists,
        canReceive,
        reason: (result as Record<string, unknown>)?.reason as string | undefined,
        raw: result as Record<string, unknown>,
      });
    } catch (error) {
      throw this.wrapError(error, 'Falha ao verificar destinatário via broker WhatsApp');
    }
  }

  async getStatus(input: { sessionId: string; instanceId?: string }): Promise<StatusResult> {
    try {
      const status = await whatsappBrokerClient.getStatus(input.sessionId, {
        instanceId: input.instanceId,
      });

      return normalizeStatusResult({
        ...status,
      });
    } catch (error) {
      throw this.wrapError(error, 'Falha ao consultar status da sessão via broker WhatsApp');
    }
  }

  private wrapError(error: unknown, fallbackMessage: string): WhatsAppTransportError {
    if (error instanceof WhatsAppTransportError) {
      return error;
    }

    if (error instanceof WhatsAppBrokerError) {
      const canonical = translateWhatsAppBrokerError(error);
      return new WhatsAppTransportError(canonical?.message ?? error.message ?? fallbackMessage, {
        code: error.code,
        status: typeof error.brokerStatus === 'number' ? error.brokerStatus : undefined,
        requestId: error.requestId,
        transport: 'http',
        canonical: canonical ?? resolveCanonicalError(error.code),
        details: {
          brokerCode: error.brokerCode ?? error.code,
          brokerStatus: error.brokerStatus ?? null,
        },
        cause: error,
      });
    }

    return new WhatsAppTransportError(fallbackMessage, {
      code: 'UNKNOWN_ERROR',
      transport: 'http',
      canonical: resolveCanonicalError('UNKNOWN_ERROR'),
      cause: error,
    });
  }
}

export type HttpBrokerTransportMode = InstanceType<typeof HttpBrokerTransport>['mode'];
