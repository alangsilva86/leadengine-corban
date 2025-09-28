// ============================================================================
// Tickets Domain - Exports
// ============================================================================

// Types
export * from './types';

// Services
export * from './services';

// Re-export specific types for convenience
export type {
  Ticket,
  Message,
  Contact,
  Queue,
  User,
  TicketStatus,
  MessageStatus,
  TicketPriority,

  UserRole,
  CreateTicketDTO,
  UpdateTicketDTO,
  SendMessageDTO,
  CreateContactDTO,
  TicketFilters,
  MessageFilters,
  TicketCreatedEvent,
  TicketAssignedEvent,
  TicketStatusChangedEvent,
  MessageReceivedEvent,
  MessageSentEvent,
  TicketDomainEvent,
} from './types';

// Services
export {
  CreateTicketUseCase,
  AssignTicketUseCase,
  UpdateTicketStatusUseCase,
  SendMessageUseCase,
  CreateContactUseCase,
  GetTicketsQuery,
  GetMessagesQuery,
  GetTicketByIdQuery,
} from './services';

// Repository interfaces
export type {
  TicketRepository,
  MessageRepository,
  ContactRepository,
  QueueRepository,
  UserRepository,
  MessageProvider,
} from './services';
