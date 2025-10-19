import { $Enums } from '@prisma/client';

export type TicketStatus = $Enums.TicketStatus;
export type TicketPriority = $Enums.TicketPriority;
export type ChannelType = $Enums.ChannelType;
export type MessageStatus = $Enums.MessageStatus;
export type MessageType = $Enums.MessageType | 'TEMPLATE';
export type MessageDirection = $Enums.MessageDirection;
export type ContactStatus = $Enums.ContactStatus;
export type ContactLifecycleStage = $Enums.ContactLifecycleStage;
export type ContactSource = $Enums.ContactSource;
export type ContactPhoneType = $Enums.ContactPhoneType;
export type ContactEmailType = $Enums.ContactEmailType;
export type InteractionType = $Enums.InteractionType;
export type InteractionDirection = $Enums.InteractionDirection;
export type InteractionChannel = $Enums.InteractionChannel;
export type TaskType = $Enums.TaskType;
export type TaskStatus = $Enums.TaskStatus;
export type TaskPriority = $Enums.TaskPriority;

export type SortOrder = 'asc' | 'desc';

export interface Pagination {
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TicketFilters {
  status?: TicketStatus[] | undefined;
  priority?: TicketPriority[] | undefined;
  queueId?: string[] | undefined;
  userId?: string[] | undefined;
  channel?: ChannelType[] | undefined;
  tags?: string[] | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  search?: string | undefined;
}

export interface MessageFilters {
  ticketId?: string | undefined;
  contactId?: string | undefined;
  userId?: string | undefined;
  direction?: MessageDirection[] | undefined;
  type?: MessageType[] | undefined;
  status?: MessageStatus[] | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  search?: string | undefined;
}

export interface CreateTicketDTO {
  tenantId: string;
  contactId: string;
  queueId: string;
  subject?: string | undefined;
  channel: ChannelType;
  priority?: TicketPriority | undefined;
  tags?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface UpdateTicketDTO {
  status?: TicketStatus | undefined;
  priority?: TicketPriority | undefined;
  subject?: string | undefined;
  userId?: string | undefined;
  queueId?: string | undefined;
  tags?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  closeReason?: string | undefined;
}

export interface SendMessageDTO {
  ticketId: string;
  type?: MessageType | undefined;
  instanceId?: string | undefined;
  direction: MessageDirection;
  content?: string | undefined;
  caption?: string | undefined;
  externalId?: string | undefined;
  mediaUrl?: string | undefined;
  mediaFileName?: string | undefined;
  mediaMimeType?: string | undefined;
  quotedMessageId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  idempotencyKey?: string | undefined;
}

export interface Ticket {
  id: string;
  tenantId: string;
  contactId: string;
  queueId: string;
  userId?: string | undefined;
  status: TicketStatus;
  priority: TicketPriority;
  subject?: string | undefined;
  channel: ChannelType;
  lastMessageAt?: Date | undefined;
  lastMessagePreview?: string | undefined;
  tags: string[];
  metadata: Record<string, unknown>;
  closedAt?: Date | undefined;
  closedBy?: string | undefined;
  closeReason?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  tenantId: string;
  ticketId: string;
  contactId: string;
  userId?: string | undefined;
  instanceId?: string | undefined;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  caption?: string | undefined;
  mediaUrl?: string | undefined;
  mediaFileName?: string | undefined;
  mediaType?: string | undefined;
  mediaSize?: number | undefined;
  status: MessageStatus;
  externalId?: string | undefined;
  quotedMessageId?: string | undefined;
  metadata: Record<string, unknown>;
  idempotencyKey?: string | undefined;
  deliveredAt?: Date | undefined;
  readAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  color?: string | undefined;
  description?: string | undefined;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactPhone {
  id: string;
  tenantId: string;
  contactId: string;
  phoneNumber: string;
  type?: ContactPhoneType | undefined;
  label?: string | undefined;
  waId?: string | undefined;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactEmail {
  id: string;
  tenantId: string;
  contactId: string;
  email: string;
  type?: ContactEmailType | undefined;
  label?: string | undefined;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactTag {
  id: string;
  tenantId: string;
  contactId: string;
  tagId: string;
  addedById?: string | undefined;
  addedAt: Date;
  tag: Tag;
}

export interface Interaction {
  id: string;
  tenantId: string;
  contactId: string;
  userId?: string | undefined;
  type: InteractionType;
  direction: InteractionDirection;
  channel?: InteractionChannel | undefined;
  subject?: string | undefined;
  content?: string | undefined;
  metadata: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  tenantId: string;
  contactId: string;
  createdById?: string | undefined;
  assigneeId?: string | undefined;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description?: string | undefined;
  dueAt?: Date | undefined;
  completedAt?: Date | undefined;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  id: string;
  tenantId: string;
  fullName: string;
  name: string;
  displayName?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  organization?: string | undefined;
  jobTitle?: string | undefined;
  department?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  primaryPhone?: string | undefined;
  primaryEmail?: string | undefined;
  document?: string | undefined;
  avatar?: string | undefined;
  status: ContactStatus;
  lifecycleStage: ContactLifecycleStage;
  source: ContactSource;
  ownerId?: string | undefined;
  isBlocked: boolean;
  isVip: boolean;
  timezone?: string | undefined;
  locale?: string | undefined;
  birthDate?: Date | undefined;
  lastInteractionAt?: Date | undefined;
  lastActivityAt?: Date | undefined;
  notes?: string | undefined;
  customFields: Record<string, unknown>;
  metadata: Record<string, unknown>;
  tags: string[];
  tagAssignments: ContactTag[];
  phones: string[];
  phoneDetails: ContactPhone[];
  emails: string[];
  emailDetails: ContactEmail[];
  interactions: Interaction[];
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}
