import { z } from 'zod';

const PHONE_MIN_DIGITS = 8;

const trimmedString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

const OptionalTrimmed = z
  .string()
  .transform((value) => value.trim())
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const PayloadTypeSchema = z.enum(['text', 'image', 'document', 'audio', 'video']);

export const MessagePayloadSchema = z
  .object({
    type: PayloadTypeSchema.default('text'),
    text: OptionalTrimmed,
    mediaUrl: z.string().url().optional(),
    caption: OptionalTrimmed,
    mimeType: OptionalTrimmed,
    fileName: OptionalTrimmed,
    previewUrl: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const text = value.text ?? '';
    const hasText = text.length > 0;
    const hasMedia = typeof value.mediaUrl === 'string' && value.mediaUrl.length > 0;

    if (value.type === 'text' && !hasText) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe o campo text para mensagens do tipo text.',
        path: ['text'],
      });
    }

    if (value.type !== 'text' && !hasMedia) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mensagens de mídia exigem mediaUrl válido.',
        path: ['mediaUrl'],
      });
    }
  });

export type MessagePayloadInput = z.infer<typeof MessagePayloadSchema>;

const PhoneSchema = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    const digits = value.replace(/\D+/g, '');
    if (digits.length < PHONE_MIN_DIGITS) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe um telefone válido (mínimo 8 dígitos).',
      });
    }
  });

export const SendByTicketSchema = z.object({
  instanceId: OptionalTrimmed,
  payload: MessagePayloadSchema,
  idempotencyKey: OptionalTrimmed,
});

export type SendByTicketInput = z.infer<typeof SendByTicketSchema>;

export const SendByContactSchema = z.object({
  to: PhoneSchema,
  instanceId: OptionalTrimmed,
  payload: MessagePayloadSchema,
  idempotencyKey: OptionalTrimmed,
});

export type SendByContactInput = z.infer<typeof SendByContactSchema>;

export const SendByInstanceSchema = z.object({
  to: PhoneSchema,
  payload: MessagePayloadSchema,
  idempotencyKey: OptionalTrimmed,
});

export type SendByInstanceInput = z.infer<typeof SendByInstanceSchema>;

export interface NormalizedMessagePayload {
  type: MessagePayloadInput['type'];
  content: string;
  caption?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  previewUrl?: boolean;
}

export const normalizePayload = (input: MessagePayloadInput): NormalizedMessagePayload => {
  const text = input.text ?? '';
  const content = input.type === 'text' ? text : text || input.caption || '';

  return {
    type: input.type,
    content,
    caption: input.caption,
    mediaUrl: input.mediaUrl,
    mediaMimeType: input.mimeType,
    mediaFileName: input.fileName,
    previewUrl: input.previewUrl,
  } satisfies NormalizedMessagePayload;
};
