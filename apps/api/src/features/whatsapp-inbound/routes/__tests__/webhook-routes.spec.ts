import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { whatsappWebhookRouter } from '../webhook-routes';
import { resetMetrics, renderMetrics } from '../../../../lib/metrics';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';
import { __testing as inboundQueueTesting } from '../../services/inbound-queue';

const hoistedMocks = vi.hoisted(() => {
  const processedIntegrationEventCreateMock = vi.fn();
  const whatsAppInstanceFindFirstMock = vi.fn();
  const whatsAppInstanceUpdateMock = vi.fn();
  const ingestInboundWhatsAppMessageMock = vi.fn();
  const normalizeUpsertEventMock = vi.fn();

  const prisma = {
    processedIntegrationEvent: { create: processedIntegrationEventCreateMock },
    whatsAppInstance: {
      findFirst: whatsAppInstanceFindFirstMock,
      update: whatsAppInstanceUpdateMock,
    },
  };

  return {
    prisma,
    processedIntegrationEventCreateMock,
    whatsAppInstanceFindFirstMock,
    whatsAppInstanceUpdateMock,
    ingestInboundWhatsAppMessageMock,
    normalizeUpsertEventMock,
  };
});

vi.mock('../../../../lib/prisma', () => ({ prisma: hoistedMocks.prisma }));

vi.mock('../../services/inbound-lead-service', () => ({
  ingestInboundWhatsAppMessage: hoistedMocks.ingestInboundWhatsAppMessageMock,
}));

vi.mock('../../services/baileys-raw-normalizer', () => ({
  normalizeUpsertEvent: hoistedMocks.normalizeUpsertEventMock,
}));

vi.mock('@ticketz/storage', () => ({
  $Enums: { MessageType: {} },
}));

const prismaMock = hoistedMocks.prisma;
const {
  processedIntegrationEventCreateMock,
  whatsAppInstanceFindFirstMock,
  whatsAppInstanceUpdateMock: _whatsAppInstanceUpdateMock,
  ingestInboundWhatsAppMessageMock,
  normalizeUpsertEventMock,
} = hoistedMocks;


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

afterEach(async () => {
  await inboundQueueTesting.waitForIdle();
  vi.clearAllMocks();
  inboundQueueTesting.resetQueue();
});

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

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });
});

describe('WhatsApp webhook Baileys event logging', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'false';
    delete process.env.WHATSAPP_WEBHOOK_HMAC_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_API_KEY;
    refreshWhatsAppEnv();
    resetMetrics();
    prismaMock.whatsAppInstance.findFirst.mockResolvedValue(null);
    processedIntegrationEventCreateMock.mockResolvedValue({} as never);
    ingestInboundWhatsAppMessageMock.mockResolvedValue(true);
    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValue({
      normalized: [
        {
          messageIndex: 0,
          messageId: 'wamid-1',
          sessionId: null,
          brokerId: null,
          tenantId: 'tenant-42',
          messageType: 'text',
          messageUpsertType: 'notify',
          isGroup: false,
          data: {
            instanceId: 'instance-1',
            tenantId: 'tenant-42',
            direction: 'INBOUND',
            metadata: {
              instanceId: 'instance-1',
              contact: { remoteJid: '5511999999999@s.whatsapp.net' },
            },
            message: {
              key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid-1' },
            },
            contact: { phone: '+55 11 99999-9999' },
          },
        },
      ],
    });
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

    expect(response.status).toBe(204);

    await inboundQueueTesting.waitForIdle();
    expect(processedIntegrationEventCreateMock).toHaveBeenCalledTimes(1);
    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledTimes(1);

    const logCallOrder = processedIntegrationEventCreateMock.mock.invocationCallOrder[0];
    const ingestCallOrder = ingestInboundWhatsAppMessageMock.mock.invocationCallOrder[0];
    expect(logCallOrder).toBeDefined();
    expect(ingestCallOrder).toBeDefined();
    expect(logCallOrder!).toBeLessThan(ingestCallOrder!);

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
    const brokerMetadata = metadata?.broker as Record<string, unknown> | undefined;
    expect(brokerMetadata).toMatchObject({
      messageType: 'notify',
      messageContentType: 'text',
    });

    expect(typeof payload?.rawPayload).toBe('string');
    expect(payload?.rawPayload as string).toContain('WHATSAPP_MESSAGES_UPSERT');
  });

  it('processes broker contract inbound message events with shared instrumentation', async () => {
    normalizeUpsertEventMock.mockClear();
    const app = buildApp();

    const eventPayload = {
      id: 'broker-event-1',
      type: 'MESSAGE_INBOUND',
      tenantId: 'tenant-42',
      instanceId: 'instance-1',
      timestamp: '2024-01-01T00:00:00.000Z',
      payload: {
        instanceId: 'instance-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        direction: 'INBOUND',
        contact: { phone: '+55 11 99999-9999', name: 'Maria' },
        message: { id: 'wamid-1', type: 'text', text: 'Olá!' },
        metadata: {
          contact: { remoteJid: '5511999999999@s.whatsapp.net' },
          broker: { brokerId: 'broker-1' },
        },
      },
    } satisfies Record<string, unknown>;

    const response = await request(app).post('/api/webhooks/whatsapp').send(eventPayload);

    expect(response.status).toBe(204);
    await inboundQueueTesting.waitForIdle();

    expect(normalizeUpsertEventMock).not.toHaveBeenCalled();
    expect(processedIntegrationEventCreateMock).toHaveBeenCalledTimes(1);
    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledTimes(1);

    const createArgs = processedIntegrationEventCreateMock.mock.calls[0]?.[0];
    const debugPayload = (createArgs?.data as { payload?: unknown })?.payload as
      | Record<string, unknown>
      | undefined;

    expect(debugPayload).toMatchObject({
      tenantId: 'tenant-42',
      instanceId: 'instance-1',
      chatId: '5511999999999@s.whatsapp.net',
      messageId: 'wamid-1',
      direction: 'INBOUND',
      normalizedIndex: 0,
    });

    const [envelope] = ingestInboundWhatsAppMessageMock.mock.calls[0] ?? [];
    expect(envelope).toMatchObject({
      origin: 'webhook',
      instanceId: 'instance-1',
      tenantId: 'tenant-42',
      message: {
        kind: 'message',
        id: 'wamid-1',
        direction: 'INBOUND',
        payload: expect.objectContaining({ text: 'Olá!' }),
        metadata: expect.objectContaining({
          chatId: '5511999999999@s.whatsapp.net',
          tenantId: 'tenant-42',
          instanceId: 'instance-1',
          broker: expect.objectContaining({ brokerId: 'broker-1' }),
        }),
      },
    });
  });

  it('processes broker contract inbound message events when only the event field is provided', async () => {
    normalizeUpsertEventMock.mockClear();
    const app = buildApp();

    const eventPayload = {
      id: 'broker-event-2',
      event: 'MESSAGE_INBOUND',
      tenantId: 'tenant-42',
      instanceId: 'instance-1',
      timestamp: '2024-01-01T00:00:00.000Z',
      payload: {
        instanceId: 'instance-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        direction: 'INBOUND',
        contact: { phone: '+55 11 99999-9999', name: 'Maria' },
        message: { id: 'wamid-1', type: 'text', text: 'Olá!' },
        metadata: {
          contact: { remoteJid: '5511999999999@s.whatsapp.net' },
          broker: { brokerId: 'broker-1' },
        },
      },
    } satisfies Record<string, unknown>;

    const response = await request(app).post('/api/webhooks/whatsapp').send(eventPayload);

    expect(response.status).toBe(204);
    await inboundQueueTesting.waitForIdle();

    expect(normalizeUpsertEventMock).not.toHaveBeenCalled();
    expect(processedIntegrationEventCreateMock).toHaveBeenCalledTimes(1);
    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledTimes(1);

    const [envelope] = ingestInboundWhatsAppMessageMock.mock.calls[0] ?? [];
    expect(envelope).toMatchObject({
      origin: 'webhook',
      instanceId: 'instance-1',
      tenantId: 'tenant-42',
      message: {
        kind: 'message',
        id: 'wamid-1',
        direction: 'INBOUND',
        payload: expect.objectContaining({ text: 'Olá!' }),
      },
    });
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

  it('signals failure when ingestion does not persist message', async () => {
    const app = buildApp();
    prismaMock.whatsAppInstance.findFirst.mockResolvedValueOnce(null);

    normalizeUpsertEventMock.mockReturnValueOnce({
      normalized: [
        {
          messageIndex: 0,
          messageId: 'wamid.fail',
          sessionId: null,
          brokerId: null,
          tenantId: 'tenant-uuid',
          messageType: 'text',
          messageUpsertType: 'notify',
          isGroup: false,
          data: {
            instanceId: 'instance-1',
            tenantId: 'tenant-uuid',
            direction: 'INBOUND',
            metadata: {
              instanceId: 'instance-1',
              contact: { remoteJid: '5511999999999@s.whatsapp.net' },
            },
            message: {
              key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid.fail' },
            },
            contact: { phone: '+55 11 99999-9999' },
          },
        },
      ],
    });

    ingestInboundWhatsAppMessageMock.mockResolvedValueOnce(false);

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .send({
        event: 'WHATSAPP_MESSAGES_UPSERT',
        instanceId: 'instance-1',
        payload: {
          messages: [
            {
              key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid.fail' },
            },
          ],
        },
      });

    expect(response.status).toBe(204);

    await inboundQueueTesting.waitForIdle();

    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="ingest_failed"[^}]*result="failed"[^}]*\} 1/
    );
  });

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
          messageType: 'text',
          messageUpsertType: 'notify',
          isGroup: false,
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

    expect(response.status).toBe(204);

    await inboundQueueTesting.waitForIdle();

    expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledTimes(1);
    const lookupArgs = prismaMock.whatsAppInstance.findFirst.mock.calls[0]?.[0];
    expect(lookupArgs).toBeTruthy();
    expect(lookupArgs).toMatchObject({
      where: {
        OR: expect.arrayContaining([
          expect.objectContaining({ id: uuid }),
          expect.objectContaining({ brokerId: uuid }),
        ]),
      },
      select: { id: true, brokerId: true, tenantId: true },
    });

    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledWith({
      where: { id: 'stored-instance' },
      data: { brokerId: 'stored-instance' },
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
