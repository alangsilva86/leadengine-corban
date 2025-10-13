import {
  type ExistsResult,
  type SendMediaInput,
  type SendResult,
  type SendTextInput,
  type StatusResult,
  WhatsAppTransportError,
  resolveCanonicalError,
  CANONICAL_ERRORS,
  SendResultSchema,
  StatusResultSchema,
} from '@ticketz/wa-contracts';
import { WhatsAppInstanceManager } from '@ticketz/integrations';

import { logger } from '../../../config/logger';

const inferInstanceId = (input: { sessionId: string; instanceId?: string | null }): string => {
  if (input.instanceId && input.instanceId.trim().length > 0) {
    return input.instanceId;
  }
  return input.sessionId;
};

const ensureInstanceConnected = (
  manager: WhatsAppInstanceManager,
  instanceId: string
) => {
  const instance = manager.getInstance(instanceId);

  if (!instance) {
    throw new WhatsAppTransportError('Instância WhatsApp não encontrada no sidecar.', {
      code: 'INSTANCE_NOT_FOUND',
      transport: 'sidecar',
      canonical: resolveCanonicalError('INSTANCE_NOT_CONNECTED'),
      details: { instanceId },
    });
  }

  if (instance.status !== 'connected') {
    throw new WhatsAppTransportError(CANONICAL_ERRORS.INSTANCE_NOT_CONNECTED.message, {
      code: CANONICAL_ERRORS.INSTANCE_NOT_CONNECTED.code,
      transport: 'sidecar',
      canonical: CANONICAL_ERRORS.INSTANCE_NOT_CONNECTED,
      details: { instanceId, status: instance.status },
    });
  }

  return instance;
};

const buildMetadata = (
  input: Pick<SendTextInput, 'metadata' | 'externalId' | 'idempotencyKey'>
): Record<string, unknown> | undefined => {
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
  };

  if (input.externalId) {
    metadata.externalId = input.externalId;
  }

  if (input.idempotencyKey) {
    metadata.idempotencyKey = input.idempotencyKey;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

export class SidecarTransport {
  readonly mode = 'sidecar' as const;

  constructor(private readonly manager: WhatsAppInstanceManager) {}

  async sendText(input: SendTextInput): Promise<SendResult> {
    const instanceId = inferInstanceId(input);
    const instance = ensureInstanceConnected(this.manager, instanceId);

    try {
      const result = await this.manager.sendMessage(
        instance.id,
        input.to,
        input.message,
        buildMetadata(input)
      );

      return SendResultSchema.parse({
        externalId: result.externalId,
        status: result.status ?? 'sent',
        timestamp: new Date().toISOString(),
        raw: { provider: 'sidecar', instanceId: instance.id },
        transport: 'sidecar',
      });
    } catch (error) {
      logger.error('Erro ao enviar mensagem via sidecar WhatsApp', {
        instanceId: instance.id,
        to: input.to,
        error,
      });

      throw new WhatsAppTransportError('Falha ao enviar mensagem via sidecar do WhatsApp.', {
        code: 'SIDECAR_ERROR',
        transport: 'sidecar',
        canonical: resolveCanonicalError('UNKNOWN_ERROR'),
        cause: error,
        details: { instanceId: instance.id },
      });
    }
  }

  async sendMedia(input: SendMediaInput): Promise<SendResult> {
    const instanceId = inferInstanceId(input);
    const instance = ensureInstanceConnected(this.manager, instanceId);

    try {
      const result = await this.manager.sendMedia(
        instance.id,
        input.to,
        input.mediaUrl,
        input.caption,
        buildMetadata(input)
      );

      return SendResultSchema.parse({
        externalId: result.externalId,
        status: result.status ?? 'sent',
        timestamp: new Date().toISOString(),
        raw: {
          provider: 'sidecar',
          instanceId: instance.id,
          mediaUrl: input.mediaUrl,
        },
        transport: 'sidecar',
      });
    } catch (error) {
      logger.error('Erro ao enviar mídia via sidecar WhatsApp', {
        instanceId: instance.id,
        to: input.to,
        error,
      });

      throw new WhatsAppTransportError('Falha ao enviar mídia via sidecar do WhatsApp.', {
        code: 'SIDECAR_ERROR',
        transport: 'sidecar',
        canonical: resolveCanonicalError('UNKNOWN_ERROR'),
        cause: error,
        details: { instanceId: instance.id },
      });
    }
  }

  async checkRecipient(_input: { sessionId: string; instanceId?: string; to: string }): Promise<ExistsResult> {
    throw new WhatsAppTransportError('Sidecar não suporta verificação de destinatário.', {
      code: CANONICAL_ERRORS.UNSUPPORTED_OPERATION.code,
      transport: 'sidecar',
      canonical: CANONICAL_ERRORS.UNSUPPORTED_OPERATION,
    });
  }

  async getStatus(input: { sessionId: string; instanceId?: string }): Promise<StatusResult> {
    const instanceId = inferInstanceId(input);
    const instance = this.manager.getInstance(instanceId);

    if (!instance) {
      return StatusResultSchema.parse({
        status: 'disconnected',
        connected: false,
        qr: null,
        qrCode: null,
        qrExpiresAt: null,
        expiresAt: null,
        stats: null,
        metrics: null,
        rate: null,
        rateUsage: null,
        messages: null,
        raw: { provider: 'sidecar', instanceId, reason: 'not_found' },
      });
    }

    const status = (() => {
      switch (instance.status) {
        case 'connecting':
          return 'connecting' as const;
        case 'connected':
          return 'connected' as const;
        case 'qr_required':
          return 'qr_required' as const;
        case 'error':
          return 'failed' as const;
        default:
          return 'disconnected' as const;
      }
    })();

    return StatusResultSchema.parse({
      status,
      connected: instance.status === 'connected',
      qr: null,
      qrCode: null,
      qrExpiresAt: null,
      expiresAt: null,
      stats: null,
      metrics: null,
      rate: null,
      rateUsage: null,
      messages: null,
      raw: { provider: 'sidecar', instance },
    });
  }
}
