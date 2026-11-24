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
import type { enqueueInboundWebhookJob } from '../../services/inbound-queue';
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
  const findInstances = vi.fn();
  const findActiveTenant = vi.fn();
  const enqueueMock = vi.fn();
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
    tenant: { findFirst: findActiveTenant },
    whatsAppInstance: {
      findMany: findInstances,
      findFirst: whatsAppInstanceFindFirstMock,
      findUnique: whatsAppInstanceFindUniqueMock,
      update: whatsAppInstanceUpdateMock,
    },
    message: {
      findFirst: messageFindFirstMock,
    },
  };

  return {
    prisma, findInstances, findActiveTenant, enqueueMock,
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

vi.mock('../../services/inbound-queue', () => ({ enqueueInboundWebhookJob: hoistedMocks.enqueueMock }));

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
  apiKey: process.env.WHATSAPP_WEBHOOK_API_KEY,
  enforce: process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE,
  secret: process.env.WHATSAPP_WEBHOOK_HMAC_SECRET,
  defaultInstanceId: process.env.WHATSAPP_DEFAULT_INSTANCE_ID,
};

const buildApp = () => {
  process.env.WHATSAPP_WEBHOOK_API_KEY = 'unit-api-key';
  refreshWhatsAppEnv();
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

const pendingJobs: Parameters<typeof enqueueInboundWebhookJob>[0][] = [];
const consumeQueuedEvents = async () => {
  for (const job of pendingJobs.splice(0)) {
    await ingestInboundWhatsAppMessageMock(job.envelope);
  }
};

beforeEach(() => {
  hoistedMocks.enqueueMock.mockReset().mockImplementation(async (job) => { pendingJobs.push(job); });
  hoistedMocks.findInstances.mockReset().mockImplementation(async ({ where }) => {
    const id = where.OR[0].id;
    if (id !== 'instance-1' && id !== 'instance-2') return [];
    return [{ id, brokerId: null, tenantId: 'tenant-42' }];
  });
  hoistedMocks.findActiveTenant.mockReset().mockImplementation(async ({ where }) => ({ id: where.id }));
});

afterEach(() => {
  pendingJobs.length = 0;
  vi.clearAllMocks();
  for (const [key, value] of [
    ['WHATSAPP_WEBHOOK_API_KEY', ORIGINAL_ENV.apiKey],
    ['WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE', ORIGINAL_ENV.enforce],
    ['WHATSAPP_WEBHOOK_HMAC_SECRET', ORIGINAL_ENV.secret],
    ['WHATSAPP_DEFAULT_INSTANCE_ID', ORIGINAL_ENV.defaultInstanceId],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  refreshWhatsAppEnv();
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
    const response = await request(app).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send({ event: 'ping' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' });
    const metrics = await renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="invalid_signature"[^}]*result="rejected"[^}]*\} 1/
    );
  });

  describe.each(['x-signature-sha256', 'x-signature'] as const)('using %s header', (headerName) => {
    it('rejects requests with mismatching signature', async () => {
      const app = buildApp();
      const response = await request(app)
        .post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key')
        .set(headerName, 'deadbeef')
        .send({ event: 'pong' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_SIGNATURE');
      const metrics = await renderMetrics();
      expect(metrics).toMatch(
        /whatsapp_webhook_events_total\{[^}]*reason="invalid_signature"[^}]*result="rejected"[^}]*\} 1/
      );
    });

    it('accepts requests with valid signature', async () => {
      const app = buildApp();
      const payload = { event: 'ok', instanceId: 'instance-1' };
      const raw = JSON.stringify(payload);
      const crypto = await import('node:crypto');
      const signature = crypto.createHmac('sha256', 'unit-secret').update(raw).digest('hex');

      const response = await request(app)
        .post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key')
        .set(headerName, signature)
        .send(payload);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });

  it('prefers the x-signature header over the legacy alias when both are provided', async () => {
    const app = buildApp();
    const payload = { event: 'preferred', instanceId: 'instance-1' };
    const raw = JSON.stringify(payload);
    const crypto = await import('node:crypto');
    const validSignature = crypto.createHmac('sha256', 'unit-secret').update(raw).digest('hex');

    const response = await request(app)
      .post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key')
      .set('x-signature', validSignature)
      .set('x-signature-sha256', 'deadbeef')
      .send(payload);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it('rejects when the preferred header mismatches even if the legacy alias matches', async () => {
    const app = buildApp();
    const payload = { event: 'mismatch', instanceId: 'instance-1' };
    const raw = JSON.stringify(payload);
    const crypto = await import('node:crypto');
    const validSignature = crypto.createHmac('sha256', 'unit-secret').update(raw).digest('hex');

    const response = await request(app)
      .post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key')
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

  it('persists a job before acknowledging the webhook', async () => {
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

    const response = await request(app).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send(eventPayload);

    expect(response.status).toBe(204);

    expect(hoistedMocks.enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-42',
      instanceId: 'instance-1',
      chatId: '5511999999999@s.whatsapp.net',
    }));
    expect(ingestInboundWhatsAppMessageMock).not.toHaveBeenCalled();
    expect(processedIntegrationEventCreateMock).not.toHaveBeenCalled();
    await consumeQueuedEvents();
    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledTimes(1);
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

    const response = await request(app).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send(eventPayload);

    expect(response.status).toBe(204);
    await consumeQueuedEvents();

    expect(normalizeUpsertEventMock).not.toHaveBeenCalled();
    expect(processedIntegrationEventCreateMock).not.toHaveBeenCalled();
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

    const response = await request(app).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send(eventPayload);

    expect(response.status).toBe(204);
    await consumeQueuedEvents();

    expect(normalizeUpsertEventMock).not.toHaveBeenCalled();
    expect(processedIntegrationEventCreateMock).not.toHaveBeenCalled();
    expect(ingestInboundWhatsAppMessageMock).toHaveBeenCalledTimes(1);



    const metrics = await renderMetrics();
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

    const response = await request(app).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send(eventPayload);

    expect(response.status).toBe(204);
    await consumeQueuedEvents();

    expect(normalizeUpsertEventMock).not.toHaveBeenCalled();
    expect(processedIntegrationEventCreateMock).not.toHaveBeenCalled();
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

  const envelope = (instanceId: string, tenantId: string) => ({
    id: 'envelope-1',
    event: 'MESSAGE_INBOUND',
    instanceId,
    tenantId,
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      instanceId, direction: 'INBOUND', timestamp: '2024-01-01T00:00:00.000Z',
      contact: { phone: '+5511999999999', name: 'Contato' },
      message: { id: 'wamid-1', type: 'text', text: 'Olá' },
      metadata: { contact: { remoteJid: '5511999999999@s.whatsapp.net' } },
    },
  });

  it('returns 503 when the job cannot be written', async () => {
    hoistedMocks.enqueueMock.mockRejectedValueOnce(new Error('Database unavailable'));
    const response = await request(createInstanceApp()).post('/api/webhooks/whatsapp')
      .set('x-api-key', 'unit-api-key').send(envelope('instance-1', 'tenant-42'));
    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('5');
    expect(ingestInboundWhatsAppMessageMock).not.toHaveBeenCalled();
  });

  it('uses the stored instance without changing its mapping', async () => {
    hoistedMocks.findInstances.mockResolvedValueOnce([{ id: 'stored-instance', brokerId: 'broker-id', tenantId: 'tenant-42' }]);
    const response = await request(createInstanceApp()).post('/api/webhooks/whatsapp')
      .set('x-api-key', 'unit-api-key').send(envelope('broker-id', 'tenant-42'));
    expect(response.status).toBe(204);
    expect(hoistedMocks.enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'stored-instance', tenantId: 'tenant-42' }));
    expect(prismaMock.whatsAppInstance.update).not.toHaveBeenCalled();
  });

  it('rejects ambiguous instances and unknown broker IDs before enqueueing', async () => {
    process.env.WHATSAPP_DEFAULT_INSTANCE_ID = 'instance-1';
    const app = createInstanceApp();
    for (const instances of [[], [
      { id: 'one', tenantId: 'tenant-42' },
      { id: 'two', tenantId: 'tenant-123' },
    ]]) {
      hoistedMocks.findInstances.mockResolvedValueOnce(instances);
      const response = await request(app).post('/api/webhooks/whatsapp')
        .set('x-api-key', 'unit-api-key').send(envelope('unknown', 'tenant-42'));
      expect(response.status).toBe(403);
    }
    expect(hoistedMocks.enqueueMock).not.toHaveBeenCalled();
    expect(prismaMock.whatsAppInstance.update).not.toHaveBeenCalled();
  });
});

describe('WhatsApp webhook poll choice events', () => {
  const pollChoiceEvents: Array<{ event: string; payload: unknown }> = [];
  let pollChoiceSubscriptions: Array<() => void> = [];

  const storedPollInstance = (tenantId: string) => {
    hoistedMocks.findInstances.mockResolvedValueOnce([{ id: 'stored-poll-instance', tenantId }]);
    return 'stored-poll-instance';
  };

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
      .post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key')
      .send({
        event: 'WHATSAPP_MESSAGES_UPSERT',
        instanceId: 'instance-1',
        payload: { messages: [] },
      });

    expect(response.status).toBe(204);
    await consumeQueuedEvents();
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
      .post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key')
      .send(
        { ...createPollChoiceEventEnvelope({
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
        }), instanceId: storedPollInstance('tenant-123') }
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
      instanceId: 'stored-poll-instance',
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

    const metrics = await renderMetrics();
    expect(metrics).toMatch(
      /whatsapp_webhook_events_total\{[^}]*reason="poll_choice"[^}]*result="accepted"[^}]*\} 1/
    );
    const completion = pollChoiceEvents.find((entry) => entry.event === 'pollChoiceCompleted');
    expect(completion?.payload).toMatchObject({ outcome: 'accepted', reason: 'poll_choice' });
  });

  it('rejects a poll with an unrecognized instance before resolving metadata', async () => {
    const response = await request(buildApp()).post('/api/webhooks/whatsapp')
      .set('x-api-key', 'unit-api-key').send({
        event: 'POLL_CHOICE',
        instanceId: 'unknown-poll-instance',
        payload: { pollId: 'poll-legacy', voterJid: '5511999999999@s.whatsapp.net' },
      });
    expect(response.status).toBe(403);
    expect(recordPollChoiceVoteMock).not.toHaveBeenCalled();
    expect(getPollMetadataMock).not.toHaveBeenCalled();
    expect(storageUpdateMessageMock).not.toHaveBeenCalled();
  });

  it('includes the poll creation message ID when locating the linked vote', async () => {
    const pollId = 'poll-with-creation';
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true, state: createPollChoiceVoteState({ pollId }),
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });
    const response = await request(buildApp()).post('/api/webhooks/whatsapp')
      .set('x-api-key', 'unit-api-key')
      .send({
        event: 'POLL_CHOICE', instanceId: storedPollInstance('tenant-123'),
        payload: {
          pollId, voterJid: '5511999999999@s.whatsapp.net', messageId: 'wamid-vote',
          pollCreationMessageKey: { id: 'wamid-creation', remoteJid: '5511999999999@s.whatsapp.net' },
          selectedOptionIds: ['opt-1'], selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
        },
      });
    expect(response.status).toBe(204);
    expect(findPollVoteMessageCandidateMock).toHaveBeenCalledWith(expect.objectContaining({
      pollId, identifiers: expect.arrayContaining(['wamid-creation']),
    }));
  });

  it('skips the inbox notification when the linked message already has the selection', async () => {
    const now = new Date().toISOString();
    const voterJid = '5511999999999@s.whatsapp.net';
    findPollVoteMessageCandidateMock.mockResolvedValueOnce({
      id: 'existing-poll-message-id',
      metadata: { poll: { selectedOptionIds: ['opt-1'] }, pollVote: { selectedOptions: [{ id: 'opt-1', title: 'Option 1' }] } },
    });
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: createPollChoiceVoteState({
        pollId: 'poll-existing',
        votes: { [voterJid]: { optionIds: ['opt-1'], selectedOptions: [{ id: 'opt-1', title: 'Option 1' }], messageId: 'wamid-vote', timestamp: now } },
      }),
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });
    const response = await request(buildApp()).post('/api/webhooks/whatsapp')
      .set('x-api-key', 'unit-api-key')
      .send({
        ...createPollChoiceEventEnvelope({
          payload: { pollId: 'poll-existing', voterJid, selectedOptionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }], timestamp: now },
        }),
        instanceId: storedPollInstance('tenant-123'),
      });
    expect(response.status).toBe(204);
    expect(triggerPollChoiceInboxNotificationMock).not.toHaveBeenCalled();
  });

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
        pollId: 'poll-outdated',
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

    const response = await request(app).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send({
      event: 'POLL_CHOICE',
      instanceId: storedPollInstance('tenant-123'),
      tenantId: 'tenant-123',
      payload: {
        pollId: 'poll-outdated',
        voterJid: '5511999999999@s.whatsapp.net',
        messageId: 'wamid-poll-outdated',
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
        poll: expect.objectContaining({ pollId: 'poll-outdated' }),
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
      const response = await request(buildApp()).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send({
        event: 'POLL_CHOICE',
        instanceId: storedPollInstance('tenant-enc'),
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
      const response = await request(buildApp()).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send({
        event: 'POLL_CHOICE',
        instanceId: storedPollInstance('tenant-enc'),
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

  it('rejects a poll whose tenant conflicts with the stored instance', async () => {
    hoistedMocks.findInstances.mockResolvedValueOnce([{ id: 'instance-1', tenantId: 'tenant-42' }]);
    const response = await request(buildApp()).post('/api/webhooks/whatsapp')
      .set('x-api-key', 'unit-api-key').send({
        event: 'POLL_CHOICE',
        instanceId: 'instance-1',
        tenantId: 'tenant-123',
        payload: { pollId: 'poll-conflict', voterJid: '5511999999999@s.whatsapp.net' },
      });
    expect(response.status).toBe(403);
    expect(recordPollChoiceVoteMock).not.toHaveBeenCalled();
    expect(triggerPollChoiceInboxNotificationMock).not.toHaveBeenCalled();
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

    const response = await request(buildApp()).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send({
      event: 'POLL_CHOICE',
      instanceId: storedPollInstance('tenant-abc'),
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

    expect(response.status).toBe(503);
    expect(triggerPollChoiceInboxNotificationMock).toHaveBeenCalledTimes(1);

    const metrics = await renderMetrics();
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

    const response = await request(buildApp()).post('/api/webhooks/whatsapp').set('x-api-key', 'unit-api-key').send({
      event: 'POLL_CHOICE',
      instanceId: storedPollInstance('tenant-123'),
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

    const metrics = await renderMetrics();
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
