import express from 'express';
import type { AddressInfo } from 'net';
import { Server } from 'http';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./routes/tickets', () => ({ ticketsRouter: express.Router() }));
vi.mock('./routes/leads', () => ({ leadsRouter: express.Router() }));
vi.mock('./routes/contacts', () => ({ contactsRouter: express.Router() }));
vi.mock('./routes/auth', () => ({ authRouter: express.Router() }));
vi.mock('./routes/webhooks', () => ({ webhooksRouter: express.Router() }));
vi.mock('./routes/integrations', () => ({ integrationsRouter: express.Router() }));
vi.mock('./routes/lead-engine', () => ({ leadEngineRouter: express.Router() }));
vi.mock('./middleware/auth', () => ({ authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('./middleware/error-handler', () => ({ errorHandler: (_err: unknown, _req: unknown, _res: unknown, next: () => void) => next() }));

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
});
