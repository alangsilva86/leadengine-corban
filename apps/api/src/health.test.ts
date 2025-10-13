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
    expect(payload.environment).toBe('test');
    expect(payload.storage).toBe('in-memory');
    expect(payload.whatsapp).toEqual({ mode: 'http', transportMode: 'http' });
  });

  it('marks status as degraded when WhatsApp transport is disabled', async () => {
    process.env.WHATSAPP_MODE = 'disabled';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

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
