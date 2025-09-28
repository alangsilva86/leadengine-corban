// ============================================================================
// Core Package - Main Export
// ============================================================================

// Common types and utilities
export * from './common/types';

// Tickets domain
export * from './tickets/types';
export * from './tickets/services';

// Leads domain
export * from './leads/types';

// Re-export for convenience
export type {
  // Base types
  EntityId,
  TenantId,
  BaseEntity,
  Result,
  PaginatedResult,
  Pagination,
  DomainEvent,
} from './common/types';

export type {
  // Tickets
  Ticket,
  Message,
  Contact,
  Queue,
  User,
  TicketStatus,
  MessageStatus,
  TicketPriority,
  CreateTicketDTO,
  UpdateTicketDTO,
  SendMessageDTO,
  CreateContactDTO,
  TicketFilters,
  MessageFilters,
} from './tickets/types';

export type {
  // Leads
  Lead,
  LeadStatus,
  LeadSource,
  Campaign,
  CampaignType,
  CampaignStatus,
  LeadActivity,
  Attribution,
  Touchpoint,
  CreateLeadDTO,
  UpdateLeadDTO,
  CreateCampaignDTO,
  LeadFilters,
  CampaignFilters,
} from './leads/types';

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
} from './tickets/services';

// Utility functions
export { success, failure } from './common/types';
