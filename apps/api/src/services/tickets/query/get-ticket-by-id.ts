import { NotFoundError } from '@ticketz/core';
import { findTicketById as storageFindTicketById } from '@ticketz/storage';
import { listTicketSalesEvents } from '../../data/ticket-sales-event-store';
import type { ListTicketsOptions, TicketHydrated } from '../types';
import { hydrateTicket, resolveTicketHydrations } from './query-helpers';

export const getTicketById = async (
  tenantId: string,
  ticketId: string,
  options: ListTicketsOptions = {}
): Promise<TicketHydrated> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const includeSet = new Set(options.include ?? []);
  const include = {
    contact: includeSet.has('contact'),
    lead: includeSet.has('lead'),
    notes: includeSet.has('notes'),
    metrics: Boolean(options.includeMetrics),
  };

  const { conversations, contacts, leads, notes } = await resolveTicketHydrations(tenantId, [ticket], include);
  const stats = conversations.get(ticketId);
  const salesTimeline = await listTicketSalesEvents(tenantId, ticketId);

  return hydrateTicket(
    ticket,
    stats,
    salesTimeline,
    include.contact,
    include.lead,
    include.notes,
    contacts,
    leads,
    notes
  );
};
