import { beforeEach, describe, expect, it, vi } from 'vitest';

const getQueueStatsMock = vi.fn(() => ({ pending: 0 }));

vi.mock('../queue/event-queue', () => ({
  getWhatsAppEventQueueStats: getQueueStatsMock,
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

describe('whatsappEventPoller stub', () => {
  beforeEach(() => {
    vi.resetModules();
    getQueueStatsMock.mockReset();
    getQueueStatsMock.mockReturnValue({ pending: 0 });
  });

  it('starts without polling the broker', async () => {
    const { whatsappEventPoller, getWhatsAppEventPollerMetrics } = await import('../event-poller');

    await whatsappEventPoller.start();

    const metrics = getWhatsAppEventPollerMetrics();
    expect(metrics.running).toBe(true);
    expect(metrics.cursor).toBeNull();
  });

  it('stops gracefully and keeps metrics available', async () => {
    const { whatsappEventPoller, getWhatsAppEventPollerMetrics } = await import('../event-poller');

    await whatsappEventPoller.start();
    await whatsappEventPoller.stop();

    const metrics = getWhatsAppEventPollerMetrics();
    expect(metrics.running).toBe(false);
    expect(metrics.lastErrorMessage).toBeNull();
  });
});
