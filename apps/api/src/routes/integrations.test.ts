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
  restoreWhatsAppEnv();
});

const startTestServer = async () => {
  vi.resetModules();
  delete process.env.WHATSAPP_BROKER_URL;
  delete process.env.WHATSAPP_BROKER_API_KEY;

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
      name: 'delete instance',
      method: 'DELETE',
      path: '/whatsapp/instances/test-instance',
    },
  ] as const;

  it.each(whatsappRoutes)('responds with 503 for %s', async ({ method, path }) => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/integrations${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
      });

      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toMatchObject({
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
