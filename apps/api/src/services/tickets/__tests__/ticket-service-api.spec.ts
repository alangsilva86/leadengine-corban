import { describe, expect, it } from 'vitest';
import { ticketService, listTickets, sendMessage, createTicket, normalizeBrokerStatus } from '../../ticket-service';

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

  it('re-exports normalizeBrokerStatus as a working function', () => {
    // messaging/index.ts reexportava de './send-message', que não o exporta: o binding chegava undefined.
    expect(typeof normalizeBrokerStatus).toBe('function');
    expect(normalizeBrokerStatus('DELIVERED')).toBe('DELIVERED');
  });
});
