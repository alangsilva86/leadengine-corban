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
    expect(url).toBe('https://broker.test/instances/instance-900/messages');
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
    expect(url).toBe('https://broker.test/instances/instance-media/messages');
    const headers = init?.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('media-123');

    const parsed = JSON.parse(init?.body as string);
    expect(parsed).toEqual({
      sessionId: 'instance-media',
      instanceId: 'instance-media',
      to: '+5511977777777',
      type: 'document',
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
    const [firstUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstUrl).toBe('https://broker.test/instances/instance-fallback/messages');
    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondUrl).toBe('https://broker.test/broker/messages');
    const headers = secondInit?.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('fallback-001');

    const parsedBody = JSON.parse(secondInit?.body as string);
    expect(parsedBody).toEqual({
      sessionId: 'instance-fallback',
      instanceId: 'instance-fallback',
      to: '+5511888888888',
      type: 'text',
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
    expect(url).toBe('https://broker.test/instances/instance-template/messages');

    const parsed = JSON.parse(init?.body as string);
    expect(parsed).toEqual({
      sessionId: 'instance-template',
      instanceId: 'instance-template',
      to: '+5511999988888',
      type: 'template',
      template: { name: 'greeting_template', language: 'pt_BR' },
    });

    expect(result.externalId).toBe('wamid-template');
    expect(result.status).toBe('SENT');
  });

  it('prefers direct instance event routes and falls back gracefully', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ events: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    await whatsappBrokerClient.fetchEvents({ instanceId: 'instance-71', limit: 25, cursor: 'cur-01' });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstUrl.pathname).toBe('/instances/instance-71/events');

    const secondUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(secondUrl.pathname).toBe('/instances/events');
    expect(secondUrl.searchParams.get('instanceId')).toBe('instance-71');
    expect(secondUrl.searchParams.get('limit')).toBe('25');
    expect(secondUrl.searchParams.get('cursor')).toBe('cur-01');
  });

  it('acknowledges events using direct routes with tenant fallback', async () => {
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

    await whatsappBrokerClient.ackEvents({ ids: ['evt-1', 'evt-2'], instanceId: 'instance-91' });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstAckUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstAckUrl.pathname).toBe('/instances/instance-91/events/ack');

    const secondAckUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(secondAckUrl.pathname).toBe('/instances/events/ack');
    const secondBody = fetchMock.mock.calls[1][1]?.body as string;
    expect(JSON.parse(secondBody)).toEqual({ ids: ['evt-1', 'evt-2'], instanceId: 'instance-91' });
  });
});

