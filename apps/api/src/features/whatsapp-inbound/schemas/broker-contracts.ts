import { z } from 'zod';

const trimmedString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

const nullableTrimmedString = z
  .string()
  .transform((value) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .nullable();

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1))
  .optional();

const directionInput = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(['inbound', 'outbound']))
  .optional();

const timestampInput = z
  .union([
    z.string().transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
    z.number().transform((value) => (Number.isFinite(value) ? value : null)),
    z.null(),
  ])
  .optional();

const normalizeTimestamp = (value: string | number | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  const numeric = Number(value);
  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  try {
    return new Date(ms).toISOString();
  } catch (error) {
    return null;
  }
};

const safeRecord = z.record(z.unknown()).catch(() => ({} as Record<string, unknown>));

export const BrokerInboundContactSchema = z
  .object({
    phone: nullableTrimmedString.optional(),
    name: nullableTrimmedString.optional(),
    document: nullableTrimmedString.optional(),
    registrations: z
      .array(z.string().transform((value) => value.trim()).pipe(z.string().min(1)))
      .nonempty()
      .optional()
      .nullable(),
    avatarUrl: nullableTrimmedString.optional(),
    pushName: nullableTrimmedString.optional(),
  })
  .catch(() => ({}) as Record<string, unknown>)
  .transform((contact) => {
    const { registrations, ...rest } = contact;
    return {
      ...rest,
      registrations: registrations ?? null,
    };
  });

export type BrokerInboundContact = z.infer<typeof BrokerInboundContactSchema>;

export const BrokerInboundMessageSchema = safeRecord;
export type BrokerInboundMessage = z.infer<typeof BrokerInboundMessageSchema>;

export const BrokerInboundMetadataSchema = safeRecord;
export type BrokerInboundMetadata = z.infer<typeof BrokerInboundMetadataSchema>;

export const BrokerInboundEventPayloadSchema = z
  .object({
    instanceId: trimmedString,
    timestamp: timestampInput,
    direction: directionInput,
    contact: BrokerInboundContactSchema.default({}) as unknown as z.ZodType<BrokerInboundContact>,
    message: BrokerInboundMessageSchema.default({}) as unknown as z.ZodType<BrokerInboundMessage>,
    metadata: BrokerInboundMetadataSchema.default({}) as unknown as z.ZodType<BrokerInboundMetadata>,
  })
  .transform((payload) => {
    const normalizedTimestamp = normalizeTimestamp(payload.timestamp);
    const normalizedDirection =
      payload.direction === 'outbound'
        ? 'OUTBOUND'
        : payload.direction === 'inbound'
        ? 'INBOUND'
        : 'INBOUND';

    return {
      instanceId: payload.instanceId,
      timestamp: normalizedTimestamp,
      direction: normalizedDirection,
      contact: payload.contact,
      message: payload.message,
      metadata: payload.metadata,
    };
  });

export type BrokerInboundEventPayload = z.infer<typeof BrokerInboundEventPayloadSchema>;

export const BrokerInboundEventSchema = z
  .object({
    id: trimmedString,
    type: z.enum(['MESSAGE_INBOUND', 'MESSAGE_OUTBOUND']),
    tenantId: nullableTrimmedString.optional(),
    sessionId: nullableTrimmedString.optional(),
    instanceId: trimmedString,
    timestamp: timestampInput,
    cursor: timestampInput.nullable().optional(),
    payload: BrokerInboundEventPayloadSchema,
  })
  .transform((event) => {
    const timestamp = normalizeTimestamp(event.timestamp) ?? event.payload.timestamp;
    const type = event.type === 'MESSAGE_OUTBOUND' ? 'MESSAGE_OUTBOUND' : 'MESSAGE_INBOUND';
    const direction =
      event.payload.direction ??
      (type === 'MESSAGE_OUTBOUND' ? 'OUTBOUND' : 'INBOUND');
    const cursor = normalizeTimestamp(event.cursor) ?? null;

    return {
      id: event.id,
      type,
      tenantId: event.tenantId ?? undefined,
      sessionId: event.sessionId ?? undefined,
      instanceId: event.instanceId,
      timestamp,
      cursor,
      payload: {
        ...event.payload,
        direction,
        timestamp,
      },
    };
  });

export type BrokerInboundEvent = z.infer<typeof BrokerInboundEventSchema>;

const outboundMessageTypes = [
  'text',
  'image',
  'video',
  'document',
  'audio',
  'location',
  'template',
  'contact',
  'poll',
] as const;

const OutboundContactEmailSchema = z
  .object({
    email: trimmedString,
    type: optionalTrimmedString,
  })
  .strict();

const OutboundContactPhoneSchema = z
  .object({
    phoneNumber: trimmedString,
    type: optionalTrimmedString,
    waId: optionalTrimmedString,
  })
  .strict();

const OutboundContactSchema = z
  .object({
    fullName: optionalTrimmedString,
    organization: optionalTrimmedString,
    emails: z.array(OutboundContactEmailSchema).min(1).optional(),
    phones: z.array(OutboundContactPhoneSchema).min(1).optional(),
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
        message: 'Contato deve informar vcard, phones, emails ou fullName.',
        path: ['vcard'],
      });
    }
  });

const OutboundPollSchema = z
  .object({
    question: trimmedString,
    options: z.array(trimmedString).min(2),
    allowMultipleAnswers: z.boolean().optional(),
  })
  .strict();
const outboundMessageTypes = ['text', 'image', 'video', 'document', 'audio', 'location', 'template', 'contact'] as const;

export const BrokerOutboundMessageSchema = z
  .object({
    sessionId: trimmedString,
    instanceId: trimmedString.optional(),
    to: trimmedString,
    type: z
      .string()
      .transform((value) => value.trim().toLowerCase())
      .pipe(z.enum(outboundMessageTypes))
      .default('text'),
    content: z.string().default(''),
    externalId: nullableTrimmedString.optional(),
    previewUrl: z.boolean().optional(),
    media: z
      .object({
        url: z.string().url(),
        mimetype: trimmedString.optional(),
        filename: trimmedString.optional(),
        size: z.number().int().positive().optional(),
      })
      .optional(),
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        name: nullableTrimmedString.optional(),
        address: nullableTrimmedString.optional(),
      })
      .optional(),
    contacts: z.array(safeRecord).optional(),
    template: z
      .object({
        name: trimmedString,
        namespace: trimmedString.optional(),
        language: trimmedString.optional(),
        components: z.array(safeRecord).optional(),
      })
      .optional(),
    contact: OutboundContactSchema.optional(),
    poll: OutboundPollSchema.optional(),
    metadata: safeRecord.optional(),
  })
  .superRefine((value, ctx) => {
    const normalizedContent = typeof value.content === 'string' ? value.content.trim() : '';

    if (value.type === 'text' && normalizedContent.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Texto é obrigatório para mensagens do tipo text.',
        path: ['content'],
      });
    }

    const mediaTypes = new Set(['image', 'video', 'document', 'audio']);

    if (mediaTypes.has(value.type) && !value.media) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mensagens de mídia exigem media payload.',
        path: ['media'],
      });
    }

    if (value.type === 'contact') {
      if (!value.contacts || value.contacts.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Contact messages require contacts payload.',
          path: ['contacts'],
        });
      }
    }

    if (value.type !== 'text' && !value.media && !value.template && !value.location && !value.contacts) {
      ctx.addIssue({
        code: 'custom',
        message: 'Non-text messages require media, template, location, or contacts payload',
        path: ['type'],
      });
    }

    if (value.type === 'location' && !value.location) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mensagens de localização exigem location payload.',
        path: ['location'],
      });
    }

    if (value.type === 'template' && !value.template) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mensagens template exigem template payload.',
        path: ['template'],
      });
    }

    if (value.type === 'contact' && !value.contact) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mensagens de contato exigem contact payload.',
        path: ['contact'],
      });
    }

    if (value.type === 'poll' && !value.poll) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mensagens de enquete exigem poll payload.',
        path: ['poll'],
      });
    }
  })
  .transform((value) => ({
    ...value,
    content: typeof value.content === 'string' ? value.content.trim() : '',
  }));

export type BrokerOutboundMessage = z.infer<typeof BrokerOutboundMessageSchema>;

export const BrokerOutboundResponseSchema = z
  .object({
    externalId: nullableTrimmedString.optional(),
    id: nullableTrimmedString.optional(),
    status: nullableTrimmedString.optional(),
    timestamp: nullableTrimmedString.optional(),
    raw: safeRecord.optional(),
  })
  .transform((result) => {
    const externalId = result.externalId ?? result.id ?? null;
    const status = result.status ?? 'sent';
    return {
      externalId,
      status,
      timestamp: result.timestamp ?? null,
      raw: result.raw ?? null,
    };
  });

export type BrokerOutboundResponse = z.infer<typeof BrokerOutboundResponseSchema>;

export const BrokerWebhookInboundSchema = z
  .object({
    event: z.literal('message'),
    direction: directionInput.default('inbound'),
    instanceId: trimmedString,
    timestamp: timestampInput,
    message: BrokerInboundMessageSchema,
    from: BrokerInboundContactSchema,
    metadata: BrokerInboundMetadataSchema.default({}),
  })
  .transform((entry) => ({
    instanceId: entry.instanceId,
    timestamp: normalizeTimestamp(entry.timestamp),
    message: entry.message,
    from: entry.from,
    metadata: entry.metadata,
    direction: entry.direction === 'outbound' ? 'outbound' : 'inbound',
  }));

export type BrokerWebhookInbound = z.infer<typeof BrokerWebhookInboundSchema>;
