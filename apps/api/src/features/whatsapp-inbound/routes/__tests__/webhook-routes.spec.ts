import { vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  processedIntegrationEventCreateMock: vi.fn(),
  whatsAppInstanceFindFirstMock: vi.fn(),
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    processedIntegrationEvent: { create: prismaMocks.processedIntegrationEventCreateMock },
    whatsAppInstance: { findFirst: prismaMocks.whatsAppInstanceFindFirstMock },
  },
}));

const { processedIntegrationEventCreateMock, whatsAppInstanceFindFirstMock } = prismaMocks;

vi.mock('../../services/inbound-lead-service', () => ({
  ingestInboundWhatsAppMessage: vi.fn().mockResolvedValue({ id: 'mocked-message' }),
}));

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { whatsappWebhookRouter } from '../webhook-routes';
import { resetMetrics, renderMetrics } from '../../../../lib/metrics';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';
import { ingestInboundWhatsAppMessage } from '../../services/inbound-lead-service';

const ingestInboundWhatsAppMessageMock = vi.mocked(ingestInboundWhatsAppMessage);

const ORIGINAL_ENV = {
  enforce: process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE,
  secret: process.env.WHATSAPP_WEBHOOK_HMAC_SECRET,
};

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

afterEach(() => {
  vi.clearAllMocks();
});

describe('WhatsApp webhook HMAC signature enforcement', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'true';
    process.env.WHATSAPP_WEBHOOK_HMAC_SECRET = 'unit-secret';
    refreshWhatsAppEnv();
    resetMetrics();
  });

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

describe('WhatsApp webhook Baileys event logging', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'false';
    delete process.env.WHATSAPP_WEBHOOK_HMAC_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_API_KEY;
    refreshWhatsAppEnv();
    resetMetrics();
    whatsAppInstanceFindFirstMock.mockResolvedValue(null);
    processedIntegrationEventCreateMock.mockResolvedValue({} as never);
    ingestInboundWhatsAppMessageMock.mockResolvedValue({ id: 'mocked-message' });
  });

  it('persists a debug snapshot before ingesting normalized messages', async () => {
    const app = buildApp();
    const eventPayload = {
      event: 'WHATSAPP_MESSAGES_UPSERT',
      instanceId: 'instance-1',
      tenantId: 'tenant-42',
      payload: {
        instanceId: 'instance-1',
        tenantId: 'tenant-42',
        messages: [
          {
            key: {
              id: 'wamid-1',
              remoteJid: '5511999999999@s.whatsapp.net',
              fromMe: false,
            },
            pushName: 'Maria',
            messageTimestamp: 1_700_000_001,
            message: {
              conversation: 'Olá!',
            },
          },
        ],
      },
    };

    const response = await request(app).post('/api/webhooks/whatsapp').send(eventPayload);

    expect(response.status).toBe(200);
    expect(processedIntegrationEventCreateMock).toHaveBeenCalledTimes(1);
    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledTimes(1);

    const logCallOrder = processedIntegrationEventCreateMock.mock.invocationCallOrder[0];
    const ingestCallOrder = ingestInboundWhatsAppMessageMock.mock.invocationCallOrder[0];
    expect(logCallOrder).toBeLessThan(ingestCallOrder);

    const createArgs = processedIntegrationEventCreateMock.mock.calls[0]?.[0];
    expect(createArgs).toMatchObject({
      data: {
        source: 'baileys:webhook',
      },
    });

    const payload = (createArgs?.data as { payload?: unknown })?.payload as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    expect(payload).toMatchObject({
      tenantId: 'tenant-42',
      instanceId: 'instance-1',
      chatId: '5511999999999@s.whatsapp.net',
      messageId: 'wamid-1',
      direction: 'INBOUND',
      normalizedIndex: 0,
    });

    const metadata = payload?.metadata as Record<string, unknown> | undefined;
    expect(metadata).toMatchObject({
      tenantId: 'tenant-42',
      chatId: '5511999999999@s.whatsapp.net',
    });
    expect(typeof metadata?.source).toBe('string');

    expect(typeof payload?.rawPayload).toBe('string');
    expect(payload?.rawPayload as string).toContain('WHATSAPP_MESSAGES_UPSERT');
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
