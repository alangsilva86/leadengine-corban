import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';

const fetchEventsMock = vi.fn<(...args: any[]) => Promise<unknown>>();
const loadCursorMock = vi.fn<() => Promise<string | null>>();
const saveCursorMock = vi.fn<(cursor: string | null) => Promise<void>>();

vi.mock('../../../../services/whatsapp-broker-client', () => ({
  whatsappBrokerClient: {
    fetchEvents: fetchEventsMock,
  },
}));

vi.mock('../event-poller-state', () => ({
  loadPollerCursor: loadCursorMock,
  savePollerCursor: saveCursorMock,
}));

vi.mock('../../../../config/logger', async () => {
  const actual = await vi.importActual<typeof import('../../../../config/logger')>(
    '../../../../config/logger'
  );
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

const createRawEvent = (id: number) => ({
  id: `ack-${id}`,
  cursor: `cursor-${id}`,
  event: {
    id: `event-${id}`,
    type: 'MESSAGE_INBOUND',
    instanceId: 'inst-1',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      instanceId: 'inst-1',
      timestamp: '2024-01-01T00:00:00.000Z',
      contact: { phone: '+5511999999999', name: 'Cliente Teste' },
      message: { text: 'Olá', type: 'text' },
      metadata: {},
    },
  },
});

const webhookQueueEvent = {
  id: 'webhook-1',
  type: 'MESSAGE_INBOUND' as const,
  payload: {
    instanceId: 'inst-2',
    message: { text: 'Webhook', type: 'text' },
    contact: { phone: '+5511888888888', name: 'Webhook' },
    metadata: {},
  },
};

const flushAsync = async (ms = 0) => {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
};

describe('WhatsApp broker event poller integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    fetchEventsMock.mockReset();
    loadCursorMock.mockReset();
    saveCursorMock.mockReset();
    loadCursorMock.mockResolvedValue(null);
    saveCursorMock.mockResolvedValue(undefined);
    delete process.env.WHATSAPP_EVENT_POLLER_DISABLED;
    process.env.WHATSAPP_MODE = 'http';
    refreshWhatsAppEnv();
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchEventsMock.mockReset();
    loadCursorMock.mockReset();
    saveCursorMock.mockReset();
    delete process.env.WHATSAPP_MODE;
    delete process.env.WHATSAPP_EVENT_POLLER_DISABLED;
    refreshWhatsAppEnv();
  });

  it('persists cursors and stops cleanly on shutdown', async () => {
    fetchEventsMock.mockResolvedValueOnce({
      events: [createRawEvent(1)],
      nextCursor: 'cursor-1',
    });
    fetchEventsMock.mockResolvedValueOnce({
      events: [],
      nextCursor: 'cursor-1',
    });

    const queueModule = await import('../../queue/event-queue');
    const enqueueSpy = vi.spyOn(queueModule, 'enqueueWhatsAppBrokerEvents');

    const { WhatsAppEventPoller } = await import('../event-poller');
    const poller = new WhatsAppEventPoller();

    await poller.start();

    await flushAsync();
    await flushAsync(250);
    await flushAsync();

    await poller.stop();

    expect(fetchEventsMock).toHaveBeenCalledTimes(2);
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'event-1', type: 'MESSAGE_INBOUND' }),
      ])
    );
    expect(saveCursorMock).toHaveBeenCalledWith('cursor-1');

    enqueueSpy.mockRestore();

    const metrics = poller.getMetrics();
    expect(metrics.running).toBe(false);
    expect(metrics.cursor).toBe('cursor-1');
    expect(metrics.lastAckCursor).toBe('cursor-1');
    expect(metrics.lastAckCount).toBeGreaterThan(0);
  });

  it('coexists with webhook delivery and processes both sources', async () => {
    fetchEventsMock.mockResolvedValueOnce({
      events: [createRawEvent(2)],
      nextCursor: 'cursor-2',
    });
    fetchEventsMock.mockResolvedValueOnce({ events: [], nextCursor: 'cursor-2' });

    const queueModule = await import('../../queue/event-queue');
    const { enqueueWhatsAppBrokerEvents, whatsappEventQueueEmitter } = queueModule;

    const processedIds: string[] = [];
    const onProcessed = (event: { id: string }) => {
      processedIds.push(event.id);
    };
    whatsappEventQueueEmitter.on('processed', onProcessed);

    const { WhatsAppEventPoller } = await import('../event-poller');
    const poller = new WhatsAppEventPoller();

    await poller.start();

    await flushAsync();
    await flushAsync(250);
    await flushAsync();

    enqueueWhatsAppBrokerEvents([
      {
        id: webhookQueueEvent.id,
        type: webhookQueueEvent.type,
        instanceId: webhookQueueEvent.payload.instanceId,
        timestamp: '2024-01-01T00:00:01.000Z',
        payload: webhookQueueEvent.payload,
      },
    ]);

    await flushAsync();
    await flushAsync();

    await poller.stop();

    whatsappEventQueueEmitter.off('processed', onProcessed);

    expect(processedIds).toContain('event-2');
    expect(processedIds).toContain('webhook-1');
    expect(saveCursorMock).toHaveBeenCalledWith('cursor-2');
  });

  it('does not start when mode is sidecar', async () => {
    process.env.WHATSAPP_MODE = 'sidecar';
    refreshWhatsAppEnv();

    const { WhatsAppEventPoller } = await import('../event-poller');
    const poller = new WhatsAppEventPoller();

    await poller.start();
    await flushAsync();

    expect(fetchEventsMock).not.toHaveBeenCalled();
    expect(poller.getMetrics().running).toBe(false);
  });

  it('does not start when runtime flag disables the event poller', async () => {
    process.env.WHATSAPP_EVENT_POLLER_DISABLED = 'true';
    refreshWhatsAppEnv();

    const { WhatsAppEventPoller } = await import('../event-poller');
    const poller = new WhatsAppEventPoller();

    await poller.start();
    await flushAsync();

    expect(fetchEventsMock).not.toHaveBeenCalled();
    expect(poller.getMetrics().running).toBe(false);
  });
});
