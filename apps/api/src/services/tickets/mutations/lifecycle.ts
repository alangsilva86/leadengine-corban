import { ConflictError, NotFoundError } from '@ticketz/core';
import {
  assignTicket as storageAssignTicket,
  closeTicket as storageCloseTicket,
  createTicket as storageCreateTicket,
  findTicketById as storageFindTicketById,
  findTicketsByContact,
  updateTicket as storageUpdateTicket,
} from '@ticketz/storage';
import type { CreateTicketDTO, Ticket, UpdateTicketDTO } from '../../../types/tickets';
import { createTicketNote, type TicketNote } from '../../../data/ticket-note-store';
import type { CreateTicketNoteInput, TicketNoteAuthor } from '../types';
import { emitTicketEvent, buildTicketRealtimeEnvelope, emitTicketRealtimeEnvelope } from '../shared/realtime';
import { resolveWhatsAppInstanceId } from '../shared/whatsapp';
import { handleDatabaseError, isForeignKeyViolation } from '../shared/prisma-helpers';
import { OPEN_STATUSES } from '../constants';

export const createTicket = async (input: CreateTicketDTO): Promise<Ticket> => {
  const existingTickets = await findTicketsByContact(input.tenantId, input.contactId);
  const openTicket = existingTickets.find((ticket) => OPEN_STATUSES.has(ticket.status));

  if (openTicket) {
    throw new ConflictError('Contact already has an open ticket', {
      existingTicketId: openTicket.id,
    });
  }

  try {
    const ticket = await storageCreateTicket(input);
    emitTicketEvent(input.tenantId, ticket.id, 'ticket.created', ticket, ticket.userId ?? null);

    const ticketEnvelope = buildTicketRealtimeEnvelope({
      tenantId: input.tenantId,
      ticket,
      instanceId: resolveWhatsAppInstanceId(ticket),
    });

    emitTicketRealtimeEnvelope(input.tenantId, ticket, ticketEnvelope, ticket.userId ?? null);
    return ticket;
  } catch (error) {
    if (isForeignKeyViolation(error, 'contactId')) {
      throw new NotFoundError('Contact', input.contactId);
    }

    if (isForeignKeyViolation(error, 'queueId')) {
      throw new NotFoundError('Queue', input.queueId);
    }

    handleDatabaseError(error, {
      action: 'createTicket',
      tenantId: input.tenantId,
      contactId: input.contactId,
      queueId: input.queueId,
    });
    throw error;
  }
};

export const updateTicket = async (
  tenantId: string,
  ticketId: string,
  input: UpdateTicketDTO
): Promise<Ticket> => {
  let updated: Ticket | null = null;

  try {
    updated = await storageUpdateTicket(tenantId, ticketId, input);
  } catch (error) {
    if (input.queueId && isForeignKeyViolation(error, 'queueId')) {
      throw new NotFoundError('Queue', input.queueId);
    }

    handleDatabaseError(error, {
      action: 'updateTicket',
      tenantId,
      ticketId,
    });
    throw error;
  }
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket: updated,
    instanceId: resolveWhatsAppInstanceId(updated),
  });

  emitTicketRealtimeEnvelope(tenantId, updated, ticketEnvelope, updated.userId ?? null);
  return updated;
};

export const assignTicket = async (
  tenantId: string,
  ticketId: string,
  userId: string
): Promise<Ticket> => {
  let updated: Ticket | null = null;

  try {
    updated = await storageAssignTicket(tenantId, ticketId, userId);
  } catch (error) {
    handleDatabaseError(error, {
      action: 'assignTicket',
      tenantId,
      ticketId,
      userId,
    });
    throw error;
  }
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket: updated,
    instanceId: resolveWhatsAppInstanceId(updated),
  });

  emitTicketRealtimeEnvelope(tenantId, updated, ticketEnvelope, userId ?? null);
  return updated;
};

export const closeTicket = async (
  tenantId: string,
  ticketId: string,
  reason: string | undefined,
  userId: string | undefined
): Promise<Ticket> => {
  let updated: Ticket | null = null;

  try {
    updated = await storageCloseTicket(tenantId, ticketId, reason, userId);
  } catch (error) {
    handleDatabaseError(error, {
      action: 'closeTicket',
      tenantId,
      ticketId,
    });
    throw error;
  }
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const actorId = userId ?? updated.userId ?? null;
  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket: updated,
    instanceId: resolveWhatsAppInstanceId(updated),
  });

  emitTicketRealtimeEnvelope(tenantId, updated, ticketEnvelope, actorId);
  return updated;
};

export const addTicketNote = async (
  tenantId: string,
  ticketId: string,
  author: TicketNoteAuthor,
  input: CreateTicketNoteInput
): Promise<TicketNote> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const notePayload: Parameters<typeof createTicketNote>[0] = {
    tenantId,
    ticketId,
    authorId: author.id,
    authorName: author.name ?? null,
    authorAvatar: author.avatar ?? null,
    body: input.body,
  };

  if (input.visibility) {
    notePayload.visibility = input.visibility;
  }

  if (Array.isArray(input.tags)) {
    notePayload.tags = input.tags;
  }

  if (input.metadata) {
    notePayload.metadata = input.metadata;
  }

  const note = await createTicketNote(notePayload);

  emitTicketEvent(tenantId, ticketId, 'ticket.note.created', note, author.id);

  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket,
    instanceId: resolveWhatsAppInstanceId(ticket),
  });

  emitTicketRealtimeEnvelope(tenantId, ticket, ticketEnvelope, author.id);

  return note;
};
