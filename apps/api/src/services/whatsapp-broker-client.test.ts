import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestInit } from 'undici';

const fetchMock = vi.fn<Promise<unknown>, [string, RequestInit?]>();

vi.mock('undici', () => ({
  fetch: fetchMock,
}));

const createJsonResponse = (status: number, body: unknown = {}): Response => {
  const jsonBody = status === 204 ? undefined : body;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => jsonBody,
    text: async () => (jsonBody === undefined ? '' : JSON.stringify(jsonBody)),
  } as Response;
};

describe('WhatsAppBrokerClient (minimal broker)', () => {
  const originalEnv = { ...process.env };

  const loadClient = async () => {
    const module = await import('./whatsapp-broker-client');
    return module.whatsappBrokerClient;
  };

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();

    process.env.WHATSAPP_MODE = 'http';
    process.env.WHATSAPP_BROKER_URL = 'https://broker.example';
    process.env.WHATSAPP_BROKER_API_KEY = 'broker-key';
    process.env.WHATSAPP_WEBHOOK_API_KEY = 'webhook-key';
    delete process.env.WHATSAPP_BROKER_TIMEOUT_MS;
  });

  afterEach(() => {
    fetchMock.mockReset();
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
    vi.useRealTimers();
  });

  it('connectSession sends payload with broker API key', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(200));
    const client = await loadClient();

    await client.connectSession('session-1', { webhookUrl: 'https://hooks.example', forceReopen: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/session/connect');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ sessionId: 'session-1', webhookUrl: 'https://hooks.example', forceReopen: true });
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('broker-key');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('listInstances fetches session status and normalizes metadata response', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        sessionId: 'instance-1',
        status: 'CONNECTED',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-02T00:00:00.000Z',
        metadata: {
          tenant_id: 'tenant-123',
          name: 'Main Instance',
          phone_number: '+5511987654321',
          userName: 'Agent Smith',
          stats: { sent: 10 },
        },
      })
    );

    const client = await loadClient();
    const instances = await client.listInstances('tenant-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/session/status');
    expect(init?.method).toBe('GET');
    expect((init?.headers as Headers).get('x-api-key')).toBe('tenant-123');

    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({
      id: 'instance-1',
      tenantId: 'tenant-123',
      name: 'Main Instance',
      status: 'connected',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastActivity: '2024-01-02T00:00:00.000Z',
      connected: true,
      phoneNumber: '+5511987654321',
      user: 'Agent Smith',
      stats: { sent: 10 },
    });
  });

  it('sendText posts message with broker API key header', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(200, { id: 'msg-1' }));
    const client = await loadClient();

    await client.sendText({ sessionId: 'session-1', to: '5511987654321', message: 'Hello' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/messages');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      sessionId: 'session-1',
      to: '5511987654321',
      message: 'Hello',
      type: 'text',
    });
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('broker-key');
  });

  it('createPoll posts payload to broker', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(201, { id: 'poll-1' }));
    const client = await loadClient();

    await client.createPoll({
      sessionId: 'session-1',
      to: '5511987654321',
      question: 'Qual opção?',
      options: ['A', 'B', 'C'],
      allowMultipleAnswers: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/polls');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      sessionId: 'session-1',
      to: '5511987654321',
      question: 'Qual opção?',
      options: ['A', 'B', 'C'],
      allowMultipleAnswers: true,
    });
  });

  it('getQrCode fetches QR payload from broker', async () => {
    const qrPayload = {
      qrCode: 'data:image/png;base64,REAL_QR',
      expiresAt: '2024-02-01T00:00:00.000Z',
    };

    fetchMock.mockResolvedValueOnce(createJsonResponse(200, qrPayload));
    const client = await loadClient();

    const result = await client.getQrCode('session-qr');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/session/qr?sessionId=session-qr');
    expect(init?.method).toBe('GET');
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('broker-key');
    expect(result).toEqual(qrPayload);
  });

  it('getQrCode falls back to static QR on timeout', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    fetchMock.mockImplementationOnce((_, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const client = await loadClient();
    const promise = client.getQrCode('session-timeout');

    await vi.advanceTimersByTimeAsync(20_000);

    const result = await promise;

    expect(result.qrCode).toMatch(/^data:image\/png;base64/);
    expect(result.expiresAt).toBe('2024-01-01T00:01:15.000Z');
  });

  it('fetchEvents uses webhook API key and query params', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(200, { events: [] }));
    const client = await loadClient();

    await client.fetchEvents({ limit: 10, cursor: 'abc' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/events?limit=10&cursor=abc');
    expect(init?.method).toBe('GET');
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('webhook-key');
  });

  it('ackEvents posts ids with webhook api key', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(204));
    const client = await loadClient();

    await client.ackEvents({ ids: ['evt-1', 'evt-2'] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/events/ack');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ ids: ['evt-1', 'evt-2'] });
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('webhook-key');
  });

  it('does not call ackEvents when ids list is empty', async () => {
    const client = await loadClient();

    await client.ackEvents({ ids: [] });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws WhatsAppBrokerError with broker code for failed requests', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(429, { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too fast' } })
    );
    const client = await loadClient();

    await expect(
      client.sendText({ sessionId: 'session-1', to: '5511987654321', message: 'Hello' })
    ).rejects.toMatchObject({
      name: 'WhatsAppBrokerError',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      message: 'Too fast',
    });
  });

  it('throws WhatsAppBrokerError with BROKER_AUTH on unauthorized', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(403, { error: { message: 'Forbidden' } })
    );
    const client = await loadClient();

    const promise = client.sendText({ sessionId: 'session-1', to: '5511987654321', message: 'Hello' });

    await expect(promise).rejects.toMatchObject({
      name: 'WhatsAppBrokerError',
      code: 'BROKER_AUTH',
      status: 502,
      message: 'Forbidden',
    });
  });

  it('aborts requests after the configured timeout', async () => {
    vi.useFakeTimers();
    process.env.WHATSAPP_BROKER_TIMEOUT_MS = '50';

    fetchMock.mockImplementationOnce((_, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const client = await loadClient();
    const promise = client.sendText({ sessionId: 'session-1', to: '5511987654321', text: 'Hello' });
    const expectation = expect(promise).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      name: 'WhatsAppBrokerError',
    });

    await vi.advanceTimersByTimeAsync(60);

    await expectation;
  });
});
