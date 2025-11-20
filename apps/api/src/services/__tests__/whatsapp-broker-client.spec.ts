import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { refreshWhatsAppEnv } from '../../config/whatsapp';
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
    refreshWhatsAppEnv();
  });

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    process.env.WHATSAPP_BROKER_URL = 'https://broker.test';
    process.env.WHATSAPP_BROKER_API_KEY = 'test-key';
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-token';
    process.env.WHATSAPP_BROKER_WEBHOOK_URL = 'https://ticketzapi-production.up.railway.app/api/integrations/whatsapp/webhook';
    refreshWhatsAppEnv();
  });

  describe('resolveWhatsAppBrokerConfig', () => {
    it('normalizes the broker base URL removing trailing slash', async () => {
      process.env.WHATSAPP_BROKER_URL = 'https://broker.test/api/';
      refreshWhatsAppEnv();

      const { resolveWhatsAppBrokerConfig } = await import('../whatsapp-broker-client');

      const config = resolveWhatsAppBrokerConfig();
      expect(config.baseUrl).toBe('https://broker.test/api');
    });

    it('aggregates missing configuration keys in the thrown error', async () => {
      delete process.env.WHATSAPP_BROKER_URL;
      delete process.env.WHATSAPP_BROKER_API_KEY;
      delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
      refreshWhatsAppEnv();

      const {
        resolveWhatsAppBrokerConfig,
        WhatsAppBrokerNotConfiguredError,
      } = await import('../whatsapp-broker-client');

      try {
        resolveWhatsAppBrokerConfig();
        throw new Error('expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(WhatsAppBrokerNotConfiguredError);
        expect((error as WhatsAppBrokerNotConfiguredError).message).toBe(
          'WhatsApp broker configuration is missing required variables: WHATSAPP_BROKER_URL, WHATSAPP_BROKER_API_KEY, WHATSAPP_WEBHOOK_VERIFY_TOKEN.'
        );
        expect((error as WhatsAppBrokerNotConfiguredError).missing).toEqual([
          'WHATSAPP_BROKER_URL',
          'WHATSAPP_BROKER_API_KEY',
          'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
        ]);
      }
    });

    it('falls back to the API key when the verify token is missing', async () => {
      delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
      refreshWhatsAppEnv();

      const { resolveWhatsAppBrokerConfig } = await import('../whatsapp-broker-client');

      const config = resolveWhatsAppBrokerConfig();

      expect(config.verifyToken).toBe('test-key');
    });

    it('wraps invalid URLs in WhatsAppBrokerNotConfiguredError', async () => {
      process.env.WHATSAPP_BROKER_URL = 'ftp://broker.test';
      refreshWhatsAppEnv();

      const {
        resolveWhatsAppBrokerConfig,
        WhatsAppBrokerNotConfiguredError,
      } = await import('../whatsapp-broker-client');

      expect(() => resolveWhatsAppBrokerConfig()).toThrowError(
        WhatsAppBrokerNotConfiguredError
      );
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
    expect(url).toBe('https://broker.test/instances?tenantId=tenant-1');

    const headers = init?.headers as Headers;
    expect(headers.get('X-API-Key')).toBe('test-key');
    expect(headers.get('X-Tenant-Id')).toBe('tenant-1');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Accept')).toBe('application/json');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      id: 'crm-instance',
      instanceId: 'crm-instance',
      name: 'CRM Principal',
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
    const headers = init?.headers as Headers;
    expect(headers.get('X-Tenant-Id')).toBe('tenant-1');
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

  it('treats 404 from wipe session as idempotent success', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'SESSION_NOT_FOUND' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    }));

    await whatsappBrokerClient.wipeSession('broker-10', { instanceId: 'crm-instance' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://broker.test/instances/crm-instance/session/wipe');
    expect(init?.method).toBe('POST');
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

  it('deletes instance even when session wipe is missing', async () => {
    const { Response } = await import('undici');
    const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'SESSION_NOT_FOUND' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await whatsappBrokerClient.deleteInstance('broker-10', {
      instanceId: 'crm-instance',
      wipe: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [wipeUrl, wipeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(wipeUrl).toBe('https://broker.test/instances/crm-instance/session/wipe');
    expect(wipeInit?.method).toBe('POST');
    expect(deleteUrl).toBe('https://broker.test/instances/broker-10');
    expect(deleteInit?.method).toBe('DELETE');
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

  describe('performWhatsAppBrokerRequest', () => {
    it('applies default headers and resolves JSON responses', async () => {
      const { Response } = await import('undici');
      const { performWhatsAppBrokerRequest } = await import('../whatsapp-broker-client');

      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const result = await performWhatsAppBrokerRequest<{ ok: boolean }>('/ping', {
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
      });

      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init?.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('Accept')).toBe('application/json');
      expect(headers.get('X-API-Key')).toBe('test-key');
    });

    it('respects provided headers and idempotency keys', async () => {
      const { Response } = await import('undici');
      const { performWhatsAppBrokerRequest } = await import('../whatsapp-broker-client');

      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ result: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      await performWhatsAppBrokerRequest('/custom', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/custom' },
        body: JSON.stringify({ foo: 'bar' }),
      }, { idempotencyKey: 'req-42', apiKey: 'custom-key' });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init?.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/custom');
      expect(headers.get('Idempotency-Key')).toBe('req-42');
      expect(headers.get('X-API-Key')).toBe('custom-key');
    });

    it('returns undefined for 204 responses', async () => {
      const { Response } = await import('undici');
      const { performWhatsAppBrokerRequest } = await import('../whatsapp-broker-client');

      fetchMock.mockResolvedValue(
        new Response(null, {
          status: 204,
        })
      );

      const result = await performWhatsAppBrokerRequest('/void');
      expect(result).toBeUndefined();
    });

    it('wraps abort errors into WhatsAppBrokerError with timeout metadata', async () => {
      const { performWhatsAppBrokerRequest, WhatsAppBrokerError } = await import('../whatsapp-broker-client');

      fetchMock.mockRejectedValue(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
      );

      try {
        await performWhatsAppBrokerRequest('/timeout');
        throw new Error('Expected performWhatsAppBrokerRequest to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(WhatsAppBrokerError);
        if (error instanceof WhatsAppBrokerError) {
          expect(error.code).toBe('REQUEST_TIMEOUT');
          expect(error.brokerStatus).toBe(408);
        }
      }
    });
  });

  describe('getQrCode', () => {
    it('falls back to session status normalization when image endpoint returns 404', async () => {
      const { Response } = await import('undici');
      const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            status: {
              qr: 'qr-data',
              qrExpiresAt: '2024-05-01T00:00:00.000Z',
            },
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        );

      const result = await whatsappBrokerClient.getQrCode('broker-1');

      expect(result).toEqual({
        qr: 'qr-data',
        qrCode: 'qr-data',
        qrExpiresAt: '2024-05-01T00:00:00.000Z',
        expiresAt: '2024-05-01T00:00:00.000Z',
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://broker.test/instances/broker-1/qr.png');
      expect(fetchMock.mock.calls[1]?.[0]).toBe('https://broker.test/instances/broker-1/status');
    });

    it('normalizes binary PNG responses into base64 data URLs', async () => {
      const { Response } = await import('undici');
      const { whatsappBrokerClient } = await import('../whatsapp-broker-client');

      const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
      const expectedBase64 = Buffer.from(pngBytes).toString('base64');

      fetchMock.mockResolvedValue(
        new Response(pngBytes, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'x-qr-expires-at': '2024-06-01T12:00:00.000Z',
          },
        })
      );

      const result = await whatsappBrokerClient.getQrCode('broker-2');

      expect(result).toEqual({
        qr: `data:image/png;base64,${expectedBase64}`,
        qrCode: `data:image/png;base64,${expectedBase64}`,
        qrExpiresAt: '2024-06-01T12:00:00.000Z',
        expiresAt: '2024-06-01T12:00:00.000Z',
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init?.headers as Headers;
      expect(headers.get('Accept')).toContain('image/png');
    });
  });
});
