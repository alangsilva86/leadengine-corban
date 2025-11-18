import { describe, expect, it } from 'vitest';
import { ticketService, listTickets, sendMessage, createTicket } from '../../ticket-service';

describe('ticketService API surface', () => {
  it('maps query functions to ticketService.queries', () => {
    expect(ticketService.queries.listTickets).toBe(listTickets);
  });

  it('maps lifecycle functions to ticketService.lifecycle', () => {
    expect(ticketService.lifecycle.createTicket).toBe(createTicket);
  });

  it('maps messaging functions to ticketService.messaging', () => {
    expect(ticketService.messaging.sendMessage).toBe(sendMessage);
  });
});
