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

process.env.WHATSAPP_MODE = 'http';
process.env.WHATSAPP_BROKER_URL = 'https://broker.test';
process.env.WHATSAPP_BROKER_API_KEY = 'test-key';

describe('WhatsAppBrokerClient', () => {
  afterEach(() => {
    fetchMock.mockReset();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    process.env.WHATSAPP_MODE = 'http';
    process.env.WHATSAPP_BROKER_URL = 'https://broker.test';
    process.env.WHATSAPP_BROKER_API_KEY = 'test-key';
    delete process.env.WHATSAPP_BROKER_DELIVERY_MODE;
    delete process.env.WHATSAPP_BROKER_LEGACY_STRIP_PLUS;
  });

  it('dispatches via legacy instance routes when configured', async () => {
    process.env.WHATSAPP_BROKER_DELIVERY_MODE = 'instances';
    process.env.WHATSAPP_BROKER_LEGACY_STRIP_PLUS = 'true';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ messageId: 'wamid-123', status: 'queued', timestamp: '2024-05-01T10:00:00.000Z' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await whatsappBrokerClient.sendMessage('instance-041', {
      to: '+554499999999',
      content: 'Teste via legacy',
      type: 'text',
      previewUrl: true,
      externalId: 'custom-id',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-041/send-text');
    expect(init?.method).toBe('POST');

    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('test-key');
    expect(headers.get('content-type')).toBe('application/json');

    expect(typeof init?.body).toBe('string');
    const parsedBody = JSON.parse(init?.body as string);
    expect(parsedBody).toEqual({
      to: '554499999999',
      message: 'Teste via legacy',
      text: 'Teste via legacy',
      previewUrl: true,
      externalId: 'custom-id',
    });

    expect(result.externalId).toBe('wamid-123');
    expect(result.status).toBe('queued');
    expect(result.timestamp).toBe('2024-05-01T10:00:00.000Z');
    expect(result.raw).toEqual({
      messageId: 'wamid-123',
      status: 'queued',
      timestamp: '2024-05-01T10:00:00.000Z',
    });
  });

  it('dispatches via direct instance routes by default', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ externalId: 'wamid-999', status: 'SENT' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await whatsappBrokerClient.sendMessage('instance-900', {
      to: '+5511999999999',
      content: 'Olá via broker',
      type: 'text',
      metadata: { idempotencyKey: 'idem-900', custom: true },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-900/send-text');
    expect(init?.method).toBe('POST');

    const headers = init?.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('idem-900');
    expect(headers.get('x-api-key')).toBe('test-key');

    const parsed = JSON.parse(init?.body as string);
    expect(parsed).toEqual({
      sessionId: 'instance-900',
      instanceId: 'instance-900',
      to: '+5511999999999',
      type: 'text',
      message: 'Olá via broker',
      text: 'Olá via broker',
      metadata: { idempotencyKey: 'idem-900', custom: true },
    });
    expect(parsed).not.toHaveProperty('mediaUrl');

    expect(result.externalId).toBe('wamid-999');
    expect(result.status).toBe('SENT');
    expect(typeof result.timestamp).toBe('string');
  });

  it('dispatches media payloads via direct routes when available', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ externalId: 'wamid-321', status: 'SENT' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await whatsappBrokerClient.sendMessage('instance-media', {
      to: '+5511977777777',
      content: 'Confira o documento',
      type: 'document',
      mediaUrl: 'https://cdn.test/doc.pdf',
      mediaMimeType: 'application/pdf',
      mediaFileName: 'doc.pdf',
      metadata: { idempotencyKey: 'media-123' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-media/send-text');
    const headers = init?.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('media-123');

    const parsed = JSON.parse(init?.body as string);
    expect(parsed).toEqual({
      sessionId: 'instance-media',
      instanceId: 'instance-media',
      to: '+5511977777777',
      type: 'document',
      message: 'Confira o documento',
      mediaUrl: 'https://cdn.test/doc.pdf',
      mimeType: 'application/pdf',
      fileName: 'doc.pdf',
      caption: 'Confira o documento',
      metadata: { idempotencyKey: 'media-123' },
    });

    expect(result.externalId).toBe('wamid-321');
    expect(result.status).toBe('SENT');
  });

  it('falls back to broker routes when direct endpoint is unavailable', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ externalId: 'wamid-654', status: 'QUEUED' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    const result = await whatsappBrokerClient.sendMessage(
      'instance-fallback',
      {
        to: '+5511888888888',
        content: 'Mensagem com fallback',
        type: 'text',
      },
      'fallback-001'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstUrl).toBe('https://broker.test/instances/instance-fallback/send-text');
    const firstBody = JSON.parse(firstInit?.body as string);
    expect(firstBody).toMatchObject({
      sessionId: 'instance-fallback',
      instanceId: 'instance-fallback',
      to: '+5511888888888',
      type: 'text',
      message: 'Mensagem com fallback',
      text: 'Mensagem com fallback',
    });

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondUrl).toBe('https://broker.test/broker/messages');
    const headers = secondInit?.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('fallback-001');

    const secondBody = JSON.parse(secondInit?.body as string);
    expect(secondBody).toMatchObject({
      sessionId: 'instance-fallback',
      instanceId: 'instance-fallback',
      to: '+5511888888888',
      type: 'text',
      message: 'Mensagem com fallback',
      text: 'Mensagem com fallback',
    });

    expect(result.externalId).toBe('wamid-654');
    expect(result.status).toBe('QUEUED');
  });

  it('dispatches template payloads via direct routes', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ externalId: 'wamid-template', status: 'SENT' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await whatsappBrokerClient.sendMessage('instance-template', {
      to: '+5511999988888',
      type: 'template',
      template: { name: 'greeting_template', language: 'pt_BR' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/instance-template/send-text');

    const parsed = JSON.parse(init?.body as string);
    expect(parsed).toEqual({
      sessionId: 'instance-template',
      instanceId: 'instance-template',
      to: '+5511999988888',
      type: 'template',
      message: '',
      template: { name: 'greeting_template', language: 'pt_BR' },
    });

    expect(result.externalId).toBe('wamid-template');
    expect(result.status).toBe('SENT');
  });

  it('fetches events via broker route with query parameters', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [{ id: 'evt-001' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    await whatsappBrokerClient.fetchEvents({ instanceId: 'instance-71', limit: 25, cursor: 'cur-01' });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstUrl.pathname).toBe('/broker/events');
    expect(firstUrl.searchParams.get('instanceId')).toBe('instance-71');
    expect(firstUrl.searchParams.get('limit')).toBe('25');
    expect(firstUrl.searchParams.get('cursor')).toBe('cur-01');
  });

  it('acknowledges events via broker route when available', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await whatsappBrokerClient.ackEvents({ ids: ['evt-1', 'evt-2'], instanceId: 'instance-91' });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/broker/events/ack');
    expect(init?.method).toBe('POST');

    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('test-key');

    const parsedBody = JSON.parse(init?.body as string);
    expect(parsedBody).toEqual({ ids: ['evt-1', 'evt-2'], instanceId: 'instance-91' });
  });

  it('connects sessions via broker routes when delivery mode is broker', async () => {
    process.env.WHATSAPP_BROKER_DELIVERY_MODE = 'broker';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.connectSession('session-123', {
      webhookUrl: 'https://callbacks.test/whatsapp',
      forceReopen: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/broker/session/connect');
    expect(init?.method).toBe('POST');

    const parsedBody = JSON.parse(init?.body as string);
    expect(parsedBody).toEqual({
      sessionId: 'session-123',
      instanceId: 'session-123',
      webhookUrl: 'https://callbacks.test/whatsapp',
      forceReopen: true,
    });
  });

  it('falls back to legacy session routes when broker endpoints are unavailable', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await whatsappBrokerClient.connectSession('session-fallback', { webhookUrl: 'https://cb.test' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstUrl).toBe('https://broker.test/broker/session/connect');

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondUrl).toBe('https://broker.test/instances/session-fallback/connect');
    expect(secondInit?.method).toBe('POST');
    expect(JSON.parse(secondInit?.body as string)).toEqual({
      instanceId: 'session-fallback',
      webhookUrl: 'https://cb.test',
    });
  });

  it('retries broker session routes when legacy endpoints return 404', async () => {
    process.env.WHATSAPP_BROKER_DELIVERY_MODE = 'instances';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await whatsappBrokerClient.logoutSession('session-legacy', { instanceId: 'custom-session' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl] = fetchMock.mock.calls[0] as [string];
    expect(firstUrl).toBe('https://broker.test/instances/session-legacy/disconnect');

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondUrl).toBe('https://broker.test/broker/session/logout');
    expect(JSON.parse(secondInit?.body as string)).toEqual({
      sessionId: 'session-legacy',
      instanceId: 'custom-session',
    });
  });

  it('reads QR codes from broker session status payloads before legacy fallbacks', async () => {
    process.env.WHATSAPP_BROKER_DELIVERY_MODE = 'broker';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: {
            qr: 'qr-data',
            qrExpiresAt: '2024-05-02T10:00:00.000Z',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const qr = await whatsappBrokerClient.getQrCode('session-qr');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://broker.test/broker/session/status?sessionId=session-qr&instanceId=session-qr');
    expect(qr.qr).toBe('qr-data');
    expect(qr.qrExpiresAt).toBe('2024-05-02T10:00:00.000Z');
  });

  it('falls back to legacy status route when broker session status is unavailable', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'connected',
            connected: true,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );

    const status = await whatsappBrokerClient.getStatus('session-status');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl] = fetchMock.mock.calls[0] as [string];
    expect(firstUrl).toBe('https://broker.test/broker/session/status?sessionId=session-status&instanceId=session-status');

    const [secondUrl] = fetchMock.mock.calls[1] as [string];
    expect(secondUrl).toBe('https://broker.test/instances/session-status/status');
    expect(status.status).toBe('connected');
    expect(status.connected).toBe(true);
  });
});

