import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestInit, Headers } from 'undici';

const fetchMock = vi.fn();

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof import('undici')>('undici');
  return {
    ...actual,
    fetch: fetchMock,
  };
});

const originalEnv = { ...process.env };

describe('WhatsAppBrokerClient', () => {
  afterEach(() => {
    fetchMock.mockReset();
    Object.assign(process.env, originalEnv);
  });

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    process.env.WHATSAPP_MODE = 'http';
    process.env.WHATSAPP_BROKER_URL = 'https://broker.test';
    process.env.WHATSAPP_BROKER_API_KEY = 'test-key';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-token';
    process.env.WHATSAPP_BROKER_WEBHOOK_URL = 'https://ticketzapi-production.up.railway.app/api/integrations/whatsapp/webhook';
  });

  it('sends text messages via the official send-text endpoint', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ externalId: 'wamid-001', status: 'SENT' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await whatsappBrokerClient.sendMessage('instance-1', {
      to: '+5511999998888',
      content: 'Olá!',
      type: 'text',
      metadata: { idempotencyKey: 'key-123' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-1/send-text');
    expect(init?.method).toBe('POST');

    const headers = init?.headers as Headers;
    expect(headers.get('X-API-Key')).toBe('test-key');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Idempotency-Key')).toBe('key-123');

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      sessionId: 'instance-1',
      instanceId: 'instance-1',
      to: '+5511999998888',
      type: 'text',
      message: 'Olá!',
      text: 'Olá!',
      metadata: { idempotencyKey: 'key-123' },
    });

    expect(result.externalId).toBe('wamid-001');
    expect(result.status).toBe('SENT');
  });

  it('wraps broker failures in WhatsAppBrokerError with brokerStatus metadata', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient, WhatsAppBrokerError } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'failed' } }), {
        status: 500,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-42' },
      })
    );

    await expect(() =>
      whatsappBrokerClient.sendMessage('instance-err', {
        to: '+551100000000',
        content: 'fail',
        type: 'text',
      })
    ).rejects.toMatchObject({
      constructor: WhatsAppBrokerError,
      status: 502,
      brokerStatus: 500,
      requestId: 'req-42',
      code: 'BROKER_ERROR',
    });
  });

  it('creates instances using the official payload', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'crm-instance' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );

    await whatsappBrokerClient.createInstance({
      tenantId: 'tenant-1',
      name: 'CRM Principal',
      instanceId: 'crm-instance',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances');

    const headers = init?.headers as Headers;
    expect(headers.get('X-API-Key')).toBe('test-key');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Accept')).toBe('application/json');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      id: 'crm-instance',
      webhookUrl: 'https://ticketzapi-production.up.railway.app/api/integrations/whatsapp/webhook',
      verifyToken: 'verify-token',
    });
  });

  it('lists instances via GET /instances with tenant filter applied', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          instances: [
            {
              id: 'inst-1',
              name: 'Operação Principal',
              tenantId: 'tenant-1',
              status: { status: 'connected', connected: true },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await whatsappBrokerClient.listInstances('tenant-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances?tenantId=tenant-1');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual([
      {
        instance: expect.objectContaining({
          id: 'inst-1',
          tenantId: 'tenant-1',
          name: 'Operação Principal',
          status: 'connected',
          connected: true,
        }),
        status: expect.objectContaining({
          status: 'connected',
          connected: true,
        }),
      },
    ]);
  });

  it('pairs instances via POST /instances/:id/pair', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.connectInstance('broker-55', {
      instanceId: 'crm-instance',
      code: '123-456',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/crm-instance/pair');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ code: '123-456' });
  });

  it('pairs instances without code using empty payload', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.connectInstance('broker-55', {
      instanceId: 'crm-instance',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/crm-instance/pair');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('logs out instances using POST /instances/:id/logout sem payload extra', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.logoutSession('broker-10', { instanceId: 'crm-instance' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/crm-instance/logout');
    expect(init?.body).toBeUndefined();
  });

  it('wipe session using POST /instances/:id/session/wipe', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.wipeSession('broker-10', { instanceId: 'crm-instance' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/crm-instance/session/wipe');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('disconnects instance with optional wipe sequenciando logout e wipe', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.disconnectInstance('broker-77', {
      instanceId: 'crm-instance',
      wipe: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [logoutUrl, logoutInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [wipeUrl, wipeInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(logoutUrl).toBe('https://broker.test/instances/crm-instance/logout');
    expect(logoutInit?.method).toBe('POST');
    expect(wipeUrl).toBe('https://broker.test/instances/crm-instance/session/wipe');
    expect(wipeInit?.method).toBe('POST');
  });

  it('retrieves status via GET /instances/:id/status', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'connected' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    await whatsappBrokerClient.getSessionStatus('broker-10');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/broker-10/status');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('checks contact existence via POST /instances/:id/exists', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ exists: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await whatsappBrokerClient.checkRecipient({
      sessionId: 'instance-1',
      to: '+5511999999999',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-1/exists');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Headers;
    expect(headers.get('Accept')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      sessionId: 'instance-1',
      instanceId: 'instance-1',
      to: '+5511999999999',
    });
    expect(result).toEqual({ exists: true });
  });

  it('retrieves groups via GET /instances/:id/groups', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ groups: [{ id: '123', name: 'Squad' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await whatsappBrokerClient.getGroups({ sessionId: 'instance-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-1/groups');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual({ groups: [{ id: '123', name: 'Squad' }] });
  });

  it('retrieves metrics via GET /instances/:id/metrics', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messages: { sent: 10 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await whatsappBrokerClient.getMetrics({ sessionId: 'instance-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-1/metrics');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result).toEqual({ messages: { sent: 10 } });
  });

  it('creates polls via POST /instances/:id/send-poll', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'poll-001',
          status: 'sent',
          ack: 'server',
          rate: { latencyMs: 120 },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await whatsappBrokerClient.createPoll({
      sessionId: 'instance-1',
      to: '+5511999999999',
      question: 'Qual opção prefere?',
      options: ['Opção A', 'Opção B', 'Opção C'],
      allowMultipleAnswers: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-1/send-poll');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      sessionId: 'instance-1',
      instanceId: 'instance-1',
      to: '+5511999999999',
      question: 'Qual opção prefere?',
      options: ['Opção A', 'Opção B', 'Opção C'],
      selectableCount: 3,
    });

    expect(result).toEqual({
      id: 'poll-001',
      status: 'sent',
      ack: 'server',
      rate: { latencyMs: 120 },
      raw: {
        id: 'poll-001',
        status: 'sent',
        ack: 'server',
        rate: { latencyMs: 120 },
      },
    });
  });

  it('fetches events through /health returning envelope vazio', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', queue: { pending: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const payload = await whatsappBrokerClient.fetchEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/health');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(payload).toEqual({
      events: [],
      health: { status: 'ok', queue: { pending: 0 } },
    });
  });

  it('wraps network failures into WhatsAppBrokerError with BROKER_ERROR', async () => {
    const { whatsappBrokerClient, WhatsAppBrokerError } = await import('../whatsapp-broker-client');

    fetchMock.mockRejectedValue(new TypeError('network down'));

    await expect(() =>
      whatsappBrokerClient.sendText({
        sessionId: 'instance-1',
        to: '+5511999999999',
        message: 'oi',
      })
    ).rejects.toMatchObject({
      constructor: WhatsAppBrokerError,
      code: 'BROKER_ERROR',
      status: 502,
    });
  });
});
