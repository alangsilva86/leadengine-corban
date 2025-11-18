import type { PaginatedResult, Pagination, Ticket, TicketFilters } from '../../../types/tickets';
import { listTickets as storageListTickets } from '@ticketz/storage';
import { listTicketSalesEventsByTickets } from '../../../data/ticket-sales-event-store';
import type { ListTicketsOptions, TicketHydrated, TicketListResult } from '../types';
import { calculateInboxMetrics } from '../shared/metrics';
import { hydrateTicket, resolveTicketHydrations } from './query-helpers';

export const listTickets = async (
  tenantId: string,
  filters: TicketFilters,
  pagination: Pagination,
  options: ListTicketsOptions = {}
): Promise<TicketListResult> => {
  const includeSet = new Set(options.include ?? []);
  const include = {
    contact: includeSet.has('contact'),
    lead: includeSet.has('lead'),
    notes: includeSet.has('notes'),
    metrics: Boolean(options.includeMetrics),
  };

  const baseResult = (await storageListTickets(tenantId, filters, pagination)) as PaginatedResult<Ticket>;
  const rawItems = baseResult.items;

  const { conversations, contacts, leads, notes } = await resolveTicketHydrations(tenantId, rawItems, include);
  const salesTimelineMap = await listTicketSalesEventsByTickets(
    tenantId,
    rawItems.map((ticket: Ticket) => ticket.id)
  );

  const hydratedItems: TicketHydrated[] = rawItems.map((ticket: Ticket) => {
    const stats = conversations.get(ticket.id);
    const salesTimeline = salesTimelineMap.get(ticket.id) ?? [];
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
  });

  const metrics = options.includeMetrics ? calculateInboxMetrics(rawItems, conversations, leads) : undefined;

  const response: TicketListResult = {
    ...baseResult,
    items: hydratedItems,
  };

  if (metrics !== undefined) {
    response.metrics = metrics;
  }

  return response;
};
