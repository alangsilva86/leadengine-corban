import { z } from 'zod';

import type { components } from './types.gen.js';

type MessagePayloadContract = components['schemas']['MessagePayload'];
type SendMessageByTicketContract = components['schemas']['SendMessageByTicketRequest'];
type SendMessageByContactContract = components['schemas']['SendMessageByContactRequest'];
type SendMessageByInstanceContract = components['schemas']['SendMessageByInstanceRequest'];
type OutboundMessageResponseContract = components['schemas']['OutboundMessageResponse'];
type OutboundMessageErrorContract = components['schemas']['OutboundMessageError'];

const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;

const trimmedString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

const OptionalTrimmed = z
  .string()
  .transform((value) => value.trim())
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const MediaPayloadTypes = ['image', 'document', 'audio', 'video'] as const;

const MediaPayloadBaseSchema = z
  .object({
    text: OptionalTrimmed,
    caption: OptionalTrimmed,
    mediaUrl: z.string().url(),
    mimeType: OptionalTrimmed,
    fileName: OptionalTrimmed,
    previewUrl: z.boolean().optional(),
  })
  .strict();

const createMediaPayloadSchema = <TType extends z.ZodLiteral<
  (typeof MediaPayloadTypes)[number]
>>(
  typeLiteral: TType
) =>
  MediaPayloadBaseSchema.extend({
    type: typeLiteral,
  }).strict();

const ImageMessagePayloadSchema = createMediaPayloadSchema(z.literal('image'));
const DocumentMessagePayloadSchema = createMediaPayloadSchema(z.literal('document'));
const AudioMessagePayloadSchema = createMediaPayloadSchema(z.literal('audio'));
const VideoMessagePayloadSchema = createMediaPayloadSchema(z.literal('video'));

const TextMessagePayloadSchema = z
  .object({
    type: z.literal('text'),
    text: trimmedString,
    previewUrl: z.boolean().optional(),
  })
  .strict();

const PollOptionObjectSchema = z
  .object({
    id: z.string().optional(),
    pollId: z.string().optional(),
    optionId: z.string().optional(),
    key: z.string().optional(),
    value: z.string().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    optionName: z.string().optional(),
    label: z.string().optional(),
    displayName: z.string().optional(),
    index: z.number().int().nonnegative().optional(),
    position: z.number().int().nonnegative().optional(),
    votes: z.number().int().nonnegative().optional(),
    count: z.number().int().nonnegative().optional(),
  })
  .partial()
  .passthrough();

const PollOptionSchema = z.union([z.string(), PollOptionObjectSchema]);

const PollAggregatesSchema = z
  .object({
    totalVotes: z.number().int().nonnegative().optional(),
    totalVoters: z.number().int().nonnegative().optional(),
    optionTotals: z.record(z.number().int().nonnegative()).optional(),
  })
  .partial()
  .passthrough();

const PollVoteSchema = z
  .object({
    timestamp: z.string().optional(),
    selectedOptions: z.array(PollOptionSchema).optional(),
    optionIds: z.array(z.string()).optional(),
  })
  .partial()
  .passthrough();

const PollDescriptorSchema = z
  .object({
    id: z.string().optional(),
    pollId: z.string().optional(),
    question: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    updatedAt: z.string().optional(),
    timestamp: z.string().optional(),
    totalVotes: z.number().int().nonnegative().optional(),
    totalVoters: z.number().int().nonnegative().optional(),
    options: z.array(PollOptionSchema).optional(),
    selectedOptions: z.array(PollOptionSchema).optional(),
    aggregates: PollAggregatesSchema.optional(),
    optionTotals: z.record(z.number().int().nonnegative()).optional(),
  })
  .partial()
  .passthrough();

const PollChoiceMetadataSchema = z
  .object({
    id: z.string().optional(),
    pollId: z.string().optional(),
    vote: PollVoteSchema.optional(),
    options: z.array(PollOptionSchema).optional(),
  })
  .partial()
  .passthrough();

const InteractivePollMetadataSchema = z
  .object({
    poll: PollDescriptorSchema.optional(),
  })
  .partial()
  .passthrough();

export const PollMetadataSchema = z
  .object({
    origin: z.string().optional(),
    poll: PollDescriptorSchema.optional(),
    pollChoice: PollChoiceMetadataSchema.optional(),
    interactive: InteractivePollMetadataSchema.optional(),
  })
  .partial()
  .passthrough();

const LocationDescriptorSchema = z
  .object({
    latitude: z
      .number({ required_error: 'Informe a latitude.' })
      .min(-90, 'Latitude deve ser >= -90.')
      .max(90, 'Latitude deve ser <= 90.'),
    longitude: z
      .number({ required_error: 'Informe a longitude.' })
      .min(-180, 'Longitude deve ser >= -180.')
      .max(180, 'Longitude deve ser <= 180.'),
    name: OptionalTrimmed,
    address: OptionalTrimmed,
    url: z.string().url().optional(),
  })
  .strict();

const LocationMessagePayloadSchema = z
  .object({
    type: z.literal('location'),
    text: OptionalTrimmed,
    previewUrl: z.boolean().optional(),
    location: LocationDescriptorSchema,
  })
  .strict();

const EmailSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().email('Informe um e-mail válido.'));

const ContactEmailSchema = z
  .object({
    email: EmailSchema,
    type: OptionalTrimmed,
  })
  .strict();

const ContactPhoneSchema = z
  .object({
    phoneNumber: trimmedString,
    type: OptionalTrimmed,
    waId: OptionalTrimmed,
  })
  .strict();

const ContactDescriptorSchema = z
  .object({
    fullName: OptionalTrimmed,
    organization: OptionalTrimmed,
    emails: z.array(ContactEmailSchema).min(1).optional(),
    phones: z.array(ContactPhoneSchema).min(1).optional(),
    vcard: trimmedString.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasVcard = typeof value.vcard === 'string' && value.vcard.length > 0;
    const hasPhones = Array.isArray(value.phones) && value.phones.length > 0;
    const hasEmails = Array.isArray(value.emails) && value.emails.length > 0;
    const hasName = typeof value.fullName === 'string' && value.fullName.length > 0;

    if (!hasVcard && !hasPhones && !hasEmails && !hasName) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe ao menos vcard, phones, emails ou fullName do contato.',
        path: ['vcard'],
      });
    }
  });

const ContactMessagePayloadSchema = z
  .object({
    type: z.literal('contact'),
    text: OptionalTrimmed,
    previewUrl: z.boolean().optional(),
    contact: ContactDescriptorSchema,
  })
  .strict();

const TemplateLanguageSchema = z
  .object({
    code: trimmedString,
    policy: z.enum(['deterministic', 'fallback']).optional(),
  })
  .strict();

const TemplateTextParameterSchema = z
  .object({
    type: z.literal('text'),
    text: trimmedString,
  })
  .strict();

const TemplateCurrencyParameterSchema = z
  .object({
    type: z.literal('currency'),
    currency: z
      .object({
        amount1000: z.number().int(),
        currencyCode: trimmedString,
      })
      .strict(),
  })
  .strict();

const TemplateDateTimeParameterSchema = z
  .object({
    type: z.literal('date_time'),
    dateTime: z
      .object({
        fallbackValue: OptionalTrimmed,
        timestamp: z.number().int().optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (value.fallbackValue === undefined && value.timestamp === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Informe fallbackValue ou timestamp para parâmetros date_time.',
            path: ['fallbackValue'],
          });
        }
      }),
  })
  .strict();

const TemplateImageParameterSchema = z
  .object({
    type: z.literal('image'),
    image: z
      .object({
        link: z.string().url(),
      })
      .strict(),
  })
  .strict();

const TemplateDocumentParameterSchema = z
  .object({
    type: z.literal('document'),
    document: z
      .object({
        link: z.string().url(),
        filename: OptionalTrimmed,
      })
      .strict(),
  })
  .strict();

const TemplateVideoParameterSchema = z
  .object({
    type: z.literal('video'),
    video: z
      .object({
        link: z.string().url(),
      })
      .strict(),
  })
  .strict();

const TemplateParameterSchema = z.discriminatedUnion('type', [
  TemplateTextParameterSchema,
  TemplateCurrencyParameterSchema,
  TemplateDateTimeParameterSchema,
  TemplateImageParameterSchema,
  TemplateDocumentParameterSchema,
  TemplateVideoParameterSchema,
]);

const TemplateComponentSchema = z
  .object({
    type: z.enum(['header', 'body', 'footer', 'button']),
    subType: z.enum(['quick_reply', 'url', 'copy_code', 'phone_number']).optional(),
    index: OptionalTrimmed,
    parameters: z.array(TemplateParameterSchema).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'button' && !value.subType) {
      ctx.addIssue({
        code: 'custom',
        message: 'Componentes do tipo button exigem subType.',
        path: ['subType'],
      });
    }
    if (value.type !== 'button' && value.subType) {
      ctx.addIssue({
        code: 'custom',
        message: 'Somente componentes button aceitam subType.',
        path: ['subType'],
      });
    }
  });

const TemplateDescriptorSchema = z
  .object({
    namespace: trimmedString,
    name: trimmedString,
    language: TemplateLanguageSchema,
    components: z.array(TemplateComponentSchema).optional(),
  })
  .strict();

const TemplateMessagePayloadSchema = z
  .object({
    type: z.literal('template'),
    text: OptionalTrimmed,
    previewUrl: z.boolean().optional(),
    template: TemplateDescriptorSchema,
  })
  .strict();

const PollDefinitionSchema = z
  .object({
    question: trimmedString,
    options: z.array(trimmedString).min(2),
    allowMultipleAnswers: z.boolean().optional(),
  })
  .strict();

const PollMessagePayloadSchema = z
  .object({
    type: z.literal('poll'),
    poll: PollDefinitionSchema,
  })
  .strict();

const RawMessagePayloadSchema = z.discriminatedUnion('type', [
  TextMessagePayloadSchema,
  ImageMessagePayloadSchema,
  DocumentMessagePayloadSchema,
  AudioMessagePayloadSchema,
  VideoMessagePayloadSchema,
  LocationMessagePayloadSchema,
  ContactMessagePayloadSchema,
  TemplateMessagePayloadSchema,
  PollMessagePayloadSchema,
]);

export const MessagePayloadSchema = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !('type' in raw)) {
    return { type: 'text', ...(raw as Record<string, unknown>) };
  }
  return raw;
}, RawMessagePayloadSchema);

export type MessagePayloadInput = z.infer<typeof RawMessagePayloadSchema>;

type LocationPayload = z.infer<typeof LocationDescriptorSchema>;
type ContactPayload = z.infer<typeof ContactDescriptorSchema>;
type TemplatePayload = z.infer<typeof TemplateDescriptorSchema>;
type PollPayload = z.infer<typeof PollDefinitionSchema>;

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

    if (digits.length > PHONE_MAX_DIGITS) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe um telefone válido (máximo 15 dígitos).',
      });
    }
  });

export const SendByTicketSchema = z.object({
  instanceId: OptionalTrimmed,
  payload: MessagePayloadSchema,
  idempotencyKey: trimmedString,
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
  idempotencyKey: trimmedString,
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
  location?: LocationPayload;
  contact?: ContactPayload;
  template?: TemplatePayload;
  poll?: PollPayload;
}

export const normalizePayload = (input: MessagePayloadInput): NormalizedMessagePayload => {
  switch (input.type) {
    case 'text':
      return {
        type: input.type,
        content: input.text,
        previewUrl: input.previewUrl,
      } satisfies NormalizedMessagePayload;
    case 'image':
    case 'audio':
    case 'video':
    case 'document': {
      const content = input.text ?? input.caption ?? '';
      return {
        type: input.type,
        content,
        caption: input.caption,
        mediaUrl: input.mediaUrl,
        mediaMimeType: input.mimeType,
        mediaFileName: input.fileName,
        previewUrl: input.previewUrl,
      } satisfies NormalizedMessagePayload;
    }
    case 'location': {
      const content =
        input.text ?? input.location.name ?? input.location.address ?? '';
      return {
        type: input.type,
        content,
        previewUrl: input.previewUrl,
        location: input.location,
      } satisfies NormalizedMessagePayload;
    }
    case 'contact': {
      const fallbackContent =
        input.text ??
        input.contact.fullName ??
        input.contact.vcard ??
        '';
      return {
        type: input.type,
        content: fallbackContent,
        previewUrl: input.previewUrl,
        contact: input.contact,
      } satisfies NormalizedMessagePayload;
    }
    case 'template': {
      const content = input.text ?? input.template.name ?? '';
      return {
        type: input.type,
        content,
        previewUrl: input.previewUrl,
        template: input.template,
      } satisfies NormalizedMessagePayload;
    }
    case 'poll': {
      return {
        type: input.type,
        content: input.poll.question,
        poll: input.poll,
      } satisfies NormalizedMessagePayload;
    }
    default: {
      const exhaustiveCheck: never = input;
      return exhaustiveCheck;
    }
  }
};

export type SendMessageByTicketRequest = SendMessageByTicketContract;
export type SendMessageByContactRequest = SendMessageByContactContract;
export type SendMessageByInstanceRequest = SendMessageByInstanceContract;
export type OutboundMessageResponse = OutboundMessageResponseContract;
export type OutboundMessageError = OutboundMessageErrorContract;

type EnsureExact<TExpected, TActual extends TExpected> =
  TExpected extends TActual ? true : never;

export type _EnsureMessagePayload = EnsureExact<MessagePayloadContract, MessagePayloadInput>;
export type _EnsureSendByTicket = EnsureExact<SendMessageByTicketContract, SendByTicketInput>;
export type _EnsureSendByContact = EnsureExact<SendMessageByContactContract, SendByContactInput>;
export type _EnsureSendByInstance = EnsureExact<SendMessageByInstanceContract, SendByInstanceInput>;
