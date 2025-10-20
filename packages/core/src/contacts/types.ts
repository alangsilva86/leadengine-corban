import { z } from 'zod';

import {
  BaseEntitySchema,
  EmailSchema,
  EntityIdSchema,
  PaginationSchema,
  PhoneNumberSchema,
  TenantIdSchema,
  TimestampSchema,
} from '../common/types';

export const ContactStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type ContactStatus = z.infer<typeof ContactStatusSchema>;

export const ContactTaskStatusSchema = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);
export type ContactTaskStatus = z.infer<typeof ContactTaskStatusSchema>;

export const ContactInteractionChannelSchema = z.enum([
  'WHATSAPP',
  'EMAIL',
  'PHONE',
  'WEB',
  'OTHER',
]);
export type ContactInteractionChannel = z.infer<typeof ContactInteractionChannelSchema>;

export const ContactInteractionDirectionSchema = z.enum(['INBOUND', 'OUTBOUND']);
export type ContactInteractionDirection = z.infer<typeof ContactInteractionDirectionSchema>;

export const ContactSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(200),
  phone: PhoneNumberSchema.optional(),
  email: EmailSchema.optional(),
  document: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
  status: ContactStatusSchema.default('ACTIVE'),
  isBlocked: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  lastInteractionAt: TimestampSchema.optional(),
  notes: z.string().max(5000).optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const CreateContactPayloadSchema = z.object({
  name: z.string().min(1).max(200),
  phone: PhoneNumberSchema.optional(),
  email: EmailSchema.optional(),
  document: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
  status: ContactStatusSchema.optional(),
  isBlocked: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  lastInteractionAt: TimestampSchema.optional(),
  notes: z.string().max(5000).optional(),
});
export type CreateContactPayload = z.infer<typeof CreateContactPayloadSchema>;

export const CreateContactDTOSchema = CreateContactPayloadSchema.extend({
  tenantId: TenantIdSchema,
}).transform(({ tenantId, ...payload }) => ({ tenantId, payload }));
export type CreateContactDTO = z.infer<typeof CreateContactDTOSchema>;

export const UpdateContactPayloadSchema = CreateContactPayloadSchema.partial();
export type UpdateContactPayload = z.infer<typeof UpdateContactPayloadSchema>;

export const UpdateContactDTOSchema = z.object({
  tenantId: TenantIdSchema,
  contactId: EntityIdSchema,
  payload: UpdateContactPayloadSchema,
});
export type UpdateContactDTO = z.infer<typeof UpdateContactDTOSchema>;

export const ContactFiltersSchema = z
  .object({
    search: z.string().max(200).optional(),
    status: z.array(ContactStatusSchema).optional(),
    tags: z.array(z.string()).optional(),
    lastInteractionFrom: TimestampSchema.optional(),
    lastInteractionTo: TimestampSchema.optional(),
    hasOpenTickets: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    hasWhatsapp: z.boolean().optional(),
  })
  .partial();
export type ContactFilters = z.infer<typeof ContactFiltersSchema>;

export const ListContactsQuerySchema = PaginationSchema.extend({
  filters: ContactFiltersSchema.optional(),
});
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;

export const ContactInteractionSchema = z.object({
  id: EntityIdSchema,
  tenantId: TenantIdSchema,
  contactId: EntityIdSchema,
  channel: ContactInteractionChannelSchema,
  direction: ContactInteractionDirectionSchema,
  summary: z.string().max(500),
  payload: z.record(z.unknown()).default({}),
  occurredAt: TimestampSchema,
  createdAt: TimestampSchema,
});
export type ContactInteraction = z.infer<typeof ContactInteractionSchema>;

export const CreateContactInteractionPayloadSchema = z.object({
  channel: ContactInteractionChannelSchema,
  direction: ContactInteractionDirectionSchema.default('INBOUND'),
  summary: z.string().min(1).max(500),
  payload: z.record(z.unknown()).optional(),
  occurredAt: TimestampSchema.optional(),
});
export type CreateContactInteractionPayload = z.infer<typeof CreateContactInteractionPayloadSchema>;

export const CreateContactInteractionDTOSchema = z.object({
  tenantId: TenantIdSchema,
  contactId: EntityIdSchema,
  payload: CreateContactInteractionPayloadSchema,
});
export type CreateContactInteractionDTO = z.infer<typeof CreateContactInteractionDTOSchema>;

export const ContactTaskSchema = z.object({
  id: EntityIdSchema,
  tenantId: TenantIdSchema,
  contactId: EntityIdSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueAt: TimestampSchema.optional(),
  status: ContactTaskStatusSchema.default('PENDING'),
  assigneeId: EntityIdSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
  completedAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type ContactTask = z.infer<typeof ContactTaskSchema>;

export const CreateContactTaskPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueAt: TimestampSchema.optional(),
  assigneeId: EntityIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateContactTaskPayload = z.infer<typeof CreateContactTaskPayloadSchema>;

export const CreateContactTaskDTOSchema = z.object({
  tenantId: TenantIdSchema,
  contactId: EntityIdSchema,
  payload: CreateContactTaskPayloadSchema,
});
export type CreateContactTaskDTO = z.infer<typeof CreateContactTaskDTOSchema>;

export const UpdateContactTaskPayloadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  dueAt: TimestampSchema.optional(),
  status: ContactTaskStatusSchema.optional(),
  assigneeId: EntityIdSchema.optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  completedAt: TimestampSchema.optional().nullable(),
});
export type UpdateContactTaskPayload = z.infer<typeof UpdateContactTaskPayloadSchema>;

export const UpdateContactTaskDTOSchema = z.object({
  tenantId: TenantIdSchema,
  taskId: EntityIdSchema,
  payload: UpdateContactTaskPayloadSchema,
});
export type UpdateContactTaskDTO = z.infer<typeof UpdateContactTaskDTOSchema>;

export const MergeContactsDTOSchema = z.object({
  tenantId: TenantIdSchema,
  targetId: EntityIdSchema,
  sourceIds: z.array(EntityIdSchema).min(1),
  preserve: z
    .object({
      tags: z.boolean().optional(),
      customFields: z.boolean().optional(),
      notes: z.boolean().optional(),
    })
    .default({}),
});
export type MergeContactsDTO = z.infer<typeof MergeContactsDTOSchema>;

export const BulkContactsActionSchema = z.object({
  tenantId: TenantIdSchema,
  contactIds: z.array(EntityIdSchema).min(1),
  status: ContactStatusSchema.optional(),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  block: z.boolean().optional(),
});
export type BulkContactsAction = z.infer<typeof BulkContactsActionSchema>;

export const WhatsappActionPayloadSchema = z.object({
  contactIds: z.array(EntityIdSchema).min(1),
  template: z
    .object({
      name: z.string().min(1),
      language: z.string().min(2).max(5),
      components: z.array(z.record(z.unknown())).default([]),
    })
    .optional(),
  message: z
    .object({
      type: z.enum(['text', 'media']),
      text: z.string().max(1000).optional(),
      mediaUrl: z.string().url().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type WhatsappActionPayload = z.infer<typeof WhatsappActionPayloadSchema>;

export const WhatsappActionDTOSchema = z.object({
  tenantId: TenantIdSchema,
  operatorId: EntityIdSchema.optional(),
  payload: WhatsappActionPayloadSchema,
});
export type WhatsappActionDTO = z.infer<typeof WhatsappActionDTOSchema>;

export const ListContactInteractionsQuerySchema = PaginationSchema.extend({
  contactId: EntityIdSchema,
});
export type ListContactInteractionsQuery = z.infer<typeof ListContactInteractionsQuerySchema>;

export const ListContactTasksQuerySchema = PaginationSchema.extend({
  contactId: EntityIdSchema,
  status: z.array(ContactTaskStatusSchema).optional(),
});
export type ListContactTasksQuery = z.infer<typeof ListContactTasksQuerySchema>;

export const ContactTagsAggregationSchema = z.object({
  tag: z.string(),
  count: z.number().int().nonnegative(),
});
export type ContactTagAggregation = z.infer<typeof ContactTagsAggregationSchema>;

export const ContactListItemSchema = ContactSchema.extend({
  openTickets: z.number().int().nonnegative().default(0),
  pendingTasks: z.number().int().nonnegative().default(0),
});
export type ContactListItem = z.infer<typeof ContactListItemSchema>;

export const ContactsPaginatedResultSchema = z.object({
  items: z.array(ContactListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});
export type ContactsPaginatedResult = z.infer<typeof ContactsPaginatedResultSchema>;

export const ContactDetailsSchema = ContactSchema.extend({
  interactions: z.array(ContactInteractionSchema).optional(),
  tasks: z.array(ContactTaskSchema).optional(),
  openTickets: z.number().int().nonnegative().default(0),
});
export type ContactDetails = z.infer<typeof ContactDetailsSchema>;
