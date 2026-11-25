import express, { type Request } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhatsAppTransport } from '../../features/whatsapp-transport';
import { errorHandler } from '../../middleware/error-handler';

import { resolveRequestTenantId } from '../../services/tenant-service';

const sendAdHocMock = vi.fn();
const rateKeyForInstanceMock = vi.fn();
const resolveRateLimitMock = vi.fn();

const transportMock: WhatsAppTransport = {
  mode: 'http',
  sendMessage: vi.fn(),
  checkRecipient: vi.fn(),
  getGroups: vi.fn(),
  createPoll: vi.fn(),
};

vi.mock('../../features/whatsapp-transport', () => ({
  getWhatsAppTransport: vi.fn(() => transportMock),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    whatsAppInstance: {
      findUnique: vi.fn(async () => ({
        id: 'inst-1',
        tenantId: 'tenant-1',
        status: 'connected',
        connected: true,
      })),
    },
  },
}));

vi.mock('../../services/ticket-service', () => ({
  sendAdHoc: sendAdHocMock,
  rateKeyForInstance: rateKeyForInstanceMock,
  resolveInstanceRateLimit: resolveRateLimitMock,
}));

vi.mock('../../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('WhatsApp HTTP integration routes', () => {
  beforeEach(() => {
    sendAdHocMock.mockReset();
    rateKeyForInstanceMock.mockReturnValue('tenant-1:inst-1');
    resolveRateLimitMock.mockReturnValue({ limit: 5, windowMs: 60_000 });
  });

  afterEach(() => {
    vi.doUnmock('../../lib/whatsapp-crypto');
  });

  it('sends instance messages through the HTTP transport without loading a WhatsApp client', async () => {
    // A conexão com o WhatsApp vive no broker externo: enviar mensagens não pode carregar
    // nenhum código de cliente/protocolo WhatsApp (só o transporte HTTP).
    vi.doMock('../../lib/whatsapp-crypto', () => {
      throw new Error('WhatsApp client/protocol code should not be loaded for HTTP transport');
    });

    sendAdHocMock.mockResolvedValue({ success: true, data: { id: 'wamid-1' } });

    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'operator-1', tenantId: 'tenant-1' };
      next();
    });

    const { whatsappMessagesRouter } = await import('../integrations/whatsapp.messages');
    app.use('/api', whatsappMessagesRouter);
    app.use(errorHandler);

    const response = await request(app)
      .post('/api/integrations/whatsapp/instances/inst-1/messages')
      .set('content-type', 'application/json')
      .set('Idempotency-Key', 'it-1')
      .send({
        to: '5511999999999',
        payload: { type: 'text', text: 'Hello HTTP' },
        idempotencyKey: 'it-1',
      });

    expect(response.status).toBe(202);
    expect(sendAdHocMock).toHaveBeenCalledTimes(1);
    const [adHocPayload] = sendAdHocMock.mock.calls[0] ?? [];
    const expectedTenant = resolveRequestTenantId({
      query: {},
      headers: {},
      user: { tenantId: 'tenant-1' },
    } as Request);

    expect(adHocPayload).toMatchObject({ tenantId: expectedTenant });
    const [, options] = sendAdHocMock.mock.calls[0] ?? [];
    expect(options).toEqual({ transport: transportMock });
    expect(options.transport.mode).toBe('http');
  });

  it('rejects sending messages when tenant does not own the instance', async () => {
    sendAdHocMock.mockResolvedValue({ success: true, data: { id: 'wamid-1' } });

    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'operator-1', tenantId: 'tenant-2' };
      next();
    });

    const { whatsappMessagesRouter } = await import('../integrations/whatsapp.messages');
    app.use('/api', whatsappMessagesRouter);
    app.use(errorHandler);

    const response = await request(app)
      .post('/api/integrations/whatsapp/instances/inst-1/messages')
      .set('content-type', 'application/json')
      .set('Idempotency-Key', 'it-1')
      .set('x-tenant-id', 'tenant-2')
      .send({
        to: '5511999999999',
        payload: { type: 'text', text: 'Hello HTTP' },
        idempotencyKey: 'it-1',
      });

    expect(response.status).toBe(404);
    expect(response.body?.error?.code).toBe('NOT_FOUND');
    expect(sendAdHocMock).not.toHaveBeenCalled();
  });
});
