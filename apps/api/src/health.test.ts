import { afterEach, describe, expect, it } from 'vitest';
import { refreshWhatsAppEnv } from './config/whatsapp';

afterEach(() => {
  delete process.env.WHATSAPP_MODE;
  delete process.env.DATABASE_URL;
  refreshWhatsAppEnv();
});

describe('buildHealthPayload', () => {
  it('returns base health information for the API', async () => {
    process.env.WHATSAPP_MODE = 'http';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'test' });

    expect(payload.status).toBe('ok');
    expect(payload.whatsapp.runtime.status).toBe('disabled');
    expect(payload.whatsapp.runtime.disabled).toBe(true);
    expect(payload.environment).toBe('test');
    expect(payload.storage).toBe('in-memory');
    expect(payload.whatsapp).toEqual({ mode: 'http', transportMode: 'http' });
  });

  it('marks status as degraded when WhatsApp transport is disabled', async () => {
    process.env.WHATSAPP_MODE = 'disabled';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

    expect(payload.status).toBe('ok');
    expect(payload.whatsapp.runtime.status).toBe('running');
    expect(payload.whatsapp.runtime.mode).toBe('http');
    expect(payload.whatsapp.runtime.transport).toBe('http');
  });

  it('degrades health when poller has repeated failures', async () => {
    process.env.WHATSAPP_MODE = 'http';
    refreshWhatsAppEnv();
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
    expect(payload.whatsapp.runtime.status).toBe('error');
    expect(payload.whatsapp.runtime.disabled).toBe(false);
  });

  it('marks poller as inactive when WhatsApp mode is not HTTP', async () => {
    process.env.WHATSAPP_MODE = 'baileys';
    refreshWhatsAppEnv();
    mockPollerMetrics(withMetrics({ running: false }));

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'qa' });

    expect(payload.status).toBe('ok');
    expect(payload.whatsapp.runtime.status).toBe('inactive');
    expect(payload.whatsapp.runtime.mode).toBe('baileys');
    expect(payload.whatsapp.runtime.transport).toBe('sidecar');
    expect(payload.status).toBe('degraded');
    expect(payload.whatsapp.transportMode).toBe('disabled');
    expect(payload.whatsapp.mode).toBe('disabled');
  });

  it('reports postgres storage when database url is configured', async () => {
    process.env.DATABASE_URL = 'postgresql://ticketz:password@localhost:5432/ticketz';
    process.env.WHATSAPP_MODE = 'sidecar';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

    expect(payload.storage).toBe('postgres/prisma');
    expect(payload.whatsapp.transportMode).toBe('sidecar');
  });
});
