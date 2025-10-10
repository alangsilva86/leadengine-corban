import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WhatsAppEventPollerMetrics } from './features/whatsapp-inbound/workers/event-poller';

const baseMetrics: WhatsAppEventPollerMetrics = {
  running: false,
  cursor: null,
  pendingQueue: 0,
  lastFetchAt: null,
  lastFetchCount: 0,
  lastAckAt: null,
  lastAckCursor: null,
  lastAckCount: 0,
  consecutiveFailures: 0,
  lastErrorAt: null,
  lastErrorMessage: null,
  backoffMs: 0,
};

const withMetrics = (overrides: Partial<WhatsAppEventPollerMetrics>): WhatsAppEventPollerMetrics => ({
  ...baseMetrics,
  ...overrides,
});

const mockPollerMetrics = (metrics: WhatsAppEventPollerMetrics) => {
  vi.doMock('./features/whatsapp-inbound/workers/event-poller', () => ({
    getWhatsAppEventPollerMetrics: () => metrics,
  }));
};

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  delete process.env.WHATSAPP_EVENT_POLLER_DISABLED;
  delete process.env.WHATSAPP_MODE;
  delete process.env.DATABASE_URL;
});

describe('buildHealthPayload', () => {
  it('marks poller as disabled when configuration disables the worker', async () => {
    process.env.WHATSAPP_EVENT_POLLER_DISABLED = 'true';
    process.env.WHATSAPP_MODE = 'http';
    mockPollerMetrics(withMetrics({ running: false }));

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'test' });

    expect(payload.status).toBe('ok');
    expect(payload.whatsappEventPoller.status).toBe('disabled');
    expect(payload.whatsappEventPoller.disabled).toBe(true);
    expect(payload.storage).toBe('in-memory');
  });

  it('reports running status when poller loop is active', async () => {
    process.env.WHATSAPP_MODE = 'http';
    mockPollerMetrics(
      withMetrics({ running: true, cursor: 'cursor-55', lastAckCursor: 'cursor-55', lastAckCount: 10 })
    );

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

    expect(payload.status).toBe('ok');
    expect(payload.whatsappEventPoller.status).toBe('running');
    expect(payload.whatsappEventPoller.mode).toBe('http');
  });

  it('degrades health when poller has repeated failures', async () => {
    process.env.WHATSAPP_MODE = 'http';
    mockPollerMetrics(
      withMetrics({
        running: false,
        consecutiveFailures: 3,
        lastErrorMessage: 'broker timeout',
        lastErrorAt: '2024-01-01T00:00:00.000Z',
      })
    );

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'staging' });

    expect(payload.status).toBe('degraded');
    expect(payload.whatsappEventPoller.status).toBe('error');
    expect(payload.whatsappEventPoller.disabled).toBe(false);
  });

  it('marks poller as inactive when WhatsApp mode is not HTTP', async () => {
    process.env.WHATSAPP_MODE = 'baileys';
    mockPollerMetrics(withMetrics({ running: false }));

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'qa' });

    expect(payload.status).toBe('ok');
    expect(payload.whatsappEventPoller.status).toBe('inactive');
    expect(payload.whatsappEventPoller.mode).toBe('baileys');
  });

  it('reports postgres storage when database url is configured', async () => {
    process.env.DATABASE_URL = 'postgresql://ticketz:password@localhost:5432/ticketz';
    process.env.WHATSAPP_MODE = 'http';
    mockPollerMetrics(withMetrics({ running: true }));

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

    expect(payload.storage).toBe('postgres/prisma');
    expect(payload.status).toBe('ok');
  });
});
