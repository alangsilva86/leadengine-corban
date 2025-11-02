import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __testing as webhookControllerTesting,
  handleVerification,
  handleWhatsAppWebhook,
  verifyWhatsAppWebhookRequest,
  webhookRateLimiter,
} from '../webhook-controller';
import { PollVoteUpdateState } from '../../services/poll-vote-updater';
import type { RawBaileysUpsertEvent } from '../../services/baileys-raw-normalizer';
import { resetMetrics, renderMetrics } from '../../../../lib/metrics';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';
import { __testing as inboundQueueTesting } from '../../services/inbound-queue';
import { asyncHandler } from '../../../../middleware/error-handler';
import {
  createPollChoiceEventEnvelope,
  createPollChoiceVoteState,
} from './helpers/poll-fixtures';

const hoistedMocks = vi.hoisted(() => {
  const processedIntegrationEventCreateMock = vi.fn();
  const processedIntegrationEventFindUniqueMock = vi.fn();
  const processedIntegrationEventUpsertMock = vi.fn();
  const whatsAppInstanceFindFirstMock = vi.fn();
  const whatsAppInstanceFindUniqueMock = vi.fn();
  const whatsAppInstanceUpdateMock = vi.fn();
  const ingestInboundWhatsAppMessageMock = vi.fn();
  const normalizeUpsertEventMock = vi.fn();
  const recordPollChoiceVoteMock = vi.fn();
  const recordEncryptedPollVoteMock = vi.fn();
  const syncPollChoiceStateMock = vi.fn();
  const triggerPollChoiceInboxNotificationMock = vi.fn();
  const messageFindFirstMock = vi.fn();
  const applyBrokerAckMock = vi.fn();
  const storageFindMessageByExternalIdMock = vi.fn();
  const findPollVoteMessageCandidateMock = vi.fn();
  const storageUpdateMessageMock = vi.fn();
  const upsertPollMetadataMock = vi.fn();
  const getPollMetadataMock = vi.fn();

  const prisma = {
    processedIntegrationEvent: {
      create: processedIntegrationEventCreateMock,
      findUnique: processedIntegrationEventFindUniqueMock,
      upsert: processedIntegrationEventUpsertMock,
    },
    whatsAppInstance: {
      findFirst: whatsAppInstanceFindFirstMock,
      findUnique: whatsAppInstanceFindUniqueMock,
      update: whatsAppInstanceUpdateMock,
    },
    message: {
      findFirst: messageFindFirstMock,
    },
  };

  return {
    prisma,
    processedIntegrationEventCreateMock,
    processedIntegrationEventFindUniqueMock,
    processedIntegrationEventUpsertMock,
    whatsAppInstanceFindFirstMock,
    whatsAppInstanceFindUniqueMock,
    whatsAppInstanceUpdateMock,
    ingestInboundWhatsAppMessageMock,
    normalizeUpsertEventMock,
    recordPollChoiceVoteMock,
    syncPollChoiceStateMock,
    triggerPollChoiceInboxNotificationMock,
    messageFindFirstMock,
    applyBrokerAckMock,
    storageFindMessageByExternalIdMock,
    findPollVoteMessageCandidateMock,
    storageUpdateMessageMock,
    recordEncryptedPollVoteMock,
    upsertPollMetadataMock,
    getPollMetadataMock,
  };
});

vi.mock('../../../../lib/prisma', () => ({ prisma: hoistedMocks.prisma }));

vi.mock('../../services/inbound-lead-service', () => ({
  ingestInboundWhatsAppMessage: hoistedMocks.ingestInboundWhatsAppMessageMock,
}));

vi.mock('../../services/baileys-raw-normalizer', () => ({
  normalizeUpsertEvent: hoistedMocks.normalizeUpsertEventMock,
}));

vi.mock('../../services/poll-choice-service', () => ({
  recordPollChoiceVote: hoistedMocks.recordPollChoiceVoteMock,
  recordEncryptedPollVote: hoistedMocks.recordEncryptedPollVoteMock,
}));

vi.mock('../../services/poll-choice-sync-service', () => ({
  syncPollChoiceState: hoistedMocks.syncPollChoiceStateMock,
}));

vi.mock('../../services/poll-choice-inbox-service', () => ({
  PollChoiceInboxNotificationStatus: {
    Ok: 'ok',
    MissingTenant: 'missing_tenant',
    InvalidChatId: 'invalid_chat_id',
    IngestRejected: 'ingest_rejected',
    IngestError: 'ingest_error',
  },
  triggerPollChoiceInboxNotification: hoistedMocks.triggerPollChoiceInboxNotificationMock,
}));

vi.mock('../../services/poll-metadata-service', () => ({
  upsertPollMetadata: hoistedMocks.upsertPollMetadataMock,
  getPollMetadata: hoistedMocks.getPollMetadataMock,
}));
vi.mock('@ticketz/storage', () => ({
  $Enums: { MessageType: {} },
  applyBrokerAck: hoistedMocks.applyBrokerAckMock,
  findMessageByExternalId: hoistedMocks.storageFindMessageByExternalIdMock,
  findPollVoteMessageCandidate: hoistedMocks.findPollVoteMessageCandidateMock,
  updateMessage: hoistedMocks.storageUpdateMessageMock,
}));

const prismaMock = hoistedMocks.prisma;
const {
  processedIntegrationEventCreateMock,
  processedIntegrationEventFindUniqueMock,
  processedIntegrationEventUpsertMock,
  whatsAppInstanceFindFirstMock,
  whatsAppInstanceFindUniqueMock,
  whatsAppInstanceUpdateMock: _whatsAppInstanceUpdateMock,
  ingestInboundWhatsAppMessageMock,
  normalizeUpsertEventMock,
  recordPollChoiceVoteMock,
  recordEncryptedPollVoteMock,
  syncPollChoiceStateMock,
  triggerPollChoiceInboxNotificationMock,
  messageFindFirstMock,
  applyBrokerAckMock,
  storageFindMessageByExternalIdMock,
  findPollVoteMessageCandidateMock,
  storageUpdateMessageMock,
  upsertPollMetadataMock,
  getPollMetadataMock,
} = hoistedMocks;


const ORIGINAL_ENV = {
  enforce: process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE,
  secret: process.env.WHATSAPP_WEBHOOK_HMAC_SECRET,
  defaultInstanceId: process.env.WHATSAPP_DEFAULT_INSTANCE_ID,
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
  const router = express.Router();
  router.post(
    '/whatsapp',
    webhookRateLimiter,
    asyncHandler(verifyWhatsAppWebhookRequest),
    asyncHandler(handleWhatsAppWebhook)
  );
  router.get('/whatsapp', handleVerification);
  app.use('/api/webhooks', router);
  return app;
};

describe('buildPollVoteMessageContent', () => {
  it('returns normalized text for a single selected option', () => {
    const selected = [{ id: 'opt-yes', title: ' Sim 👍 ' }];

    const result = webhookControllerTesting.buildPollVoteMessageContent(selected);

    expect(result).toBe('Sim 👍');
  });

  it('returns null when no normalized titles are available', () => {
    const selected = [{ id: '   ', title: '   ' }];

    const result = webhookControllerTesting.buildPollVoteMessageContent(selected);

    expect(result).toBeNull();
  });
});

afterEach(async () => {
  await inboundQueueTesting.waitForIdle();
  vi.clearAllMocks();
  inboundQueueTesting.resetQueue();
});

describe('WhatsApp webhook HMAC signature enforcement', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'true';
    process.env.WHATSAPP_WEBHOOK_HMAC_SECRET = 'unit-secret';
    if (ORIGINAL_ENV.defaultInstanceId) {
      process.env.WHATSAPP_DEFAULT_INSTANCE_ID = ORIGINAL_ENV.defaultInstanceId;
    } else {
      delete process.env.WHATSAPP_DEFAULT_INSTANCE_ID;
    }
    refreshWhatsAppEnv();
    resetMetrics();
    prismaMock.whatsAppInstance.findFirst.mockReset();
    prismaMock.whatsAppInstance.findUnique.mockReset();
    prismaMock.whatsAppInstance.update.mockReset();
    prismaMock.message.findFirst.mockReset();
    prismaMock.message.findFirst.mockResolvedValue(null);
    ingestInboundWhatsAppMessageMock.mockReset();
    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValue({ normalized: [] });
    recordPollChoiceVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockResolvedValue(undefined);
    applyBrokerAckMock.mockReset();
    storageFindMessageByExternalIdMock.mockReset();
    storageFindMessageByExternalIdMock.mockResolvedValue(null);
    findPollVoteMessageCandidateMock.mockReset();
    findPollVoteMessageCandidateMock.mockResolvedValue(null);
    storageUpdateMessageMock.mockReset();
    upsertPollMetadataMock.mockReset();
    upsertPollMetadataMock.mockResolvedValue(undefined);
    getPollMetadataMock.mockReset();
    getPollMetadataMock.mockResolvedValue(null);
    syncPollChoiceStateMock.mockReset();
    syncPollChoiceStateMock.mockResolvedValue(true);
    triggerPollChoiceInboxNotificationMock.mockReset();
    triggerPollChoiceInboxNotificationMock.mockResolvedValue({ status: 'ok', persisted: true });
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

  describe.each(['x-signature-sha256', 'x-signature'] as const)('using %s header', (headerName) => {
    it('rejects requests with mismatching signature', async () => {
      const app = buildApp();
      const response = await request(app)
        .post('/api/webhooks/whatsapp')
        .set(headerName, 'deadbeef')
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
        .set(headerName, signature)
        .send(payload);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });

  it('prefers the x-signature header over the legacy alias when both are provided', async () => {
    const app = buildApp();
    const payload = { event: 'preferred' };
    const raw = JSON.stringify(payload);
    const crypto = await import('node:crypto');
    const validSignature = crypto.createHmac('sha256', 'unit-secret').update(raw).digest('hex');

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-signature', validSignature)
      .set('x-signature-sha256', 'deadbeef')
      .send(payload);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it('rejects when the preferred header mismatches even if the legacy alias matches', async () => {
    const app = buildApp();
    const payload = { event: 'mismatch' };
    const raw = JSON.stringify(payload);
    const crypto = await import('node:crypto');
    const validSignature = crypto.createHmac('sha256', 'unit-secret').update(raw).digest('hex');

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('x-signature', 'deadbeef')
      .set('x-signature-sha256', validSignature)
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_SIGNATURE');
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
    prismaMock.message.findFirst.mockReset();
    prismaMock.message.findFirst.mockResolvedValue(null);
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
    recordPollChoiceVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockResolvedValue(undefined);
    applyBrokerAckMock.mockReset();
    storageFindMessageByExternalIdMock.mockReset();
    storageFindMessageByExternalIdMock.mockResolvedValue(null);
    storageUpdateMessageMock.mockReset();
    upsertPollMetadataMock.mockReset();
    upsertPollMetadataMock.mockResolvedValue(undefined);
    syncPollChoiceStateMock.mockReset();
    syncPollChoiceStateMock.mockResolvedValue(true);
    triggerPollChoiceInboxNotificationMock.mockReset();
    triggerPollChoiceInboxNotificationMock.mockResolvedValue({ status: 'ok', persisted: true });
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

  it('fills missing payload instanceId for broker contract events using the envelope', async () => {
    normalizeUpsertEventMock.mockClear();
    const app = buildApp();

    const eventPayload = {
      id: 'broker-event-2',
      type: 'MESSAGE_INBOUND',
      tenantId: 'tenant-42',
      instanceId: 'instance-2',
      timestamp: '2024-01-02T00:00:00.000Z',
      payload: {
        timestamp: '2024-01-02T00:00:00.000Z',
        direction: 'INBOUND',
        contact: { phone: '+55 11 98888-8888', name: 'João' },
        message: { id: 'wamid-2', type: 'text', text: 'Oi!' },
        metadata: {
          contact: { remoteJid: '5511988888888@s.whatsapp.net' },
          broker: { brokerId: 'broker-2' },
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
      instanceId: 'instance-2',
      messageId: 'wamid-2',
      direction: 'INBOUND',
      normalizedIndex: 0,
    });

    const metrics = renderMetrics();
    expect(metrics).not.toMatch(/invalid_contract/);
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
    prismaMock.message.findFirst.mockReset();
    prismaMock.message.findFirst.mockResolvedValue(null);
    ingestInboundWhatsAppMessageMock.mockReset();
    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValue({ normalized: [] });
    recordPollChoiceVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockResolvedValue(undefined);
    applyBrokerAckMock.mockReset();
    storageFindMessageByExternalIdMock.mockReset();
    storageFindMessageByExternalIdMock.mockResolvedValue(null);
    storageUpdateMessageMock.mockReset();
    upsertPollMetadataMock.mockReset();
    upsertPollMetadataMock.mockResolvedValue(undefined);
    syncPollChoiceStateMock.mockReset();
    syncPollChoiceStateMock.mockResolvedValue(true);
    triggerPollChoiceInboxNotificationMock.mockReset();
    triggerPollChoiceInboxNotificationMock.mockResolvedValue({ status: 'ok', persisted: true });
  });

  const createInstanceApp = () => {
    const app = buildApp();
    return app;
  };

  it('signals failure when ingestion does not persist message', async () => {
    const app = createInstanceApp();
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
    const app = createInstanceApp();
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
      data: { brokerId: uuid },
    });

    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'stored-instance',
        tenantId: 'tenant-uuid',
      })
    );
  });

  it('reuses persisted instances for sequential Baileys events sharing the same broker id', async () => {
    const app = buildApp();
    const storedInstanceId = 'stored-instance';
    const rawBrokerId = 'baileys-instance';
    const tenantId = 'tenant-uuid';

    prismaMock.whatsAppInstance.findFirst.mockReset();
    prismaMock.whatsAppInstance.findFirst
      .mockResolvedValueOnce({ id: storedInstanceId, brokerId: storedInstanceId, tenantId })
      .mockResolvedValueOnce({ id: storedInstanceId, brokerId: rawBrokerId, tenantId });

    prismaMock.whatsAppInstance.update.mockReset();
    prismaMock.whatsAppInstance.update.mockResolvedValue({
      id: storedInstanceId,
      brokerId: rawBrokerId,
      tenantId,
    });

    ingestInboundWhatsAppMessageMock.mockReset();
    ingestInboundWhatsAppMessageMock.mockResolvedValue(true);

    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValue({
      normalized: [
        {
          messageIndex: 0,
          messageId: 'wamid-1',
          sessionId: null,
          brokerId: rawBrokerId,
          tenantId,
          messageType: 'text',
          messageUpsertType: 'notify',
          isGroup: false,
          data: {
            instanceId: storedInstanceId,
            tenantId,
            direction: 'INBOUND',
            metadata: {
              instanceId: storedInstanceId,
              tenantId,
            },
            message: {
              key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid-1' },
            },
            contact: { phone: '+55 11 99999-9999' },
          },
        },
      ],
    });

    const payload = {
      event: 'WHATSAPP_MESSAGES_UPSERT',
      instanceId: rawBrokerId,
      tenantId,
      payload: {
        instanceId: rawBrokerId,
        tenantId,
        messages: [
          {
            key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid-1' },
          },
        ],
      },
    };

    const firstResponse = await request(app).post('/api/webhooks/whatsapp').send(payload);
    expect(firstResponse.status).toBe(204);
    await inboundQueueTesting.waitForIdle();

    expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledWith({
      where: { id: storedInstanceId },
      data: { brokerId: rawBrokerId },
    });

    expect(normalizeUpsertEventMock).toHaveBeenCalledTimes(1);
    expect(normalizeUpsertEventMock.mock.calls[0]?.[1]).toMatchObject({
      brokerId: rawBrokerId,
      instanceId: storedInstanceId,
      tenantId,
    });

    const firstEnvelope = ingestInboundWhatsAppMessageMock.mock.calls[0]?.[0];
    expect(firstEnvelope?.instanceId).toBe(storedInstanceId);
    expect(firstEnvelope?.tenantId).toBe(tenantId);
    expect(firstEnvelope?.message?.metadata?.brokerId).toBe(rawBrokerId);

    const secondResponse = await request(app).post('/api/webhooks/whatsapp').send(payload);
    expect(secondResponse.status).toBe(204);
    await inboundQueueTesting.waitForIdle();

    expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledTimes(2);
    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledTimes(1);

    expect(normalizeUpsertEventMock).toHaveBeenCalledTimes(2);
    expect(normalizeUpsertEventMock.mock.calls[1]?.[1]).toMatchObject({
      brokerId: rawBrokerId,
      instanceId: storedInstanceId,
      tenantId,
    });

    const secondEnvelope = ingestInboundWhatsAppMessageMock.mock.calls[1]?.[0];
    expect(secondEnvelope?.instanceId).toBe(storedInstanceId);
    expect(secondEnvelope?.tenantId).toBe(tenantId);
    expect(secondEnvelope?.message?.metadata?.brokerId).toBe(rawBrokerId);
  });

  it('falls back to the default instance id when direct broker reconciliation misses', async () => {
    const app = buildApp();
    const defaultInstanceId = 'default-instance';
    const rawBrokerId = 'baileys-instance';
    const tenantId = 'tenant-uuid';

    process.env.WHATSAPP_DEFAULT_INSTANCE_ID = defaultInstanceId;
    refreshWhatsAppEnv();

    prismaMock.whatsAppInstance.findFirst.mockResolvedValueOnce(null);
    prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce({
      id: defaultInstanceId,
      brokerId: defaultInstanceId,
      tenantId,
    });

    prismaMock.whatsAppInstance.update.mockResolvedValue({
      id: defaultInstanceId,
      brokerId: rawBrokerId,
      tenantId,
    });

    ingestInboundWhatsAppMessageMock.mockResolvedValueOnce(true);

    normalizeUpsertEventMock.mockReturnValue({
      normalized: [
        {
          messageIndex: 0,
          messageId: 'wamid-legacy',
          sessionId: null,
          brokerId: rawBrokerId,
          tenantId,
          messageType: 'text',
          messageUpsertType: 'notify',
          isGroup: false,
          data: {
            instanceId: defaultInstanceId,
            tenantId,
            direction: 'INBOUND',
            metadata: {
              instanceId: defaultInstanceId,
              tenantId,
            },
            message: {
              key: { remoteJid: '5511888888888@s.whatsapp.net', id: 'wamid-legacy' },
            },
            contact: { phone: '+55 11 88888-8888' },
          },
        },
      ],
    });

    const payload = {
      event: 'WHATSAPP_MESSAGES_UPSERT',
      instanceId: rawBrokerId,
      tenantId,
      payload: {
        instanceId: rawBrokerId,
        tenantId,
        messages: [
          {
            key: { remoteJid: '5511888888888@s.whatsapp.net', id: 'wamid-legacy' },
          },
        ],
      },
    };

    const response = await request(app).post('/api/webhooks/whatsapp').send(payload);
    expect(response.status).toBe(204);

    await inboundQueueTesting.waitForIdle();

    expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppInstance.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppInstance.findUnique).toHaveBeenCalledWith({
      where: { id: defaultInstanceId },
      select: { id: true, brokerId: true, tenantId: true },
    });

    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.whatsAppInstance.update).toHaveBeenCalledWith({
      where: { id: defaultInstanceId },
      data: { brokerId: rawBrokerId },
    });

    expect(normalizeUpsertEventMock).toHaveBeenCalledTimes(1);
    expect(normalizeUpsertEventMock.mock.calls[0]?.[1]).toMatchObject({
      brokerId: rawBrokerId,
      instanceId: defaultInstanceId,
      tenantId,
    });

    const envelope = ingestInboundWhatsAppMessageMock.mock.calls[0]?.[0];
    expect(envelope?.instanceId).toBe(defaultInstanceId);
    expect(envelope?.tenantId).toBe(tenantId);
    expect(envelope?.message?.metadata?.brokerId).toBe(rawBrokerId);
  });
});

describe('WhatsApp webhook poll choice events', () => {
  const pollChoiceEvents: Array<{ event: string; payload: unknown }> = [];
  let pollChoiceSubscriptions: Array<() => void> = [];

  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'false';
    delete process.env.WHATSAPP_WEBHOOK_HMAC_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_API_KEY;
    if (ORIGINAL_ENV.defaultInstanceId) {
      process.env.WHATSAPP_DEFAULT_INSTANCE_ID = ORIGINAL_ENV.defaultInstanceId;
    } else {
      delete process.env.WHATSAPP_DEFAULT_INSTANCE_ID;
    }
    refreshWhatsAppEnv();
    resetMetrics();
    recordPollChoiceVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockResolvedValue(undefined);
    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValue({ normalized: [] });
    processedIntegrationEventCreateMock.mockReset();
    processedIntegrationEventCreateMock.mockResolvedValue({} as never);
    applyBrokerAckMock.mockReset();
    storageFindMessageByExternalIdMock.mockReset();
    storageFindMessageByExternalIdMock.mockResolvedValue(null);
    storageUpdateMessageMock.mockReset();
    upsertPollMetadataMock.mockReset();
    upsertPollMetadataMock.mockResolvedValue(undefined);
    getPollMetadataMock.mockReset();
    getPollMetadataMock.mockResolvedValue(null);
    prismaMock.message.findFirst.mockReset();
    prismaMock.message.findFirst.mockResolvedValue(null);
    prismaMock.whatsAppInstance.findUnique.mockReset();
    syncPollChoiceStateMock.mockReset();
    syncPollChoiceStateMock.mockResolvedValue(true);
    triggerPollChoiceInboxNotificationMock.mockReset();
    triggerPollChoiceInboxNotificationMock.mockResolvedValue({ status: 'ok', persisted: true });
    pollChoiceEvents.length = 0;
    pollChoiceSubscriptions.forEach((unsubscribe) => unsubscribe());
    pollChoiceSubscriptions = [
      webhookControllerTesting.subscribeToPollChoiceEvent('pollChoiceCompleted', (payload) => {
        pollChoiceEvents.push({ event: 'pollChoiceCompleted', payload });
      }),
    ];
  });

  afterEach(() => {
    pollChoiceSubscriptions.forEach((unsubscribe) => unsubscribe());
    pollChoiceSubscriptions = [];
  });

  describe('event handler map', () => {
    afterEach(() => {
      webhookControllerTesting.eventHandlers.resetAll();
    });

    it('dispatches POLL_CHOICE events to the poll handler', async () => {
      const pollHandler = vi.fn().mockResolvedValue({ persisted: 1, ignored: 0, failures: 0 });

      webhookControllerTesting.eventHandlers.override('POLL_CHOICE', {
        kind: 'poll',
        handler: pollHandler,
      });

      const eventRecord = { event: 'POLL_CHOICE' } as RawBaileysUpsertEvent;
      const envelope: Record<string, unknown> = {};
      const context = { requestId: 'evt-map' };

      const result = await webhookControllerTesting.eventHandlers.dispatch(
        'POLL_CHOICE',
        eventRecord,
        envelope,
        context
      );

      expect(pollHandler).toHaveBeenCalledWith(eventRecord, envelope, context);
      expect(result).toEqual({ kind: 'poll', outcome: { persisted: 1, ignored: 0, failures: 0 } });
    });
  });

  it('captures poll metadata from poll creation messages', async () => {
    normalizeUpsertEventMock.mockReset();
    normalizeUpsertEventMock.mockReturnValueOnce({
      normalized: [
        {
          messageIndex: 0,
          messageId: 'poll-msg-1',
          sessionId: null,
          brokerId: null,
          tenantId: 'tenant-123',
          messageType: 'poll',
          messageUpsertType: 'notify',
          isGroup: false,
          data: {
            instanceId: 'instance-1',
            tenantId: 'tenant-123',
            direction: 'INBOUND',
            metadata: {
              contact: { remoteJid: '5511999999999@s.whatsapp.net' },
            },
            message: {
              key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'poll-msg-1' },
              text: 'Você confirma?',
              pollCreationMessage: {
                name: 'Você confirma?',
                options: [
                  { id: 'opt-1', title: 'Sim 👍', index: 0 },
                  { id: 'opt-2', title: 'Não', index: 1 },
                ],
                selectableOptionsCount: 1,
                allowMultipleAnswers: false,
              },
              pollContextInfo: {
                messageSecret: 'secret-value',
                messageSecretVersion: 1,
              },
            },
            contact: { phone: '+55 11 99999-9999' },
          },
        },
      ],
    });
    ingestInboundWhatsAppMessageMock.mockResolvedValueOnce(true);

    const response = await request(buildApp())
      .post('/api/webhooks/whatsapp')
      .send({
        event: 'WHATSAPP_MESSAGES_UPSERT',
        instanceId: 'instance-1',
        payload: { messages: [] },
      });

    expect(response.status).toBe(204);
    await inboundQueueTesting.waitForIdle();
    expect(upsertPollMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pollId: 'poll-msg-1',
        question: 'Você confirma?',
        options: expect.arrayContaining([expect.objectContaining({ id: 'opt-1' })]),
        messageSecret: 'secret-value',
      })
    );
  });

  it('delegates poll choice events to dedicated service', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    prismaMock.message.findFirst.mockResolvedValueOnce(null);
    triggerPollChoiceInboxNotificationMock.mockResolvedValueOnce({
      status: 'ok',
      persisted: true,
    });
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: createPollChoiceVoteState({
        pollId: 'poll-1',
        options: [
          { id: 'opt-1', title: 'Option 1', index: 0 },
          { id: 'opt-2', title: 'Option 2', index: 1 },
        ],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            messageId: 'wamid-poll-1',
            timestamp: now,
          },
        },
        aggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1 },
        },
        brokerAggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1 },
        },
        updatedAt: now,
      }),
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });

    const app = buildApp();

    storageFindMessageByExternalIdMock.mockResolvedValueOnce({
      id: 'message-db-id',
      content: '[Mensagem recebida via WhatsApp]',
      metadata: {},
    } as never);

    const response = await request(app)
      .post('/api/webhooks/whatsapp')
      .send(
        createPollChoiceEventEnvelope({
          payload: {
            pollId: 'poll-1',
            voterJid: '5511999999999@s.whatsapp.net',
            messageId: 'wamid-poll-1',
            selectedOptionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            options: [
              { id: 'opt-1', title: 'Option 1', selected: true },
              { id: 'opt-2', title: 'Option 2', selected: false },
            ],
            aggregates: {
              totalVoters: 1,
              totalVotes: 1,
              optionTotals: { 'opt-1': 1, 'opt-2': 0 },
            },
            timestamp: now,
          },
        })
      );

    expect(response.status).toBe(204);
    expect(recordPollChoiceVoteMock).toHaveBeenCalledTimes(1);
    const [payloadArg, contextArg] = recordPollChoiceVoteMock.mock.calls[0] ?? [];
    expect(payloadArg).toMatchObject({ pollId: 'poll-1', voterJid: '5511999999999@s.whatsapp.net' });
    expect(contextArg).toMatchObject({ tenantId: 'tenant-123' });
    expect(syncPollChoiceStateMock).toHaveBeenCalledTimes(1);
    expect(findPollVoteMessageCandidateMock).toHaveBeenCalledWith({
      tenantId: 'tenant-123',
      pollId: 'poll-1',
      chatId: '5511999999999@s.whatsapp.net',
      identifiers: expect.arrayContaining(['poll-1', 'wamid-poll-1']),
    });
    expect(triggerPollChoiceInboxNotificationMock).toHaveBeenCalledTimes(1);
    expect(triggerPollChoiceInboxNotificationMock).toHaveBeenCalledWith({
      poll: expect.objectContaining({ pollId: 'poll-1' }),
      tenantId: 'tenant-123',
      instanceId: null,
      requestId: expect.any(String),
      state: expect.objectContaining({ pollId: 'poll-1' }),
      selectedOptions: expect.arrayContaining([{ id: 'opt-1', title: 'Option 1' }]),
    });
    expect(storageFindMessageByExternalIdMock).toHaveBeenCalledWith('tenant-123', 'wamid-poll-1');
    expect(storageUpdateMessageMock).toHaveBeenCalledWith(
      'tenant-123',
      'message-db-id',
      expect.objectContaining({
        content: 'Option 1',
        metadata: expect.anything(),
      })
    );

    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="poll_choice"[^}]*result="accepted"[^}]*\} 1/
    );
    const completion = pollChoiceEvents.find((entry) => entry.event === 'pollChoiceCompleted');
    expect(completion?.payload).toMatchObject({ outcome: 'accepted', reason: 'poll_choice' });
  });

  it('falls back to poll metadata tenant when vote context is missing', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    prismaMock.message.findFirst.mockResolvedValueOnce(null);
    triggerPollChoiceInboxNotificationMock.mockResolvedValueOnce({
      status: 'ok',
      persisted: true,
    });
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-metadata',
        context: {},
        options: [{ id: 'opt-1', title: 'Option 1', index: 0 }],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            messageId: 'wamid-metadata',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        updatedAt: now,
      },
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });

    getPollMetadataMock.mockResolvedValueOnce({ pollId: 'poll-metadata', tenantId: 'tenant-meta' });

    storageFindMessageByExternalIdMock.mockResolvedValueOnce({
      id: 'message-db-id',
      content: '[Mensagem recebida via WhatsApp]',
      metadata: {},
    } as never);

    const app = buildApp();

    const response = await request(app).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      payload: {
        pollId: 'poll-metadata',
        voterJid: '5511999999999@s.whatsapp.net',
        messageId: 'wamid-metadata',
        selectedOptionIds: ['opt-1'],
        selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
        options: [{ id: 'opt-1', title: 'Option 1', selected: true }],
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        timestamp: now,
      },
    });

    expect(response.status).toBe(204);
    expect(getPollMetadataMock).toHaveBeenCalledWith('poll-metadata');
    expect(storageUpdateMessageMock).toHaveBeenCalledWith(
      'tenant-meta',
      'message-db-id',
      expect.objectContaining({
        content: 'Option 1',
      })
    );
  });

  it('retries poll vote message update after tenant metadata becomes available', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    prismaMock.message.findFirst.mockResolvedValueOnce(null);
    triggerPollChoiceInboxNotificationMock.mockResolvedValueOnce({
      status: 'ok',
      persisted: true,
    });
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-retry',
        context: {},
        options: [{ id: 'opt-1', title: 'Option 1', index: 0 }],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            messageId: 'wamid-retry',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        updatedAt: now,
      },
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });

    getPollMetadataMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      pollId: 'poll-retry',
      tenantId: 'tenant-delayed',
    });

    storageFindMessageByExternalIdMock.mockResolvedValueOnce({
      id: 'message-db-id',
      content: '[Mensagem recebida via WhatsApp]',
      metadata: {},
    } as never);

    const schedulerSpy = vi.fn(async (callback, delayMs) => {
      expect(delayMs).toBe(500);
      await callback();
    });

    webhookControllerTesting.setPollVoteRetryScheduler(schedulerSpy);
    webhookControllerTesting.pollChoice.setPollVoteRetryScheduler(schedulerSpy);

    try {
      const app = buildApp();

      const response = await request(app).post('/api/webhooks/whatsapp').send({
        event: 'POLL_CHOICE',
        payload: {
          pollId: 'poll-retry',
          voterJid: '5511999999999@s.whatsapp.net',
          messageId: 'wamid-retry',
          selectedOptionIds: ['opt-1'],
          selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
          options: [{ id: 'opt-1', title: 'Option 1', selected: true }],
          aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
          timestamp: now,
        },
      });

      expect(response.status).toBe(204);
      expect(schedulerSpy).toHaveBeenCalledTimes(1);
      expect(getPollMetadataMock).toHaveBeenCalledWith('poll-retry');
      expect(getPollMetadataMock).toHaveBeenCalledTimes(2);
      expect(storageUpdateMessageMock).toHaveBeenCalledWith(
        'tenant-delayed',
        'message-db-id',
        expect.objectContaining({
          content: 'Option 1',
        })
      );
    } finally {
      webhookControllerTesting.resetPollVoteRetryScheduler();
      webhookControllerTesting.pollChoice.resetPollVoteRetryScheduler();
    }
  });
  /*
  it('includes poll creation message id when updating vote messages', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    prismaMock.message.findFirst.mockResolvedValueOnce(null);
    triggerPollChoiceInboxNotificationMock.mockResolvedValueOnce({
      status: 'ok',
      persisted: true,
    });
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-with-creation',
        options: [],
        votes: {},
      },
    });

    await webhookControllerTesting.dispatchPollChoiceEvent({
      event: 'vote',
      tenantId: 'tenant-id',
      instanceId: 'instance-id',
      timestamp: now,
      payload: {
        pollId: 'poll-with-creation',
        vote: {
          voterJid: 'user@wa',
          optionIds: ['opt-1'],
        },
      },
    });

    expect(triggerPollChoiceInboxNotificationMock).toHaveBeenCalled();

  });

  it('skips poll choice inbox notification when existing poll message is found', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    findPollVoteMessageCandidateMock.mockResolvedValueOnce({
      id: 'existing-poll-message-id',
      metadata: {
        poll: { selectedOptionIds: ['opt-1'] },
        pollChoice: { vote: { optionIds: ['opt-1'] } },
        pollVote: { selectedOptions: [{ id: 'opt-1', title: 'Option 1' }] },
      },
    } as never);
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-existing',
        options: [{ id: 'opt-1', title: 'Option 1', index: 0 }],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            messageId: 'wamid-vote',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
            messageId: 'wamid-poll-existing',
            timestamp: now,
          },
        },
        aggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1 },
        },
        brokerAggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1 },
        },
        updatedAt: now,
      },
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });

    const updatePollVoteMessageSpy = vi.fn().mockResolvedValue({
      status: 'updated',
      state: PollVoteUpdateState.Completed,
      tenantId: 'tenant-321',
      storageMessageId: 'storage-message',
      messageId: 'storage-message',
      candidates: [],
      metadataChanged: true,
      contentUpdated: true,
      captionUpdated: false,
    });
    webhookControllerTesting.setUpdatePollVoteMessageHandler(updatePollVoteMessageSpy);
    webhookControllerTesting.pollChoice.setUpdatePollVoteMessageHandler(updatePollVoteMessageSpy);

    try {
      const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
        event: 'POLL_CHOICE',
        tenantId: 'tenant-321',
        payload: {
          pollId: 'poll-with-creation',
          voterJid: '5511999999999@s.whatsapp.net',
          messageId: 'wamid-vote',
          pollCreationMessageKey: {
            id: 'wamid-creation',
            remoteJid: '5511999999999@s.whatsapp.net',
          },
          options: [{ id: 'opt-1', title: 'Option 1', selected: true }],
          aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
          timestamp: now,
        },
      });

      expect(response.status).toBe(204);
      expect(updatePollVoteMessageSpy).toHaveBeenCalledTimes(1);
      expect(updatePollVoteMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messageIds: expect.arrayContaining(['wamid-vote', 'wamid-creation', 'poll-with-creation']),
        })
      );
    } finally {
      webhookControllerTesting.resetUpdatePollVoteMessageHandler();
      webhookControllerTesting.pollChoice.resetUpdatePollVoteMessageHandler();
    }
    storageFindMessageByExternalIdMock.mockResolvedValueOnce({
      id: 'message-db-id',
      content: '[Mensagem recebida via WhatsApp]',
      metadata: {},
    } as never);

    const app = buildApp();

    const response = await request(app).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      tenantId: 'tenant-123',
      payload: {
        pollId: 'poll-existing',
        voterJid: '5511999999999@s.whatsapp.net',
        messageId: 'wamid-poll-existing',
        selectedOptionIds: ['opt-1'],
        selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
        options: [
          { id: 'opt-1', title: 'Option 1', selected: true },
          { id: 'opt-2', title: 'Option 2', selected: false },
        ],
        aggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1, 'opt-2': 0 },
        },
        timestamp: now,
      },
    });

    expect(response.status).toBe(204);
    expect(triggerPollChoiceInboxNotificationMock).not.toHaveBeenCalled();
    expect(findPollVoteMessageCandidateMock).toHaveBeenCalledWith({
      tenantId: 'tenant-123',
      pollId: 'poll-existing',
      chatId: '5511999999999@s.whatsapp.net',
      identifiers: expect.arrayContaining(['poll-existing', 'wamid-poll-existing']),
    });
  });
  */

  it('triggers poll choice inbox notification when existing poll metadata is outdated', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    findPollVoteMessageCandidateMock.mockResolvedValueOnce({
      id: 'stale-poll-message-id',
      metadata: {
        poll: { selectedOptionIds: ['opt-old'] },
        pollChoice: { vote: { optionIds: ['opt-old'] } },
      },
    } as never);
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-existing',
        options: [
          { id: 'opt-1', title: 'Option 1', index: 0 },
          { id: 'opt-2', title: 'Option 2', index: 1 },
        ],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            messageId: 'wamid-vote',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1, 'opt-2': 0 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1, 'opt-2': 0 } },
        updatedAt: now,
      },
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });

    const app = buildApp();

    const response = await request(app).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      tenantId: 'tenant-123',
      payload: {
        pollId: 'poll-existing',
        voterJid: '5511999999999@s.whatsapp.net',
        messageId: 'wamid-poll-existing',
        selectedOptionIds: ['opt-1'],
        selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
        options: [
          { id: 'opt-1', title: 'Option 1', selected: true },
          { id: 'opt-2', title: 'Option 2', selected: false },
        ],
        aggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1, 'opt-2': 0 },
        },
        timestamp: now,
      },
    });

    expect(response.status).toBe(204);
    expect(triggerPollChoiceInboxNotificationMock).toHaveBeenCalledTimes(1);
    expect(triggerPollChoiceInboxNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        poll: expect.objectContaining({ pollId: 'poll-existing' }),
        selectedOptions: expect.arrayContaining([expect.objectContaining({ id: 'opt-1' })]),
      })
    );
  });

  it('rewrites poll vote message using decrypted selections when webhook omits selection ids', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(true);
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-enc',
        options: [
          { id: 'opt-a', title: 'Option A', index: 0 },
          { id: 'opt-b', title: 'Option B', index: 1 },
        ],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-b'],
            selectedOptions: [{ id: 'opt-b', title: 'Option B' }],
            messageId: 'wamid-encrypted',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-b': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-b': 1 } },
        updatedAt: now,
      },
      selectedOptions: [{ id: 'opt-b', title: 'Option B' }],
    });

    const updatePollVoteMessageSpy = vi.fn().mockResolvedValue({
      status: 'updated',
      state: PollVoteUpdateState.Completed,
      tenantId: 'tenant-123',
      storageMessageId: 'storage-message',
      messageId: 'storage-message',
      candidates: [],
      metadataChanged: true,
      contentUpdated: true,
      captionUpdated: false,
    });
    webhookControllerTesting.setUpdatePollVoteMessageHandler(updatePollVoteMessageSpy);
    webhookControllerTesting.pollChoice.setUpdatePollVoteMessageHandler(updatePollVoteMessageSpy);

    try {
      const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
        event: 'POLL_CHOICE',
        tenantId: 'tenant-enc',
        payload: {
          pollId: 'poll-enc',
          voterJid: '5511999999999@s.whatsapp.net',
          messageId: 'wamid-encrypted',
          options: [
            { id: 'opt-a', title: 'Option A' },
            { id: 'opt-b', title: 'Option B' },
          ],
          aggregates: {
            totalVoters: 1,
            totalVotes: 1,
            optionTotals: { 'opt-b': 1 },
          },
          timestamp: now,
        },
      });

      expect(response.status).toBe(204);
      expect(updatePollVoteMessageSpy).toHaveBeenCalledTimes(1);
      expect(updatePollVoteMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedOptions: expect.arrayContaining([expect.objectContaining({ id: 'opt-b' })]),
        })
      );
    } finally {
      webhookControllerTesting.resetUpdatePollVoteMessageHandler();
      webhookControllerTesting.pollChoice.resetUpdatePollVoteMessageHandler();
    }
  });

  it('continues processing when decrypted selections cannot be recovered', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(true);
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-enc-failure',
        options: [{ id: 'opt-a', title: 'Option A', index: 0 }],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: [],
            selectedOptions: [],
            encryptedVote: { encPayload: 'payload', encIv: 'iv' },
            messageId: 'wamid-encrypted',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 0, totalVotes: 0, optionTotals: {} },
        brokerAggregates: { totalVoters: 0, totalVotes: 0, optionTotals: {} },
        updatedAt: now,
      },
      selectedOptions: [],
    });

    const updatePollVoteMessageSpy = vi.fn().mockResolvedValue({
      status: 'updated',
      state: PollVoteUpdateState.Completed,
      tenantId: 'tenant-456',
      storageMessageId: 'storage-message',
      messageId: 'storage-message',
      candidates: [],
      metadataChanged: true,
      contentUpdated: true,
      captionUpdated: false,
    });
    webhookControllerTesting.setUpdatePollVoteMessageHandler(updatePollVoteMessageSpy);
    webhookControllerTesting.pollChoice.setUpdatePollVoteMessageHandler(updatePollVoteMessageSpy);

    try {
      const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
        event: 'POLL_CHOICE',
        tenantId: 'tenant-enc',
        payload: {
          pollId: 'poll-enc-failure',
          voterJid: '5511999999999@s.whatsapp.net',
          messageId: 'wamid-encrypted',
          options: [{ id: 'opt-a', title: 'Option A' }],
          aggregates: { totalVoters: 0, totalVotes: 0, optionTotals: {} },
          timestamp: now,
        },
      });

      expect(response.status).toBe(204);
      expect(updatePollVoteMessageSpy).toHaveBeenCalledTimes(1);
      expect(updatePollVoteMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ selectedOptions: [] })
      );
    } finally {
      webhookControllerTesting.resetUpdatePollVoteMessageHandler();
      webhookControllerTesting.pollChoice.resetUpdatePollVoteMessageHandler();
    }
  });

  it('records poll choice inbox failure when tenant context is unavailable', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    prismaMock.message.findFirst.mockResolvedValueOnce(null);
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: createPollChoiceVoteState({
        pollId: 'poll-missing-tenant',
        options: [{ id: 'opt-1', title: 'Option 1', index: 0 }],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            messageId: 'wamid-missing-tenant',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        updatedAt: now,
      }),
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });

    const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      payload: {
        pollId: 'poll-missing-tenant',
        voterJid: '5511999999999@s.whatsapp.net',
        selectedOptionIds: ['opt-1'],
        options: [{ id: 'opt-1', title: 'Option 1', selected: true }],
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        timestamp: now,
      },
    });

    expect(response.status).toBe(204);
    expect(triggerPollChoiceInboxNotificationMock).not.toHaveBeenCalled();

    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="poll_choice_inbox_missing_tenant"[^}]*result="failed"[^}]*\} 1/
    );
    const failure = pollChoiceEvents.find((entry) => entry.event === 'pollChoiceCompleted');
    expect(failure?.payload).toMatchObject({
      outcome: 'failed',
      reason: 'poll_choice_inbox_missing_tenant',
    });
  });

  it('records poll choice inbox failure when synthetic message ingestion is rejected', async () => {
    const now = new Date().toISOString();
    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    prismaMock.message.findFirst.mockResolvedValueOnce(null);
    triggerPollChoiceInboxNotificationMock.mockResolvedValueOnce({
      status: 'ingest_rejected',
      persisted: false,
    });
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: createPollChoiceVoteState({
        pollId: 'poll-ingest-rejected',
        options: [{ id: 'opt-2', title: 'Option 2', index: 0 }],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-2'],
            selectedOptions: [{ id: 'opt-2', title: 'Option 2' }],
            messageId: 'wamid-ingest',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-2': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-2': 1 } },
        updatedAt: now,
      }),
      selectedOptions: [{ id: 'opt-2', title: 'Option 2' }],
    });

    const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      tenantId: 'tenant-abc',
      payload: {
        pollId: 'poll-ingest-rejected',
        voterJid: '5511999999999@s.whatsapp.net',
        selectedOptionIds: ['opt-2'],
        options: [{ id: 'opt-2', title: 'Option 2', selected: true }],
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-2': 1 } },
        timestamp: now,
      },
    });

    expect(response.status).toBe(204);
    expect(triggerPollChoiceInboxNotificationMock).toHaveBeenCalledTimes(1);

    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="poll_choice_inbox_ingest_rejected"[^}]*result="failed"[^}]*\} 1/
    );
    const failure = pollChoiceEvents.find((entry) => entry.event === 'pollChoiceCompleted');
    expect(failure?.payload).toMatchObject({
      outcome: 'failed',
      reason: 'poll_choice_inbox_ingest_rejected',
    });
  });

  it('records duplicate poll choice events as ignored', async () => {
    const now = new Date().toISOString();
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: false,
      state: createPollChoiceVoteState({
        pollId: 'poll-duplicate',
        options: [{ id: 'opt-1', title: 'Option', index: 0 }],
        votes: {
          'user@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option' }],
            messageId: 'wamid-dup',
            timestamp: now,
          },
        },
        aggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1 },
        },
        brokerAggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1 },
        },
        updatedAt: now,
      }),
      selectedOptions: [{ id: 'opt-1', title: 'Option' }],
    });

    const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      payload: {
        pollId: 'poll-duplicate',
        voterJid: 'user@s.whatsapp.net',
        options: [{ id: 'opt-1', title: 'Option', selected: true }],
        aggregates: {
          totalVoters: 1,
          totalVotes: 1,
          optionTotals: { 'opt-1': 1 },
        },
      },
    });

    expect(response.status).toBe(204);
    expect(recordPollChoiceVoteMock).toHaveBeenCalledTimes(1);

    const metrics = renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="poll_choice_duplicate"[^}]*result="ignored"[^}]*\} 1/
    );
    const duplicate = pollChoiceEvents.find((entry) => entry.event === 'pollChoiceCompleted');
    expect(duplicate?.payload).toMatchObject({ outcome: 'ignored', reason: 'poll_choice_duplicate' });
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
