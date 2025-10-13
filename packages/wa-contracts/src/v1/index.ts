import { z } from 'zod';

const metadataSchema = z.record(z.unknown());

const baseSessionSchema = z.object({
  sessionId: z.string().min(1),
  instanceId: z.string().min(1).optional(),
  to: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
  metadata: metadataSchema.optional(),
  externalId: z.string().min(1).optional()
});

export const SendTextInputSchema = baseSessionSchema.extend({
  message: z.string().min(1),
  previewUrl: z.boolean().optional()
});

export type SendTextInput = z.infer<typeof SendTextInputSchema>;

export const SendMediaInputSchema = baseSessionSchema.extend({
  mediaUrl: z.string().min(1),
  mediaMimeType: z.string().min(1).optional(),
  mediaFileName: z.string().min(1).optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
  caption: z.string().optional()
});

export type SendMediaInput = z.infer<typeof SendMediaInputSchema>;

export const SendResultSchema = z.object({
  externalId: z.string().min(1),
  status: z.string().min(1),
  timestamp: z.string().optional().nullable(),
  raw: metadataSchema.nullish(),
  transport: z.enum(['http', 'sidecar', 'dryrun']).optional()
});

export type SendResult = z.infer<typeof SendResultSchema>;

export const ExistsResultSchema = z.object({
  exists: z.boolean(),
  canReceive: z.boolean(),
  reason: z.string().nullable().optional(),
  raw: metadataSchema.nullish()
});

export type ExistsResult = z.infer<typeof ExistsResultSchema>;

export const StatusResultSchema = z.object({
  status: z.enum(['connected', 'connecting', 'disconnected', 'qr_required', 'pending', 'failed']),
  connected: z.boolean(),
  qr: z.string().nullable().optional(),
  qrCode: z.string().nullable().optional(),
  qrExpiresAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  stats: metadataSchema.nullish(),
  metrics: metadataSchema.nullish(),
  rate: metadataSchema.nullish(),
  rateUsage: metadataSchema.nullish(),
  messages: metadataSchema.nullish(),
  raw: metadataSchema.nullish()
});

export type StatusResult = z.infer<typeof StatusResultSchema>;

export const WhatsAppCanonicalErrorCodeSchema = z.enum([
  'INSTANCE_NOT_CONNECTED',
  'INVALID_TO',
  'RATE_LIMITED',
  'BROKER_TIMEOUT',
  'UNSUPPORTED_OPERATION',
  'TRANSPORT_NOT_CONFIGURED',
  'UNKNOWN_ERROR'
]);

export type WhatsAppCanonicalErrorCode = z.infer<typeof WhatsAppCanonicalErrorCodeSchema>;

export const WhatsAppCanonicalErrorSchema = z.object({
  code: WhatsAppCanonicalErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean().optional()
});

export type WhatsAppCanonicalError = z.infer<typeof WhatsAppCanonicalErrorSchema>;

export const CANONICAL_ERRORS: Record<WhatsAppCanonicalErrorCode, WhatsAppCanonicalError> = {
  INSTANCE_NOT_CONNECTED: {
    code: 'INSTANCE_NOT_CONNECTED',
    message: 'Instância de WhatsApp desconectada. Reabra a sessão para continuar.',
    retryable: true
  },
  INVALID_TO: {
    code: 'INVALID_TO',
    message: 'Número de destino inválido ou indisponível para receber mensagens.',
    retryable: false
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Limite de envio do WhatsApp atingido. Aguarde alguns instantes e tente novamente.',
    retryable: true
  },
  BROKER_TIMEOUT: {
    code: 'BROKER_TIMEOUT',
    message: 'Tempo limite ao contatar o transporte do WhatsApp. Tente reenviar em instantes.',
    retryable: true
  },
  UNSUPPORTED_OPERATION: {
    code: 'UNSUPPORTED_OPERATION',
    message: 'Operação não suportada pelo transporte WhatsApp ativo.',
    retryable: false
  },
  TRANSPORT_NOT_CONFIGURED: {
    code: 'TRANSPORT_NOT_CONFIGURED',
    message: 'Transporte WhatsApp não configurado para esta operação.',
    retryable: false
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: 'Falha inesperada ao interagir com o transporte WhatsApp.',
    retryable: true
  }
};

export const resolveCanonicalError = (
  code: WhatsAppCanonicalErrorCode | string | null | undefined
): WhatsAppCanonicalError | null => {
  if (!code) {
    return null;
  }

  const normalized = code.toUpperCase() as WhatsAppCanonicalErrorCode;
  return CANONICAL_ERRORS[normalized] ?? null;
};

export type WhatsAppTransportErrorOptions = {
  code?: string;
  status?: number;
  requestId?: string;
  transport?: 'http' | 'sidecar' | 'dryrun';
  canonical?: WhatsAppCanonicalError | null;
  details?: Record<string, unknown> | null;
  cause?: unknown;
};

export class WhatsAppTransportError extends Error {
  public readonly code: string;
  public readonly status: number | undefined;
  public readonly requestId: string | undefined;
  public readonly transport: 'http' | 'sidecar' | 'dryrun' | undefined;
  public readonly canonical: WhatsAppCanonicalError | null;
  public readonly details?: Record<string, unknown> | null;

  constructor(message: string, options: WhatsAppTransportErrorOptions = {}) {
    super(message);
    this.name = 'WhatsAppTransportError';
    this.code = options.code ?? 'UNKNOWN_ERROR';
    this.status = options.status;
    this.requestId = options.requestId;
    this.transport = options.transport;
    this.details = options.details ?? null;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }

    this.canonical = options.canonical ?? resolveCanonicalError(this.code);
  }
}

export const v1 = {
  SendTextInputSchema,
  SendMediaInputSchema,
  SendResultSchema,
  ExistsResultSchema,
  StatusResultSchema,
  WhatsAppCanonicalErrorCodeSchema,
  WhatsAppCanonicalErrorSchema,
  CANONICAL_ERRORS,
  resolveCanonicalError,
  WhatsAppTransportError
};

export type {
  SendTextInput as SendTextInputV1,
  SendMediaInput as SendMediaInputV1,
  SendResult as SendResultV1,
  ExistsResult as ExistsResultV1,
  StatusResult as StatusResultV1,
  WhatsAppCanonicalError as WhatsAppCanonicalErrorV1,
  WhatsAppCanonicalErrorCode as WhatsAppCanonicalErrorCodeV1
};
