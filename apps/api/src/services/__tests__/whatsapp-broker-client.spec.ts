import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Request as ExpressRequest } from 'express';
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
    delete process.env.BROKER_MODE;
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
    expect(firstUrl).toBe('https://broker.test/instances/session-legacy/logout');

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
    expect(url).toBe('https://broker.test/instances/session-qr/qr.png');
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

  it('connects session via broker endpoints when BROKER_MODE is broker', async () => {
    process.env.BROKER_MODE = 'broker';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.connectInstance('session-001', {
      instanceId: 'custom-session',
      webhookUrl: 'https://hooks.test/whatsapp',
      forceReopen: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/broker/session/connect');

    const payload = JSON.parse(init?.body as string);
    expect(payload).toEqual({
      sessionId: 'session-001',
      instanceId: 'custom-session',
      webhookUrl: 'https://hooks.test/whatsapp',
      forceReopen: true,
    });
  });

  it('logs out session via instance routes when broker mode is disabled', async () => {
    delete process.env.BROKER_MODE;
    process.env.WHATSAPP_BROKER_DELIVERY_MODE = 'instances';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await whatsappBrokerClient.disconnectInstance('session-logout', {
      instanceId: 'custom-logout',
      wipe: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/session-logout/logout');
    expect(JSON.parse(init?.body as string)).toEqual({ instanceId: 'custom-logout', wipe: true });
  });

  it('retrieves status via broker session endpoint when BROKER_MODE is broker', async () => {
    process.env.BROKER_MODE = 'broker';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'connected', connected: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const status = await whatsappBrokerClient.getStatus('session-status');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/broker/session/status');
    expect(JSON.parse(init?.body as string)).toEqual({
      sessionId: 'session-status',
      instanceId: 'session-status',
    });
    expect(status.status).toBe('connected');
    expect(status.connected).toBe(true);
  });

  it('retrieves status via direct instance lookup when broker mode is not broker', async () => {
    delete process.env.BROKER_MODE;
    process.env.WHATSAPP_BROKER_DELIVERY_MODE = 'instances';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'disconnected', connected: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const status = await whatsappBrokerClient.getStatus('session-off', { instanceId: 'external' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/session-off/status?instanceId=external');
    expect(init?.method).toBe('GET');
    expect(status.status).toBe('disconnected');
    expect(status.connected).toBe(false);
  });

  it('converts QR image responses to base64 data URLs', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    fetchMock.mockResolvedValue(
      new Response(pngBuffer, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'x-qr-expires-at': '2024-01-01T00:00:00.000Z',
        },
      })
    );

    const qr = await whatsappBrokerClient.getQrCode('session-qr');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/session-qr/qr.png');
    expect(init?.method).toBe('GET');
    expect(qr.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(qr.qrExpiresAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('falls back to status when QR image is unavailable', async () => {
    process.env.WHATSAPP_BROKER_DELIVERY_MODE = 'instances';

    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ qr: 'fallback-qr', qrExpiresAt: '2024-01-02T00:00:00.000Z' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );

    const qr = await whatsappBrokerClient.getQrCode('session-qr-fallback');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(firstCall[0]).toBe('https://broker.test/instances/session-qr-fallback/qr.png');

    const secondCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondCall[0]).toBe('https://broker.test/instances/session-qr-fallback/status');
    expect(secondCall[1]?.method).toBe('GET');

    expect(qr.qr).toBe('fallback-qr');
    expect(qr.qrExpiresAt).toBe('2024-01-02T00:00:00.000Z');
  });

  it('wraps unexpected fetch failures into WhatsAppBrokerError', async () => {
    const { whatsappBrokerClient, WhatsAppBrokerError } = await import('../whatsapp-broker-client');

    fetchMock.mockRejectedValueOnce(new TypeError('Network unreachable'));

    let caught: unknown;
    try {
      await whatsappBrokerClient.sendMessage('instance-network-error', {
        to: '+551199999999',
        content: 'Hello',
        type: 'text',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(WhatsAppBrokerError);
    const brokerError = caught as WhatsAppBrokerError;
    expect(brokerError.code).toBe('BROKER_ERROR');
    expect(brokerError.status).toBe(502);
    expect(brokerError.message).toContain('Network unreachable');
    expect(brokerError.message).toContain('/instances/instance-network-error/send-text');
    expect(brokerError.stack ?? '').toContain('Caused by:');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wraps JSON parse failures into WhatsAppBrokerError', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient, WhatsAppBrokerError } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValueOnce(
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const thrown = await whatsappBrokerClient
      .sendMessage('instance-parse-error', {
        to: '+5511988888888',
        content: 'Teste',
        type: 'text',
      })
      .catch((error: unknown) => error as WhatsAppBrokerError);

    expect(thrown).toBeInstanceOf(WhatsAppBrokerError);
    expect(thrown.code).toBe('BROKER_ERROR');
    expect(thrown.status).toBe(502);
    expect(thrown.message).toContain('Unexpected error contacting WhatsApp broker');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a structured 502 response when the connect route fails unexpectedly', async () => {
    const createModelMock = () => ({
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    });

    const prismaMock = {
      whatsAppInstance: createModelMock(),
      campaign: createModelMock(),
      processedIntegrationEvent: createModelMock(),
      contact: createModelMock(),
      ticket: createModelMock(),
      user: createModelMock(),
      $transaction: vi.fn(),
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    };

    (prismaMock.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        return await callback(prismaMock as unknown);
      }
    );

    vi.doMock('../../middleware/auth', () => ({
      requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
    }));

    vi.doMock('../../middleware/validation', () => ({
      validateRequest: (_req: unknown, _res: unknown, next: () => void) => next(),
    }));

    vi.doMock('../../lib/prisma', () => ({
      prisma: prismaMock,
    }));

    vi.doMock('../../lib/socket-registry', () => ({
      emitToTenant: vi.fn(),
    }));

    vi.doMock('../../config/logger', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: () => ({
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        }),
      },
    }));

    vi.doMock('../../lib/metrics', () => ({
      whatsappHttpRequestsCounter: { inc: vi.fn() },
    }));

    const express = await import('express');
    const request = (await import('supertest')).default;
    const { whatsappBrokerClient, WhatsAppBrokerError } = await import('../whatsapp-broker-client');

    const connectSessionSpy = vi
      .spyOn(whatsappBrokerClient, 'connectSession')
      .mockRejectedValue(
        new WhatsAppBrokerError(
          'Unexpected error contacting WhatsApp broker for /broker/session/connect: simulated failure',
          'BROKER_ERROR',
          502,
          'req-789'
        )
      );

    const getSessionStatusSpy = vi
      .spyOn(whatsappBrokerClient, 'getSessionStatus')
      .mockResolvedValue({ status: 'connected', connected: true } as never);

    const { integrationsRouter } = await import('../../routes/integrations');
    const { errorHandler } = await import('../../middleware/error-handler');

    const app = express.default();
    app.use(express.json());
    app.use(((req, _res, next) => {
      (req as ExpressRequest).user = {
        id: 'user-1',
        tenantId: 'tenant-123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'ADMIN',
        isActive: true,
        permissions: [],
      };
      next();
    }) as express.RequestHandler);
    app.use('/api/integrations', integrationsRouter);
    app.use(errorHandler);

    const response = await request(app)
      .post('/api/integrations/whatsapp/session/connect')
      .send({ webhookUrl: 'https://hooks.test/whatsapp' });

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      error: {
        code: 'BROKER_ERROR',
        message: 'WhatsApp broker request failed',
        details: { requestId: 'req-789' },
      },
      path: '/api/integrations/whatsapp/session/connect',
      method: 'POST',
    });

    expect(connectSessionSpy).toHaveBeenCalledWith('tenant-123', {
      webhookUrl: 'https://hooks.test/whatsapp',
    });
    expect(getSessionStatusSpy).not.toHaveBeenCalled();

    connectSessionSpy.mockRestore();
    getSessionStatusSpy.mockRestore();
  });
});

