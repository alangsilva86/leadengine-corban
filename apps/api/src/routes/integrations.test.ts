import express from 'express';
import type { Request } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../middleware/error-handler';

vi.mock('../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const originalWhatsAppEnv = {
  url: process.env.WHATSAPP_BROKER_URL,
  apiKey: process.env.WHATSAPP_BROKER_API_KEY,
};

const restoreWhatsAppEnv = () => {
  if (typeof originalWhatsAppEnv.url === 'string') {
    process.env.WHATSAPP_BROKER_URL = originalWhatsAppEnv.url;
  } else {
    delete process.env.WHATSAPP_BROKER_URL;
  }

  if (typeof originalWhatsAppEnv.apiKey === 'string') {
    process.env.WHATSAPP_BROKER_API_KEY = originalWhatsAppEnv.apiKey;
  } else {
    delete process.env.WHATSAPP_BROKER_API_KEY;
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  restoreWhatsAppEnv();
});

const startTestServer = async ({
  configureWhatsApp = false,
}: { configureWhatsApp?: boolean } = {}) => {
  vi.resetModules();
  if (configureWhatsApp) {
    process.env.WHATSAPP_BROKER_URL = 'http://broker.test';
    process.env.WHATSAPP_BROKER_API_KEY = 'test-key';
  } else {
    delete process.env.WHATSAPP_BROKER_URL;
    delete process.env.WHATSAPP_BROKER_API_KEY;
  }

  const { integrationsRouter } = await import('./integrations');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = {
      id: 'user-1',
      tenantId: 'tenant-123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    };
    next();
  });
  app.use('/api/integrations', integrationsRouter);
  app.use(errorHandler);

  return new Promise<{ server: Server; url: string }>((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
};

const stopTestServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

describe('WhatsApp integration routes when broker is not configured', () => {
  const whatsappRoutes = [
    {
      name: 'list instances',
      method: 'GET',
      path: '/whatsapp/instances',
    },
    {
      name: 'create instance',
      method: 'POST',
      path: '/whatsapp/instances',
      body: { name: 'Test Instance' },
    },
    {
      name: 'start instance',
      method: 'POST',
      path: '/whatsapp/instances/test-instance/start',
    },
    {
      name: 'stop instance',
      method: 'POST',
      path: '/whatsapp/instances/test-instance/stop',
    },
    {
      name: 'get QR code',
      method: 'GET',
      path: '/whatsapp/instances/test-instance/qr',
    },
    {
      name: 'get status',
      method: 'GET',
      path: '/whatsapp/instances/test-instance/status',
    },
  ] as const;

  it.each(whatsappRoutes)('responds with 503 for %s', async ({ method, path, body }) => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/integrations${path}`, {
        method,
        headers: {
          ...(body ? { 'content-type': 'application/json' } : {}),
          'x-tenant-id': 'tenant-123',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseBody = await response.json();

      expect(response.status).toBe(503);
      expect(responseBody).toMatchObject({
        success: false,
        error: {
          code: 'WHATSAPP_NOT_CONFIGURED',
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });
});

describe('WhatsApp integration routes with configured broker', () => {
  it('lists WhatsApp instances', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const listSpy = vi.spyOn(whatsappBrokerClient, 'listInstances').mockResolvedValue([
      {
        id: 'instance-1',
        status: 'CONNECTED',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: {
          tenant_id: 'tenant-123',
          name: 'Main Instance',
          last_activity: '2024-01-02T00:00:00.000Z',
          phone_number: '+5511987654321',
          user: 'Agent Smith',
          stats: { sent: 10 },
        },
      },
      {
        metadata: {
          sessionId: 'instance-2',
          tenantId: 'tenant-123',
          status: 'DISCONNECTED',
          connected: false,
        },
      },
    ] as unknown as typeof whatsappBrokerClient.listInstances extends (...args: any[]) => infer R
      ? R extends Promise<infer I>
        ? I
        : never
      : never);

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'GET',
        headers: {
          'x-tenant-id': 'tenant-123',
        },
      });

      const body = await response.json();

      expect(listSpy).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: [
          {
            id: 'instance-1',
            name: 'Main Instance',
            status: 'connected',
            connected: true,
            tenantId: 'tenant-123',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastActivity: '2024-01-02T00:00:00.000Z',
            phoneNumber: '+5511987654321',
            user: 'Agent Smith',
            stats: { sent: 10 },
          },
          {
            id: 'instance-2',
            status: 'disconnected',
            connected: false,
            tenantId: 'tenant-123',
          },
        ],
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('creates a WhatsApp instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const createSpy = vi.spyOn(whatsappBrokerClient, 'createInstance').mockResolvedValue({
      id: 'instance-2',
      tenantId: 'tenant-123',
      name: 'Created Instance',
      status: 'connecting',
      connected: false,
      createdAt: '2024-01-02T00:00:00.000Z',
    });

    try {
      const response = await fetch(`${url}/api/integrations/whatsapp/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ name: 'Created Instance' }),
      });

      const body = await response.json();

      expect(createSpy).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        name: 'Created Instance',
        webhookUrl: undefined,
      });
      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        data: {
          id: 'instance-2',
          name: 'Created Instance',
          status: 'connecting',
          connected: false,
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('connects a WhatsApp instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const connectSpy = vi.spyOn(whatsappBrokerClient, 'connectInstance').mockResolvedValue();
    const statusSpy = vi
      .spyOn(whatsappBrokerClient, 'getStatus')
      .mockResolvedValue({ status: 'connected', connected: true });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-3/start`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(connectSpy).toHaveBeenCalledWith('instance-3');
      expect(statusSpy).toHaveBeenCalledWith('instance-3');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          status: 'connected',
          connected: true,
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('disconnects a WhatsApp instance', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const disconnectSpy = vi
      .spyOn(whatsappBrokerClient, 'disconnectInstance')
      .mockResolvedValue();
    const statusSpy = vi
      .spyOn(whatsappBrokerClient, 'getStatus')
      .mockResolvedValue({ status: 'disconnected', connected: false });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-4/stop`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(disconnectSpy).toHaveBeenCalledWith('instance-4');
      expect(statusSpy).toHaveBeenCalledWith('instance-4');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          status: 'disconnected',
          connected: false,
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('fetches a WhatsApp instance QR code', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const qrSpy = vi.spyOn(whatsappBrokerClient, 'getQrCode').mockResolvedValue({
      qrCode: 'data:image/png;base64,QR',
      expiresAt: '2024-01-03T00:00:00.000Z',
    });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-5/qr`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(qrSpy).toHaveBeenCalledWith('instance-5');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          qrCode: 'data:image/png;base64,QR',
          expiresAt: '2024-01-03T00:00:00.000Z',
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });

  it('retrieves WhatsApp instance status', async () => {
    const { server, url } = await startTestServer({ configureWhatsApp: true });
    const { whatsappBrokerClient } = await import('../services/whatsapp-broker-client');

    const statusSpy = vi
      .spyOn(whatsappBrokerClient, 'getStatus')
      .mockResolvedValue({ status: 'qr_required', connected: false });

    try {
      const response = await fetch(
        `${url}/api/integrations/whatsapp/instances/instance-6/status`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': 'tenant-123',
          },
        }
      );

      const body = await response.json();

      expect(statusSpy).toHaveBeenCalledWith('instance-6');
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: {
          status: 'qr_required',
          connected: false,
        },
      });
    } finally {
      await stopTestServer(server);
    }
  });
});
