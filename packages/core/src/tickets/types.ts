import { z } from 'zod';
import {
  BaseEntitySchema,
  EntityIdSchema,
  TenantIdSchema,
  TimestampSchema,
  ChannelTypeSchema,
  MessageTypeSchema,
  MessageDirectionSchema,
  PhoneNumberSchema,
  EmailSchema,
} from '../common/types';

// ============================================================================
// Ticket Status
// ============================================================================

export const TicketStatusSchema = z.enum([
  'OPEN',      // Ticket aberto, aguardando atendimento
  'PENDING',   // Aguardando resposta do cliente
  'ASSIGNED',  // Atribuído a um agente
  'RESOLVED',  // Resolvido, aguardando confirmação
  'CLOSED',    // Fechado definitivamente
]);

export type TicketStatus = z.infer<typeof TicketStatusSchema>;

// ============================================================================
// Ticket Priority
// ============================================================================

export const TicketPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

// ============================================================================
// Queue
// ============================================================================

export const QueueSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  isActive: z.boolean().default(true),
  orderIndex: z.number().int().nonnegative().default(0),
  settings: z.record(z.unknown()).default({}),
});

export type Queue = z.infer<typeof QueueSchema>;

// ============================================================================
// Ticket
// ============================================================================

export const TicketSchema = BaseEntitySchema.extend({
  contactId: EntityIdSchema,
  queueId: EntityIdSchema,
  userId: EntityIdSchema.optional(), // Agente responsável
  status: TicketStatusSchema.default('OPEN'),
  priority: TicketPrioritySchema.default('NORMAL'),
  subject: z.string().max(200).optional(),
  channel: ChannelTypeSchema,
  lastMessageAt: TimestampSchema.optional(),
  lastMessagePreview: z.string().max(500).optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  closedAt: TimestampSchema.optional(),
  closedBy: EntityIdSchema.optional(),
  closeReason: z.string().max(500).optional(),
});

export type Ticket = z.infer<typeof TicketSchema>;

// ============================================================================
// Message
// ============================================================================

export const MessageStatusSchema = z.enum([
  'PENDING',   // Aguardando envio
  'SENT',      // Enviado
  'DELIVERED', // Entregue
  'READ',      // Lido
  'FAILED',    // Falha no envio
]);

export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageSchema = BaseEntitySchema.extend({
  ticketId: EntityIdSchema,
  contactId: EntityIdSchema,
  userId: EntityIdSchema.optional(), // Agente que enviou (se outbound)
  instanceId: z.string().optional(),
  direction: MessageDirectionSchema,
  type: MessageTypeSchema.default('TEXT'),
  content: z.string().default(''),
  caption: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaFileName: z.string().optional(),
  mediaType: z.string().optional(),
  mediaSize: z.number().int().nonnegative().optional(),
  status: MessageStatusSchema.default('PENDING'),
  externalId: z.string().optional(), // ID do provedor externo
  quotedMessageId: EntityIdSchema.optional(), // Mensagem citada
  metadata: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().optional(),
  deliveredAt: TimestampSchema.optional(),
  readAt: TimestampSchema.optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Contact
// ============================================================================

export const ContactSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  phone: PhoneNumberSchema.optional(),
  email: EmailSchema.optional(),
  document: z.string().optional(),
  avatar: z.string().url().optional(),
  isBlocked: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  lastInteractionAt: TimestampSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export type Contact = z.infer<typeof ContactSchema>;

// ============================================================================
// User (Agent)
// ============================================================================

export const UserRoleSchema = z.enum([
  'ADMIN',
  'SUPERVISOR',
  'AGENT',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  email: EmailSchema,
  phone: PhoneNumberSchema.optional(),
  avatar: z.string().url().optional(),
  role: UserRoleSchema.default('AGENT'),
  isActive: z.boolean().default(true),
  queueIds: z.array(EntityIdSchema).default([]),
  settings: z.record(z.unknown()).default({}),
  lastLoginAt: TimestampSchema.optional(),
});

export type User = z.infer<typeof UserSchema>;

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export const CreateTicketDTOSchema = z.object({
  tenantId: TenantIdSchema,
  contactId: EntityIdSchema,
  queueId: EntityIdSchema,
  subject: z.string().max(200).optional(),
  channel: ChannelTypeSchema,
  priority: TicketPrioritySchema.default('NORMAL'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type CreateTicketDTO = z.infer<typeof CreateTicketDTOSchema>;

export const UpdateTicketDTOSchema = z.object({
  status: TicketStatusSchema.optional(),
  priority: TicketPrioritySchema.optional(),
  subject: z.string().max(200).optional(),
  userId: EntityIdSchema.optional(),
  queueId: EntityIdSchema.optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  closeReason: z.string().max(500).optional(),
});

export type UpdateTicketDTO = z.infer<typeof UpdateTicketDTOSchema>;

export const SendMessageDTOSchema = z
  .object({
    ticketId: EntityIdSchema,
    type: MessageTypeSchema.default('TEXT'),
    instanceId: z.string().optional(),
    direction: MessageDirectionSchema,
    content: z.string().optional(),
    caption: z.string().optional(),
    externalId: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    mediaFileName: z.string().optional(),
    mediaMimeType: z.string().optional(),
    quotedMessageId: EntityIdSchema.optional(),
    metadata: z.record(z.unknown()).default({}),
    idempotencyKey: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasText = typeof value.content === 'string' && value.content.trim().length > 0;
    const hasMedia = typeof value.mediaUrl === 'string' && value.mediaUrl.trim().length > 0;
    const mediaTypes = new Set(['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO']);

    if (value.type === 'TEXT' && !hasText) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe o conteúdo da mensagem de texto.',
        path: ['content'],
      });
    }

    if (mediaTypes.has(value.type) && !hasMedia) {
      ctx.addIssue({
        code: 'custom',
        message: 'Mensagens de mídia exigem mediaUrl válido.',
        path: ['mediaUrl'],
      });
    }
  });

export type SendMessageDTO = z.infer<typeof SendMessageDTOSchema>;

export const CreateContactDTOSchema = z.object({
  tenantId: TenantIdSchema,
  name: z.string().min(1).max(100),
  phone: PhoneNumberSchema.optional(),
  email: EmailSchema.optional(),
  document: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
  notes: z.string().max(2000).optional(),
});

export type CreateContactDTO = z.infer<typeof CreateContactDTOSchema>;

// ============================================================================
// Filters
// ============================================================================

export const TicketFiltersSchema = z.object({
  status: z.array(TicketStatusSchema).optional(),
  priority: z.array(TicketPrioritySchema).optional(),
  queueId: z.array(EntityIdSchema).optional(),
  userId: z.array(EntityIdSchema).optional(),
  channel: z.array(ChannelTypeSchema).optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: TimestampSchema.optional(),
  dateTo: TimestampSchema.optional(),
  search: z.string().optional(), // Busca em subject, contact name, etc.
});

export type TicketFilters = z.infer<typeof TicketFiltersSchema>;

export const MessageFiltersSchema = z.object({
  ticketId: EntityIdSchema.optional(),
  contactId: EntityIdSchema.optional(),
  userId: EntityIdSchema.optional(),
  direction: z.array(MessageDirectionSchema).optional(),
  type: z.array(MessageTypeSchema).optional(),
  status: z.array(MessageStatusSchema).optional(),
  dateFrom: TimestampSchema.optional(),
  dateTo: TimestampSchema.optional(),
  search: z.string().optional(), // Busca no conteúdo
});

export type MessageFilters = z.infer<typeof MessageFiltersSchema>;

// ============================================================================
// Events
// ============================================================================

export const TicketCreatedEventSchema = z.object({
  type: z.literal('TICKET_CREATED'),
  ticketId: EntityIdSchema,
  contactId: EntityIdSchema,
  queueId: EntityIdSchema,
  channel: ChannelTypeSchema,
});

export const TicketAssignedEventSchema = z.object({
  type: z.literal('TICKET_ASSIGNED'),
  ticketId: EntityIdSchema,
  userId: EntityIdSchema,
  previousUserId: EntityIdSchema.optional(),
});

export const TicketStatusChangedEventSchema = z.object({
  type: z.literal('TICKET_STATUS_CHANGED'),
  ticketId: EntityIdSchema,
  status: TicketStatusSchema,
  previousStatus: TicketStatusSchema,
  userId: EntityIdSchema.optional(),
});

export const MessageReceivedEventSchema = z.object({
  type: z.literal('MESSAGE_RECEIVED'),
  messageId: EntityIdSchema,
  ticketId: EntityIdSchema,
  contactId: EntityIdSchema,
  content: z.string(),
  messageType: MessageTypeSchema,
});

export const MessageSentEventSchema = z.object({
  type: z.literal('MESSAGE_SENT'),
  messageId: EntityIdSchema,
  ticketId: EntityIdSchema,
  userId: EntityIdSchema,
  content: z.string(),
  messageType: MessageTypeSchema,
});

export type TicketCreatedEvent = z.infer<typeof TicketCreatedEventSchema>;
export type TicketAssignedEvent = z.infer<typeof TicketAssignedEventSchema>;
export type TicketStatusChangedEvent = z.infer<typeof TicketStatusChangedEventSchema>;
export type MessageReceivedEvent = z.infer<typeof MessageReceivedEventSchema>;
export type MessageSentEvent = z.infer<typeof MessageSentEventSchema>;

export type TicketDomainEvent =
  | TicketCreatedEvent
  | TicketAssignedEvent
  | TicketStatusChangedEvent
  | MessageReceivedEvent
  | MessageSentEvent;
