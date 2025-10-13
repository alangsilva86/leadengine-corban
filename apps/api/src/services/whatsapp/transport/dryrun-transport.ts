import {
  type ExistsResult,
  type SendMediaInput,
  type SendResult,
  type SendTextInput,
  type StatusResult,
  SendResultSchema,
  ExistsResultSchema,
  StatusResultSchema,
} from '@ticketz/wa-contracts';

const buildExternalId = (candidate?: string | null): string => {
  if (candidate && candidate.trim().length > 0) {
    return candidate;
  }
  return `dryrun_${Date.now()}`;
};

const buildTimestamp = () => new Date().toISOString();

const normalizeSendResult = (payload: SendResult): SendResult => {
  return SendResultSchema.parse(payload);
};

export class DryRunTransport {
  readonly mode = 'dryrun' as const;

  async sendText(input: SendTextInput): Promise<SendResult> {
    return normalizeSendResult({
      externalId: buildExternalId(input.externalId),
      status: 'sent',
      timestamp: buildTimestamp(),
      raw: {
        dryrun: true,
        mode: 'dryrun',
        channel: 'whatsapp',
        type: 'text',
        to: input.to,
      },
      transport: 'dryrun',
    });
  }

  async sendMedia(input: SendMediaInput): Promise<SendResult> {
    return normalizeSendResult({
      externalId: buildExternalId(input.externalId),
      status: 'sent',
      timestamp: buildTimestamp(),
      raw: {
        dryrun: true,
        mode: 'dryrun',
        channel: 'whatsapp',
        type: 'media',
        to: input.to,
        mediaUrl: input.mediaUrl,
      },
      transport: 'dryrun',
    });
  }

  async checkRecipient(_input: { sessionId: string; instanceId?: string; to: string }): Promise<ExistsResult> {
    return ExistsResultSchema.parse({
      exists: true,
      canReceive: true,
      reason: null,
      raw: { dryrun: true },
    });
  }

  async getStatus(_input: { sessionId: string; instanceId?: string }): Promise<StatusResult> {
    return StatusResultSchema.parse({
      status: 'connected',
      connected: true,
      qr: null,
      qrCode: null,
      qrExpiresAt: null,
      expiresAt: null,
      stats: null,
      metrics: null,
      rate: null,
      rateUsage: null,
      messages: null,
      raw: { dryrun: true },
    });
  }
}
