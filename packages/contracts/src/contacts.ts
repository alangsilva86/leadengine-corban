import { z } from 'zod';

const ContactStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
const ContactTaskStatusSchema = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);
const ContactInteractionChannelSchema = z.enum(['WHATSAPP', 'EMAIL', 'PHONE', 'WEB', 'OTHER']);
const ContactInteractionDirectionSchema = z.enum(['INBOUND', 'OUTBOUND']);

const ISODateSchema = z.string().min(1);

const ContactSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  document: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  status: ContactStatusSchema,
  isBlocked: z.boolean(),
  tags: z.array(z.string()),
  customFields: z.record(z.unknown()),
  lastInteractionAt: ISODateSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
});

const ContactInteractionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  contactId: z.string().uuid(),
  channel: ContactInteractionChannelSchema,
  direction: ContactInteractionDirectionSchema,
  summary: z.string(),
  payload: z.record(z.unknown()),
  occurredAt: ISODateSchema,
  createdAt: ISODateSchema,
});

const ContactTaskSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  contactId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  dueAt: ISODateSchema.nullable().optional(),
  status: ContactTaskStatusSchema,
  assigneeId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()),
  completedAt: ISODateSchema.nullable().optional(),
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
});

const ContactDetailsSchema = ContactSchema.extend({
  openTickets: z.number().int().nonnegative().default(0),
  interactions: z.array(ContactInteractionSchema).optional(),
  tasks: z.array(ContactTaskSchema).optional(),
});

const ContactListItemSchema = ContactSchema.extend({
  openTickets: z.number().int().nonnegative().default(0),
  pendingTasks: z.number().int().nonnegative().default(0),
});

const PaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  });

const ContactTagsAggregationSchema = z.object({
  tag: z.string(),
  count: z.number().int().nonnegative(),
});

const successEnvelope = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    success: z.literal(true),
    data: schema,
  });

export const ContactListResponseSchema = successEnvelope(PaginatedSchema(ContactListItemSchema));
export const ContactDetailsResponseSchema = successEnvelope(ContactDetailsSchema);
export const ContactTagsResponseSchema = successEnvelope(z.array(ContactTagsAggregationSchema));
export const ContactInteractionsResponseSchema = successEnvelope(PaginatedSchema(ContactInteractionSchema));
export const ContactTasksResponseSchema = successEnvelope(PaginatedSchema(ContactTaskSchema));
export const ContactCreatedResponseSchema = successEnvelope(ContactDetailsSchema);
export const ContactTaskUpdatedResponseSchema = successEnvelope(ContactTaskSchema);

export type ContactListResponse = z.infer<typeof ContactListResponseSchema>;
export type ContactDetailsResponse = z.infer<typeof ContactDetailsResponseSchema>;
export type ContactTagsResponse = z.infer<typeof ContactTagsResponseSchema>;
export type ContactInteractionsResponse = z.infer<typeof ContactInteractionsResponseSchema>;
export type ContactTasksResponse = z.infer<typeof ContactTasksResponseSchema>;
export type ContactCreatedResponse = z.infer<typeof ContactCreatedResponseSchema>;
export type ContactTaskUpdatedResponse = z.infer<typeof ContactTaskUpdatedResponseSchema>;
