import { describe, expect, it } from 'vitest';

import mergeTicketIntoList from '../updateTicketsList.js';

const buildState = (items) => ({
  items,
  metrics: { total: items.length },
});

describe('mergeTicketIntoList', () => {
  it('repositions the updated ticket to the top when its lastMessageAt is the most recent', () => {
    const originalState = buildState([
      { id: 'ticket-1', lastMessageAt: '2024-01-01T10:00:00.000Z', contact: { name: 'Ana' } },
      { id: 'ticket-2', lastMessageAt: '2024-01-02T09:00:00.000Z', contact: { name: 'Bruno' } },
    ]);

    const result = mergeTicketIntoList(originalState, {
      id: 'ticket-1',
      lastMessageAt: '2024-01-03T08:00:00.000Z',
      unreadMessages: 1,
    });

    expect(result).not.toBe(originalState);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: 'ticket-1', unreadMessages: 1 });
    expect(result.items[1]).toMatchObject({ id: 'ticket-2' });

    // Ensure the original cache reference keeps the old value for comparison purposes
    expect(originalState.items[0].lastMessageAt).toBe('2024-01-01T10:00:00.000Z');
  });

  it('adds new tickets to the list and keeps them sorted by lastMessageAt desc', () => {
    const originalState = buildState([
      { id: 'ticket-1', lastMessageAt: '2024-01-04T10:00:00.000Z' },
      { id: 'ticket-2', lastMessageAt: '2024-01-02T10:00:00.000Z' },
    ]);

    const result = mergeTicketIntoList(originalState, {
      id: 'ticket-3',
      lastMessageAt: '2024-01-03T10:00:00.000Z',
    });

    expect(result.items.map((ticket) => ticket.id)).toEqual([
      'ticket-1',
      'ticket-3',
      'ticket-2',
    ]);
  });
});
