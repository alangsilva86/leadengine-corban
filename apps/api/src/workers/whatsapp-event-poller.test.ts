import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchEvents = vi.fn();
const ackEvents = vi.fn();
const enqueueWhatsAppBrokerEvents = vi.fn();

const integrationStateFindUnique = vi.fn();
const integrationStateUpsert = vi.fn();
const processedIntegrationEventFindMany = vi.fn();
const processedIntegrationEventCreateMany = vi.fn();
const processedIntegrationEventDeleteMany = vi.fn();

vi.mock('../config/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../services/whatsapp-broker-client', () => ({
  whatsappBrokerClient: {
    fetchEvents,
    ackEvents,
  },
  WhatsAppBrokerNotConfiguredError: class extends Error {},
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    integrationState: {
      findUnique: integrationStateFindUnique,
      upsert: integrationStateUpsert,
    },
    processedIntegrationEvent: {
      findMany: processedIntegrationEventFindMany,
      createMany: processedIntegrationEventCreateMany,
      deleteMany: processedIntegrationEventDeleteMany,
    },
  },
}));

vi.mock('./whatsapp-event-queue', async () => {
  const actual = await vi.importActual<typeof import('./whatsapp-event-queue')>('./whatsapp-event-queue');
  return {
    ...actual,
    enqueueWhatsAppBrokerEvents,
    getWhatsAppEventQueueStats: () => ({ pending: 0 }),
  };
});

describe('WhatsApp event poller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes broker items and acknowledges them', async () => {
    fetchEvents.mockResolvedValueOnce({
      items: [
        {
          id: 'evt-1',
          type: 'MESSAGE_INBOUND',
          payload: { text: 'hello' },
          tenantId: 'tenant-1',
          sessionId: 'session-1',
        },
        {
          id: 'evt-2',
          type: 'MESSAGE_OUTBOUND',
          payload: { text: 'bye' },
        },
      ],
      nextId: ' cursor-2 ',
    });
    ackEvents.mockResolvedValueOnce(undefined);
    processedIntegrationEventFindMany.mockResolvedValueOnce([]);
    processedIntegrationEventCreateMany.mockResolvedValueOnce({ count: 2 });
    integrationStateUpsert.mockResolvedValue(undefined);

    const module = await import('./whatsapp-event-poller');
    const poller = new (module.whatsappEventPoller as unknown as { constructor: new () => unknown }).constructor() as Record<string, unknown>;

    const processedCount = await (poller as { pollOnce: () => Promise<number> }).pollOnce();

    expect(processedCount).toBe(2);
    expect(fetchEvents).toHaveBeenCalledWith({ limit: 50, cursor: undefined });
    expect(processedIntegrationEventFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['evt-1', 'evt-2'] },
        source: 'whatsapp-broker',
      },
      select: { id: true },
    });
    expect(processedIntegrationEventCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ id: 'evt-1', payload: expect.anything() }),
        expect.objectContaining({ id: 'evt-2', payload: expect.anything() }),
      ]),
      skipDuplicates: true,
    });
    expect(enqueueWhatsAppBrokerEvents).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'evt-1', type: 'MESSAGE_INBOUND' }),
      expect.objectContaining({ id: 'evt-2', type: 'MESSAGE_OUTBOUND' }),
    ]);
    expect(ackEvents).toHaveBeenCalledTimes(1);
    expect(ackEvents).toHaveBeenCalledWith({ ids: ['evt-1', 'evt-2'] });

    expect(integrationStateUpsert).toHaveBeenCalledWith({
      where: { key: 'whatsapp:last-ack' },
      create: expect.objectContaining({
        key: 'whatsapp:last-ack',
        value: expect.objectContaining({ cursor: 'cursor-2', count: 2 }),
      }),
      update: expect.objectContaining({
        value: expect.objectContaining({ cursor: 'cursor-2', count: 2 }),
      }),
    });

    expect(integrationStateUpsert).toHaveBeenCalledWith({
      where: { key: 'whatsapp:event-cursor' },
      create: expect.objectContaining({ value: { cursor: 'cursor-2' } }),
      update: { value: { cursor: 'cursor-2' } },
    });
  });
});
