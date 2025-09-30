import {
  ConflictError,
  CreateTicketDTO,
  Message,
  Pagination,
  PaginatedResult,
  SendMessageDTO,
  Ticket,
  TicketFilters,
  UpdateTicketDTO,
  NotFoundError,
} from '@ticketz/core';
import {
  assignTicket as storageAssignTicket,
  closeTicket as storageCloseTicket,
  createMessage as storageCreateMessage,
  createTicket as storageCreateTicket,
  findTicketById as storageFindTicketById,
  findTicketsByContact,
  listMessages as storageListMessages,
  listTickets as storageListTickets,
  updateTicket as storageUpdateTicket,
} from '@ticketz/storage';
import { emitToTenant, emitToUser } from '../lib/socket-registry';

const OPEN_STATUSES = new Set(['OPEN', 'PENDING', 'ASSIGNED']);

const emitTicketEvent = (tenantId: string, event: string, payload: unknown, userId?: string | null) => {
  emitToTenant(tenantId, event, payload);
  if (userId) {
    emitToUser(userId, event, payload);
  }
};

export const listTickets = async (
  tenantId: string,
  filters: TicketFilters,
  pagination: Pagination
): Promise<PaginatedResult<Ticket>> => {
  return storageListTickets(tenantId, filters, pagination);
};

export const getTicketById = async (tenantId: string, ticketId: string): Promise<Ticket> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }
  return ticket;
};

export const createTicket = async (input: CreateTicketDTO): Promise<Ticket> => {
  const existingTickets = await findTicketsByContact(input.tenantId, input.contactId);
  const openTicket = existingTickets.find((ticket) => OPEN_STATUSES.has(ticket.status));

  if (openTicket) {
    throw new ConflictError('Contact already has an open ticket', {
      existingTicketId: openTicket.id,
    });
  }

  const ticket = await storageCreateTicket(input);
  emitTicketEvent(input.tenantId, 'ticket.created', ticket, ticket.userId ?? null);
  return ticket;
};

export const updateTicket = async (
  tenantId: string,
  ticketId: string,
  input: UpdateTicketDTO
): Promise<Ticket> => {
  const updated = await storageUpdateTicket(tenantId, ticketId, input);
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  emitTicketEvent(tenantId, 'ticket.updated', updated, updated.userId ?? null);
  return updated;
};

export const assignTicket = async (
  tenantId: string,
  ticketId: string,
  userId: string
): Promise<Ticket> => {
  const updated = await storageAssignTicket(tenantId, ticketId, userId);
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  emitTicketEvent(tenantId, 'ticket.assigned', updated, userId);
  return updated;
};

export const closeTicket = async (
  tenantId: string,
  ticketId: string,
  reason: string | undefined,
  userId: string | undefined
): Promise<Ticket> => {
  const updated = await storageCloseTicket(tenantId, ticketId, reason, userId);
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  emitTicketEvent(tenantId, 'ticket.closed', updated, userId ?? updated.userId ?? null);
  return updated;
};

export const listMessages = async (
  tenantId: string,
  ticketId: string,
  pagination: Pagination
): Promise<PaginatedResult<Message>> => {
  await getTicketById(tenantId, ticketId);
  return storageListMessages(tenantId, { ticketId }, pagination);
};

export const sendMessage = async (
  tenantId: string,
  userId: string | undefined,
  input: SendMessageDTO
): Promise<Message> => {
  const message = await storageCreateMessage(tenantId, input.ticketId, {
    ...input,
    direction: userId ? 'OUTBOUND' : 'INBOUND',
    userId,
    status: 'SENT',
  });

  if (!message) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  emitToTenant(tenantId, 'ticket.message', message);

  const ticket = await storageFindTicketById(tenantId, input.ticketId);
  if (ticket) {
    emitTicketEvent(tenantId, 'ticket.updated', ticket, ticket.userId ?? null);
  }

  return message;
};

