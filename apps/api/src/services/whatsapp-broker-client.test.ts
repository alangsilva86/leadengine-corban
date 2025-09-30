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
    expect(body).toEqual({ instanceId: 'session-1', webhookUrl: 'https://hooks.example', forceReopen: true });
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('broker-key');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('sendText posts message with broker API key header and extended payload', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(200, { ack: { id: 'msg-1', status: 'queued' } }));
    const client = await loadClient();

    await client.sendText({
      instanceId: 'session-1',
      to: '5511987654321',
      text: 'Hello',
      waitAckMs: 200,
      timeoutMs: 1000,
      skipNormalize: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/messages');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      instanceId: 'session-1',
      to: '5511987654321',
      text: 'Hello',
      waitAckMs: 200,
      timeoutMs: 1000,
      skipNormalize: true,
      type: 'text',
    });
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('broker-key');
  });

  it('createPoll posts payload to broker', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(201, { id: 'poll-1' }));
    const client = await loadClient();

    await client.createPoll({
      instanceId: 'session-1',
      to: '5511987654321',
      question: 'Qual opção?',
      options: ['A', 'B', 'C'],
      allowMultipleAnswers: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/polls');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      instanceId: 'session-1',
      to: '5511987654321',
      question: 'Qual opção?',
      options: ['A', 'B', 'C'],
      selectableCount: 3,
    });
  });

  it('fetchEvents uses webhook API key and query params', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(200, { items: [] }));
    const client = await loadClient();

    await client.fetchEvents({ limit: 10, cursor: 'abc' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/events?limit=10&after=abc');
    expect(init?.method).toBe('GET');
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('webhook-key');
  });

  it('fetchEvents normalizes broker response fields', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        items: [{ id: 'evt-1' }],
        nextCursor: 'cursor-2',
        pending: 5,
        ack: { received: true },
      })
    );
    const client = await loadClient();

    const response = await client.fetchEvents<{
      events: unknown[];
      nextCursor?: string | null;
      pending?: number;
      ack?: Record<string, unknown>;
    }>();

    expect(response.events).toEqual([{ id: 'evt-1' }]);
    expect(response.nextCursor).toBe('cursor-2');
    expect(response.pending).toBe(5);
    expect(response.ack).toEqual({ received: true });
  });

  it('ackEvents posts ids with webhook api key', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(204));
    const client = await loadClient();

    await client.ackEvents(['evt-1', 'evt-2']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/events/ack');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ ids: ['evt-1', 'evt-2'] });
    const headers = init?.headers as Headers;
    expect(headers.get('x-api-key')).toBe('webhook-key');
  });

  it('getSessionStatus hits new endpoint and normalizes broker payload', async () => {
    const qrContent = 'data:image/png;base64,QR';
    const expiresAt = '2024-01-01T00:00:00.000Z';
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        connected: false,
        status: 'qr_required',
        qr: { content: qrContent, expiresAt },
        user: { name: 'Tester', phone: '5511' },
        rate: { remaining: 10 },
      })
    );
    const client = await loadClient();

    const result = await client.getSessionStatus('session-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://broker.example/broker/session/session-1/status');
    expect(init?.method).toBe('GET');
    expect(result).toMatchObject({
      connected: false,
      status: 'qr_required',
      qr: { content: qrContent, expiresAt },
      user: { name: 'Tester', phone: '5511' },
      rate: { remaining: 10 },
    });
  });

  it('does not call ackEvents when ids list is empty', async () => {
    const client = await loadClient();

    await client.ackEvents([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sendMessage maps ack payload to WhatsAppMessageResult', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        ack: { id: 'ack-1', status: 'delivered', timestamp: '2024-01-01T00:00:00.000Z' },
      })
    );
    const client = await loadClient();

    const result = await client.sendMessage('session-1', {
      to: '5511987654321',
      content: 'Hello',
    });

    expect(result).toEqual({
      externalId: 'ack-1',
      status: 'delivered',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
  });

  it('throws WhatsAppBrokerError with broker code for failed requests', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(429, { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too fast' } })
    );
    const client = await loadClient();

    await expect(
      client.sendText({ instanceId: 'session-1', to: '5511987654321', text: 'Hello' })
    ).rejects.toMatchObject({
      name: 'WhatsAppBrokerError',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      message: 'Too fast',
    });
  });

  it('throws WhatsAppBrokerNotConfiguredError on unauthorized', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(403, { error: { message: 'Forbidden' } })
    );
    const client = await loadClient();

    const promise = client.sendText({ instanceId: 'session-1', to: '5511987654321', text: 'Hello' });

    await expect(promise).rejects.toMatchObject({
      name: 'WhatsAppBrokerNotConfiguredError',
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
    const promise = client.sendText({ instanceId: 'session-1', to: '5511987654321', text: 'Hello' });
    const expectation = expect(promise).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      name: 'WhatsAppBrokerError',
    });

    await vi.advanceTimersByTimeAsync(60);

    await expectation;
  });
});
