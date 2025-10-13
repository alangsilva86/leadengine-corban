import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhatsAppTransport } from '../../services/whatsapp/transport/transport';

const sendAdHocMock = vi.fn();
const rateKeyForInstanceMock = vi.fn();
const resolveRateLimitMock = vi.fn();

const transportMock: WhatsAppTransport = {
  mode: 'http',
  sendText: vi.fn(),
  sendMedia: vi.fn(),
  checkRecipient: vi.fn(),
  getStatus: vi.fn(),
};

vi.mock('../../services/whatsapp/transport/transport', () => ({
  resolveWhatsAppTransport: vi.fn(() => transportMock),
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
    vi.doUnmock('@whiskeysockets/baileys');
  });

  it('sends instance messages without loading Baileys client', async () => {
    vi.doMock('@whiskeysockets/baileys', () => {
      throw new Error('Baileys should not be loaded for HTTP transport');
    });

    sendAdHocMock.mockResolvedValue({ success: true, data: { id: 'wamid-1' } });

    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { id: 'operator-1', tenantId: 'tenant-1' };
      next();
    });

    const { whatsappMessagesRouter } = await import('../integrations/whatsapp.messages');
    app.use('/api', whatsappMessagesRouter);

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
    const [, options] = sendAdHocMock.mock.calls[0] ?? [];
    expect(options).toEqual({ transport: transportMock });
  });
});
