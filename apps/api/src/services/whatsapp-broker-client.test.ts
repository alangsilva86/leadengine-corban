import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

const importClientWithMock = async (fetchMock: ReturnType<typeof vi.fn>) => {
  vi.doMock('undici', () => ({ fetch: fetchMock }));
  const module = await import('./whatsapp-broker-client');
  return module.whatsappBrokerClient;
};

describe('WhatsAppBrokerClient#createInstance', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.WHATSAPP_BROKER_URL = 'https://broker.example.com';
    process.env.WHATSAPP_BROKER_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.doUnmock('undici');
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('includes webhookUrl when provided', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'tenant--support' }),
    }));

    const client = await importClientWithMock(fetchMock);

    await client.createInstance({
      tenantId: 'Tenant 123',
      name: 'Support Team',
      webhookUrl: ' https://example.com/webhook ',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body).toMatchObject({
      webhookUrl: 'https://example.com/webhook',
    });
  });

  it('omits webhookUrl when not provided', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'tenant--support' }),
    }));

    const client = await importClientWithMock(fetchMock);

    await client.createInstance({
      tenantId: 'Tenant 456',
      name: 'Outbound',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body).not.toHaveProperty('webhookUrl');
  });
});
