import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { whatsappWebhookRouter } from '../webhook-routes';
import { resetMetrics, renderMetrics } from '../../../../lib/metrics';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';

type PrismaMock = {
  whatsAppInstance: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

var prismaMock: PrismaMock;

var ingestInboundWhatsAppMessageMock: ReturnType<typeof vi.fn>;
var normalizeUpsertEventMock: ReturnType<typeof vi.fn>;

vi.mock('../../../../lib/prisma', () => {
  prismaMock = {
    whatsAppInstance: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  return { prisma: prismaMock };
});

vi.mock('../../services/inbound-lead-service', () => {
  ingestInboundWhatsAppMessageMock = vi.fn();
  return {
    ingestInboundWhatsAppMessage: ingestInboundWhatsAppMessageMock,
  };
});

vi.mock('../../services/baileys-raw-normalizer', () => {
  normalizeUpsertEventMock = vi.fn();
  return {
    normalizeUpsertEvent: normalizeUpsertEventMock,
  };
});

const ORIGINAL_ENV = {
  enforce: process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE,
  secret: process.env.WHATSAPP_WEBHOOK_HMAC_SECRET,
};

describe('WhatsApp webhook HMAC signature enforcement', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'true';
    process.env.WHATSAPP_WEBHOOK_HMAC_SECRET = 'unit-secret';
    refreshWhatsAppEnv();
    resetMetrics();
    prismaMock.whatsAppInstance.findFirst.mockReset();
    prismaMock.whatsAppInstance.update.mockReset();
    ingestInboundWhatsAppMessageMock.mockReset();
    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValue({ normalized: [] });
  });

  const buildApp = () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
        },
      })
    );
    app.use('/api/webhooks', whatsappWebhookRouter);
    return app;
  };

  it('rejects requests without signature when enforcement is enabled', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/webhooks/whatsapp').send({ event: 'ping' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' });
    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="invalid_signature"[^}]*result="rejected"[^}]*\} 1/
    );
  });

  it('rejects requests with mismatching signature', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-signature-sha256', 'deadbeef')
      .send({ event: 'pong' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_SIGNATURE');
    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="invalid_signature"[^}]*result="rejected"[^}]*\} 1/
    );
  });

  it('accepts requests with valid signature', async () => {
    const app = buildApp();
    const payload = { event: 'ok' };
    const raw = JSON.stringify(payload);
    const crypto = await import('node:crypto');
    const signature = crypto.createHmac('sha256', 'unit-secret').update(raw).digest('hex');

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-signature-sha256', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
  });
});

describe('WhatsApp webhook instance resolution', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'false';
    delete process.env.WHATSAPP_WEBHOOK_HMAC_SECRET;
    refreshWhatsAppEnv();
    resetMetrics();
    prismaMock.whatsAppInstance.findFirst.mockReset();
    prismaMock.whatsAppInstance.update.mockReset();
    ingestInboundWhatsAppMessageMock.mockReset();
    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValue({ normalized: [] });
  });

  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/webhooks', whatsappWebhookRouter);
    return app;
  };

  it('resolves stored instance metadata and persists missing broker id when matching UUID', async () => {
    const app = buildApp();
    const uuid = 'broker-uuid-1234';
    prismaMock.whatsAppInstance.findFirst.mockResolvedValueOnce({
      id: 'stored-instance',
      brokerId: null,
      tenantId: 'tenant-uuid',
    });
    prismaMock.whatsAppInstance.update.mockResolvedValueOnce({});

    normalizeUpsertEventMock.mockReturnValueOnce({
      normalized: [
        {
          messageIndex: 0,
          messageId: 'wamid.uuid',
          sessionId: null,
          brokerId: null,
          tenantId: 'tenant-uuid',
          data: {
            instanceId: 'stored-instance',
            tenantId: 'tenant-uuid',
            direction: 'INBOUND',
            metadata: {
              instanceId: 'stored-instance',
              contact: { remoteJid: '5511999999999@s.whatsapp.net' },
            },
            message: {
              key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid.uuid' },
            },
            contact: { phone: '+55 11 99999-9999' },
          },
        },
      ],
    });

    ingestInboundWhatsAppMessageMock.mockResolvedValueOnce(true);

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .send({
        event: 'WHATSAPP_MESSAGES_UPSERT',
        instanceId: uuid,
        payload: {
          messages: [
            {
              key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid.uuid' },
            },
          ],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, persisted: 1, failures: 0 });

    expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledTimes(1);
    const lookupArgs = prismaMock.whatsAppInstance.findFirst.mock.calls[0]?.[0];
    expect(lookupArgs).toBeTruthy();
    expect(lookupArgs).toMatchObject({
      where: {
        OR: expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              path: ['lastBrokerSnapshot', 'sessionId'],
              equals: uuid,
            }),
          }),
          expect.objectContaining({
            metadata: expect.objectContaining({
              path: ['history'],
              array_contains: expect.objectContaining({ brokerId: uuid }),
            }),
          }),
        ]),
      },
      select: { id: true, brokerId: true, tenantId: true },
    });

    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledWith({
      where: { id: 'stored-instance' },
      data: { brokerId: uuid },
    });

    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'stored-instance',
        tenantId: 'tenant-uuid',
      })
    );
  });
});

if (ORIGINAL_ENV.enforce !== undefined) {
  process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = ORIGINAL_ENV.enforce;
} else {
  delete process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE;
}

if (ORIGINAL_ENV.secret !== undefined) {
  process.env.WHATSAPP_WEBHOOK_HMAC_SECRET = ORIGINAL_ENV.secret;
} else {
  delete process.env.WHATSAPP_WEBHOOK_HMAC_SECRET;
}
