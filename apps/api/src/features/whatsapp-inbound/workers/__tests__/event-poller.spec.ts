import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchEventsMock = vi.fn();
const ackEventsMock = vi.fn();
const enqueueEventsMock = vi.fn();
const getQueueStatsMock = vi.fn(() => ({ pending: 0 }));
const normalizeEnvelopeMock = vi.fn();
const normalizeEventMock = vi.fn((event) => event);
const integrationStateUpsertMock = vi.fn();
const integrationStateFindUniqueMock = vi.fn();
const processedFindManyMock = vi.fn();
const processedCreateManyMock = vi.fn();
const processedDeleteManyMock = vi.fn();
const transactionMock = vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations));

vi.mock('../../../../services/whatsapp-broker-client', () => ({
  WhatsAppBrokerNotConfiguredError: class extends Error {},
  whatsappBrokerClient: {
    fetchEvents: fetchEventsMock,
    ackEvents: ackEventsMock,
  },
}));

vi.mock('../queue/event-queue', () => ({
  enqueueWhatsAppBrokerEvents: enqueueEventsMock,
  getWhatsAppEventQueueStats: getQueueStatsMock,
  normalizeWhatsAppBrokerEvent: normalizeEventMock,
}));

vi.mock('../event-normalizer', async () => {
  const actual = await vi.importActual<typeof import('../event-normalizer')>('../event-normalizer');
  return {
    ...actual,
    normalizeBrokerEventEnvelope: normalizeEnvelopeMock,
  };
});

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
    integrationState: {
      upsert: integrationStateUpsertMock,
      findUnique: integrationStateFindUniqueMock,
    },
    processedIntegrationEvent: {
      findMany: processedFindManyMock,
      createMany: processedCreateManyMock,
      deleteMany: processedDeleteManyMock,
    },
  },
}));

const resetMocks = (): void => {
  fetchEventsMock.mockReset();
  ackEventsMock.mockReset();
  enqueueEventsMock.mockReset();
  getQueueStatsMock.mockReset();
  getQueueStatsMock.mockReturnValue({ pending: 0 });
  normalizeEnvelopeMock.mockReset();
  normalizeEventMock.mockReset();
  normalizeEventMock.mockImplementation((event) => event);
  integrationStateUpsertMock.mockReset();
  integrationStateUpsertMock.mockResolvedValue(undefined);
  integrationStateFindUniqueMock.mockReset();
  integrationStateFindUniqueMock.mockResolvedValue(null);
  processedFindManyMock.mockReset();
  processedFindManyMock.mockResolvedValue([]);
  processedCreateManyMock.mockReset();
  processedCreateManyMock.mockResolvedValue({ count: 0 });
  processedDeleteManyMock.mockReset();
  processedDeleteManyMock.mockResolvedValue({ count: 0 });
  transactionMock.mockReset();
  transactionMock.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
};

const createPoller = async () => {
  const module = await import('../event-poller');
  const PollerClass = (module.whatsappEventPoller as unknown as { constructor: new () => unknown }).constructor as new () => unknown;
  const poller = new PollerClass() as Record<string, unknown>;
  poller.stateLoaded = true;
  return poller;
};

describe('whatsapp event poller', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('requests broker events with cursor and instance identifiers', async () => {
    fetchEventsMock.mockResolvedValueOnce({
      events: [],
      meta: { nextCursor: 'cursor-101', instanceId: 'instance-abc' },
    });

    const poller = await createPoller();
    (poller as Record<string, unknown>).cursor = 'cursor-100';
    (poller as Record<string, unknown>).cursorInstanceId = 'instance-abc';

    const processed = await (poller as { pollOnce: () => Promise<number> }).pollOnce();

    expect(processed).toBe(0);
    expect(fetchEventsMock).toHaveBeenCalledTimes(1);
    expect(fetchEventsMock).toHaveBeenCalledWith({
      limit: 50,
      cursor: 'cursor-100',
      instanceId: 'instance-abc',
    });
  });

  it('acknowledges events with the corresponding instance identifier', async () => {
    fetchEventsMock.mockResolvedValueOnce({
      events: [{ ack: 'raw-ack' }],
      meta: { nextCursor: 'cursor-201', instanceId: 'instance-201' },
    });

    normalizeEnvelopeMock.mockReturnValue({
      ackId: 'ack-201',
      cursor: 'cursor-200',
      instanceId: 'instance-201',
      event: { id: 'event-201', cursor: 'cursor-200', instanceId: 'instance-201' },
    });

    normalizeEventMock.mockImplementation((event) => ({
      ...event,
    }));

    const poller = await createPoller();

    const processed = await (poller as { pollOnce: () => Promise<number> }).pollOnce();

    expect(processed).toBe(1);
    expect(ackEventsMock).toHaveBeenCalledTimes(1);
    expect(ackEventsMock).toHaveBeenCalledWith({
      ids: ['ack-201'],
      instanceId: 'instance-201',
    });
  });
});

