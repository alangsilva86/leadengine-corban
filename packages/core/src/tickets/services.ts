import {
  Ticket,
  Message,
  Contact,
  Queue,
  User,
  TicketStatus,
  CreateTicketDTO,
  SendMessageDTO,
  CreateContactDTO,
  TicketFilters,
  MessageFilters,
  TicketCreatedEvent,
  TicketAssignedEvent,
  TicketStatusChangedEvent,
  MessageSentEvent,
} from './types';
import {
  EntityId,
  TenantId,
  Result,
  success,
  failure,
  PaginatedResult,
  Pagination,
  Repository,
  EventBus,
  UseCase,
  Query,
  Command,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../common/types';
import { randomUUID } from 'node:crypto';

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface TicketRepository extends Repository<Ticket> {
  findByContactId(contactId: EntityId, tenantId: TenantId): Promise<Ticket[]>;
  findByQueueId(queueId: EntityId, tenantId: TenantId): Promise<Ticket[]>;
  findByUserId(userId: EntityId, tenantId: TenantId): Promise<Ticket[]>;
  findByStatus(status: TicketStatus, tenantId: TenantId): Promise<Ticket[]>;
  findWithFilters(filters: TicketFilters, pagination: Pagination): Promise<PaginatedResult<Ticket>>;
  updateStatus(id: EntityId, tenantId: TenantId, status: TicketStatus): Promise<Ticket>;
  assignToUser(id: EntityId, tenantId: TenantId, userId: EntityId): Promise<Ticket>;
  close(id: EntityId, tenantId: TenantId, reason?: string, closedBy?: EntityId): Promise<Ticket>;
}

export interface MessageRepository extends Repository<Message> {
  findByTicketId(ticketId: EntityId, tenantId: TenantId): Promise<Message[]>;
  findByContactId(contactId: EntityId, tenantId: TenantId): Promise<Message[]>;
  findWithFilters(filters: MessageFilters, pagination: Pagination): Promise<PaginatedResult<Message>>;
  markAsDelivered(id: EntityId, tenantId: TenantId): Promise<Message>;
  markAsRead(id: EntityId, tenantId: TenantId): Promise<Message>;
}

export interface ContactRepository extends Repository<Contact> {
  findByPhone(phone: string, tenantId: TenantId): Promise<Contact | null>;
  findByEmail(email: string, tenantId: TenantId): Promise<Contact | null>;
  findByDocument(document: string, tenantId: TenantId): Promise<Contact | null>;
  search(query: string, tenantId: TenantId): Promise<Contact[]>;
  block(id: EntityId, tenantId: TenantId): Promise<Contact>;
  unblock(id: EntityId, tenantId: TenantId): Promise<Contact>;
}

export interface QueueRepository extends Repository<Queue> {
  findActive(tenantId: TenantId): Promise<Queue[]>;
  findByOrderIndex(tenantId: TenantId): Promise<Queue[]>;
}

export interface UserRepository extends Repository<User> {
  findByEmail(email: string, tenantId: TenantId): Promise<User | null>;
  findByQueueId(queueId: EntityId, tenantId: TenantId): Promise<User[]>;
  findActive(tenantId: TenantId): Promise<User[]>;
}

// ============================================================================
// External Services
// ============================================================================

export interface MessageProvider {
  sendMessage(
    channel: string,
    to: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }>;
  
  sendMedia(
    channel: string,
    to: string,
    mediaUrl: string,
    caption?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ externalId: string; status: string }>;
}

// ============================================================================
// Use Cases
// ============================================================================

export class CreateTicketUseCase implements UseCase<CreateTicketDTO, Ticket> {
  constructor(
    private ticketRepository: TicketRepository,
    private contactRepository: ContactRepository,
    private queueRepository: QueueRepository,
    private eventBus: EventBus
  ) {}

  async execute(input: CreateTicketDTO): Promise<Result<Ticket>> {
    try {
      // Validar se o contato existe
      const contact = await this.contactRepository.findById(input.contactId, input.tenantId);
      if (!contact) {
        return failure(new NotFoundError('Contact', input.contactId));
      }

      // Validar se a fila existe
      const queue = await this.queueRepository.findById(input.queueId, input.tenantId);
      if (!queue) {
        return failure(new NotFoundError('Queue', input.queueId));
      }

      // Verificar se já existe ticket aberto para este contato
      const existingTickets = await this.ticketRepository.findByContactId(
        input.contactId,
        input.tenantId
      );
      const openTicket = existingTickets.find(t => ['OPEN', 'PENDING', 'ASSIGNED'].includes(t.status));
      
      if (openTicket) {
        return failure(new ConflictError('Contact already has an open ticket', {
          existingTicketId: openTicket.id,
        }));
      }

      // Criar o ticket
      const ticket = await this.ticketRepository.create({
        tenantId: input.tenantId,
        contactId: input.contactId,
        queueId: input.queueId,
        subject: input.subject,
        channel: input.channel,
        status: 'OPEN',
        priority: input.priority,
        tags: input.tags,
        metadata: input.metadata,
      });

      // Publicar evento
      const event: TicketCreatedEvent = {
        type: 'TICKET_CREATED',
        ticketId: ticket.id,
        contactId: ticket.contactId,
        queueId: ticket.queueId,
        channel: ticket.channel,
      };

      await this.eventBus.publish({
        id: randomUUID(),
        type: event.type,
        aggregateId: ticket.id,
        aggregateType: 'Ticket',
        tenantId: ticket.tenantId,
        payload: event,
        occurredAt: new Date(),
        version: 1,
      });

      return success(ticket);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

export class AssignTicketUseCase implements Command<{ ticketId: EntityId; userId: EntityId; tenantId: TenantId }> {
  constructor(
    private ticketRepository: TicketRepository,
    private userRepository: UserRepository,
    private eventBus: EventBus
  ) {}

  async execute(input: { ticketId: EntityId; userId: EntityId; tenantId: TenantId }): Promise<Result<void>> {
    try {
      // Validar se o ticket existe
      const ticket = await this.ticketRepository.findById(input.ticketId, input.tenantId);
      if (!ticket) {
        return failure(new NotFoundError('Ticket', input.ticketId));
      }

      // Validar se o usuário existe
      const user = await this.userRepository.findById(input.userId, input.tenantId);
      if (!user) {
        return failure(new NotFoundError('User', input.userId));
      }

      // Verificar se o usuário está ativo
      if (!user.isActive) {
        return failure(new ValidationError('User is not active'));
      }

      const previousUserId = ticket.userId;
      
      // Atribuir o ticket
      await this.ticketRepository.assignToUser(input.ticketId, input.tenantId, input.userId);

      // Publicar evento
      const event: TicketAssignedEvent = {
        type: 'TICKET_ASSIGNED',
        ticketId: input.ticketId,
        userId: input.userId,
        previousUserId,
      };

      await this.eventBus.publish({
        id: randomUUID(),
        type: event.type,
        aggregateId: input.ticketId,
        aggregateType: 'Ticket',
        tenantId: input.tenantId,
        payload: event,
        occurredAt: new Date(),
        version: 1,
      });

      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

export class UpdateTicketStatusUseCase implements Command<{ ticketId: EntityId; status: TicketStatus; tenantId: TenantId; userId?: EntityId }> {
  constructor(
    private ticketRepository: TicketRepository,
    private eventBus: EventBus
  ) {}

  async execute(input: { ticketId: EntityId; status: TicketStatus; tenantId: TenantId; userId?: EntityId }): Promise<Result<void>> {
    try {
      // Validar se o ticket existe
      const ticket = await this.ticketRepository.findById(input.ticketId, input.tenantId);
      if (!ticket) {
        return failure(new NotFoundError('Ticket', input.ticketId));
      }

      const previousStatus = ticket.status;
      
      // Atualizar status
      await this.ticketRepository.updateStatus(input.ticketId, input.tenantId, input.status);

      // Publicar evento
      const event: TicketStatusChangedEvent = {
        type: 'TICKET_STATUS_CHANGED',
        ticketId: input.ticketId,
        status: input.status,
        previousStatus,
        userId: input.userId,
      };

      await this.eventBus.publish({
        id: randomUUID(),
        type: event.type,
        aggregateId: input.ticketId,
        aggregateType: 'Ticket',
        tenantId: input.tenantId,
        payload: event,
        occurredAt: new Date(),
        version: 1,
      });

      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

export class SendMessageUseCase implements UseCase<SendMessageDTO & { tenantId: TenantId; userId?: EntityId }, Message> {
  constructor(
    private messageRepository: MessageRepository,
    private ticketRepository: TicketRepository,
    private contactRepository: ContactRepository,
    private messageProvider: MessageProvider,
    private eventBus: EventBus
  ) {}

  async execute(input: SendMessageDTO & { tenantId: TenantId; userId?: EntityId }): Promise<Result<Message>> {
    try {
      // Validar se o ticket existe
      const ticket = await this.ticketRepository.findById(input.ticketId, input.tenantId);
      if (!ticket) {
        return failure(new NotFoundError('Ticket', input.ticketId));
      }

      // Buscar contato
      const contact = await this.contactRepository.findById(ticket.contactId, input.tenantId);
      if (!contact) {
        return failure(new NotFoundError('Contact', ticket.contactId));
      }

      const content = input.content ?? '';
      const mediaUrl = input.mediaUrl ?? undefined;

      // Criar mensagem
      const message = await this.messageRepository.create({
        tenantId: input.tenantId,
        ticketId: input.ticketId,
        contactId: ticket.contactId,
        userId: input.userId,
        direction: 'OUTBOUND',
        type: input.type,
        content,
        caption: input.caption,
        mediaUrl,
        mediaFileName: input.mediaFileName,
        mediaType: input.mediaMimeType,
        quotedMessageId: input.quotedMessageId,
        status: 'PENDING',
        metadata: input.metadata,
        idempotencyKey: input.idempotencyKey,
      });

      // Enviar via provedor externo
      try {
        const destination = contact.phone || contact.email;
        if (!destination) {
          throw new ValidationError('Contact has no phone or email');
        }

        const result = mediaUrl
          ? await this.messageProvider.sendMedia(
              ticket.channel,
              destination,
              mediaUrl,
              input.caption ?? content,
              input.metadata
            )
          : await this.messageProvider.sendMessage(
              ticket.channel,
              destination,
              content,
              input.metadata
            );

        // Atualizar mensagem com ID externo
        await this.messageRepository.update(message.id, input.tenantId, {
          externalId: result.externalId,
          status: 'SENT',
        });
      } catch (providerError) {
        // Marcar mensagem como falha
        await this.messageRepository.update(message.id, input.tenantId, {
          status: 'FAILED',
        });
        
        return failure(providerError as Error);
      }

      // Publicar evento
      const event: MessageSentEvent = {
        type: 'MESSAGE_SENT',
        messageId: message.id,
        ticketId: input.ticketId,
        userId: input.userId!,
        content,
        messageType: input.type,
      };

      await this.eventBus.publish({
        id: randomUUID(),
        type: event.type,
        aggregateId: message.id,
        aggregateType: 'Message',
        tenantId: input.tenantId,
        payload: event,
        occurredAt: new Date(),
        version: 1,
      });

      return success(message);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

export class CreateContactUseCase implements UseCase<CreateContactDTO, Contact> {
  constructor(
    private contactRepository: ContactRepository
  ) {}

  async execute(input: CreateContactDTO): Promise<Result<Contact>> {
    try {
      // Verificar duplicatas
      if (input.phone) {
        const existingByPhone = await this.contactRepository.findByPhone(input.phone, input.tenantId);
        if (existingByPhone) {
          return failure(new ConflictError('Contact with this phone already exists', {
            existingContactId: existingByPhone.id,
          }));
        }
      }

      if (input.email) {
        const existingByEmail = await this.contactRepository.findByEmail(input.email, input.tenantId);
        if (existingByEmail) {
          return failure(new ConflictError('Contact with this email already exists', {
            existingContactId: existingByEmail.id,
          }));
        }
      }

      // Criar contato
      const contact = await this.contactRepository.create({
        tenantId: input.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        document: input.document,
        isBlocked: false,
        tags: input.tags,
        customFields: input.customFields,
        notes: input.notes,
      });

      return success(contact);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

// ============================================================================
// Query Services
// ============================================================================

export class GetTicketsQuery implements Query<{ filters: TicketFilters; pagination: Pagination }, PaginatedResult<Ticket>> {
  constructor(private ticketRepository: TicketRepository) {}

  async execute(input: { filters: TicketFilters; pagination: Pagination }): Promise<Result<PaginatedResult<Ticket>>> {
    try {
      const result = await this.ticketRepository.findWithFilters(input.filters, input.pagination);
      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

export class GetMessagesQuery implements Query<{ filters: MessageFilters; pagination: Pagination }, PaginatedResult<Message>> {
  constructor(private messageRepository: MessageRepository) {}

  async execute(input: { filters: MessageFilters; pagination: Pagination }): Promise<Result<PaginatedResult<Message>>> {
    try {
      const result = await this.messageRepository.findWithFilters(input.filters, input.pagination);
      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }
}

export class GetTicketByIdQuery implements Query<{ ticketId: EntityId; tenantId: TenantId }, Ticket> {
  constructor(private ticketRepository: TicketRepository) {}

  async execute(input: { ticketId: EntityId; tenantId: TenantId }): Promise<Result<Ticket>> {
    try {
      const ticket = await this.ticketRepository.findById(input.ticketId, input.tenantId);
      if (!ticket) {
        return failure(new NotFoundError('Ticket', input.ticketId));
      }
      return success(ticket);
    } catch (error) {
      return failure(error as Error);
    }
  }
}
