import express from 'express';
import type { AddressInfo } from 'net';
import { Server } from 'http';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./routes/tickets', () => ({ ticketsRouter: express.Router() }));
vi.mock('./routes/leads', () => ({ leadsRouter: express.Router() }));
vi.mock('./routes/contacts', () => ({ contactsRouter: express.Router() }));
vi.mock('./routes/auth', () => ({ authRouter: express.Router() }));
vi.mock('./routes/webhooks', () => ({
  webhooksRouter: express.Router(),
  integrationWebhooksRouter: express.Router(),
}));
vi.mock('./routes/integrations', () => ({ integrationsRouter: express.Router() }));
vi.mock('./routes/lead-engine', () => ({ leadEngineRouter: express.Router() }));
vi.mock('./middleware/auth', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('./middleware/error-handler', () => ({
  errorHandler: (_err: unknown, _req: unknown, _res: unknown, next: () => void) => next(),
  asyncHandler:
    <T extends (...args: unknown[]) => unknown>(handler: T) =>
    ((req: unknown, res: unknown, next: () => void) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    }),
}));

import { app } from './server';
const startServer = () =>
  new Promise<{ server: Server; url: string }>((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });

const stopServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

describe('root availability handlers', () => {
  const expectedPayload = {
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
  };

  it('returns ok for GET /', async () => {
    const { server, url } = await startServer();

    try {
      const response = await fetch(`${url}/`, { method: 'GET' });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(expectedPayload);
    } finally {
      await stopServer(server);
    }
  });

  it('returns ok for HEAD /', async () => {
    const { server, url } = await startServer();

    try {
      const response = await fetch(`${url}/`, { method: 'HEAD' });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-length')).toBe(
        Buffer.byteLength(JSON.stringify(expectedPayload)).toString(),
      );
      expect(response.headers.get('content-type')).toContain('application/json');
    } finally {
      await stopServer(server);
    }
  });

  it('exposes broker observability via the health endpoint', async () => {
    // 3e5a59e0 removeu WHATSAPP_MODE/transportMode: o transporte HTTP é fixo e o health expõe o broker.
    const { server, url } = await startServer();

    try {
      const response = await fetch(`${url}/healthz`, { method: 'GET' });
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.status).toBe('ok');
      expect(payload.whatsapp).not.toHaveProperty('transportMode');
      expect(payload.whatsapp.broker).toMatchObject({
        webhookUrl: expect.any(String),
        timeoutMs: expect.any(Number),
        degraded: expect.any(Boolean),
        circuitBreaker: expect.any(Object),
      });
      expect(payload.readiness).toBeDefined();
    } finally {
      await stopServer(server);
    }
  });
});

describe('CORS configuration', () => {
  it('allows equivalent origins with trailing slash', async () => {
    const { server, url } = await startServer();

    try {
      // 6f3dcc26: fora de produção as origens padrão são as do Vite (localhost:5173/4173).
      const origin = 'http://localhost:5173/';
      const response = await fetch(`${url}/`, {
        method: 'GET',
        headers: {
          Origin: origin,
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    } finally {
      await stopServer(server);
    }
  });

  it('rejects origins outside the allowlist', async () => {
    const { server, url } = await startServer();

    try {
      const response = await fetch(`${url}/`, {
        method: 'GET',
        headers: { Origin: 'https://evil.example.com' },
      });

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      await stopServer(server);
    }
  });
});
