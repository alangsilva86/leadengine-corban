import { afterEach, describe, expect, it } from 'vitest';

import { refreshWhatsAppEnv } from './config/whatsapp';

const resetEnv = () => {
  delete process.env.WHATSAPP_MODE;
  delete process.env.STORAGE_BACKEND;
  delete process.env.DATABASE_URL;
  refreshWhatsAppEnv();
};

afterEach(() => {
  resetEnv();
});

describe('buildHealthPayload', () => {
  it('returns basic health information for the API', async () => {
    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'test' });

    expect(payload.status).toBe('ok');
    expect(payload.environment).toBe('test');
    expect(payload.storage).toBe('in-memory');
    expect(payload.whatsapp.mode).toBe('http');
    expect(payload.whatsapp.transportMode).toBe('http');
    expect(payload.whatsapp.runtime).toEqual({
      status: 'running',
      mode: 'http',
      transport: 'http',
      disabled: false,
    });
  });

  it('marks status as degraded when WhatsApp transport is disabled', async () => {
    process.env.WHATSAPP_MODE = 'disabled';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

    expect(payload.status).toBe('degraded');
    expect(payload.whatsapp.transportMode).toBe('disabled');
    expect(payload.whatsapp.runtime).toEqual({
      status: 'disabled',
      mode: 'disabled',
      transport: 'disabled',
      disabled: true,
    });
  });

  it('uses the configured raw mode when available', async () => {
    process.env.WHATSAPP_MODE = 'sidecar';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'qa' });

    expect(payload.status).toBe('ok');
    expect(payload.whatsapp.mode).toBe('sidecar');
    expect(payload.whatsapp.transportMode).toBe('sidecar');
    expect(payload.whatsapp.runtime).toEqual({
      status: 'running',
      mode: 'sidecar',
      transport: 'sidecar',
      disabled: false,
    });
  });

  it('detects prisma-backed storage from environment variables', async () => {
    process.env.DATABASE_URL = 'postgresql://ticketz:password@localhost:5432/ticketz';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

    expect(payload.storage).toBe('postgres/prisma');
  });

  it('identifies non-postgres databases as prisma storage', async () => {
    process.env.DATABASE_URL = 'mysql://ticketz:password@localhost:3306/ticketz';
    refreshWhatsAppEnv();

    const { buildHealthPayload } = await import('./health');
    const payload = buildHealthPayload({ environment: 'production' });

    expect(payload.storage).toBe('database/prisma');
  });
});
