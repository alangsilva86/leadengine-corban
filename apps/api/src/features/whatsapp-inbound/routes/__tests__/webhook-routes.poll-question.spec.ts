import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as webhookRoutes from '../webhook-routes';
import { refreshWhatsAppEnv } from '../../../../config/whatsapp';

const { whatsappWebhookRouter } = webhookRoutes;

const hoistedMocks = vi.hoisted(() => {
  const prisma = {
    processedIntegrationEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    whatsAppInstance: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findFirst: vi.fn(),
    },
  };

  const ingestInboundWhatsAppMessageMock = vi.fn();
  const normalizeUpsertEventMock = vi.fn();
  const recordPollChoiceVoteMock = vi.fn();
  const recordEncryptedPollVoteMock = vi.fn();
  const syncPollChoiceStateMock = vi.fn();
  const triggerPollChoiceInboxNotificationMock = vi.fn();
  const storageFindMessageByExternalIdMock = vi.fn();
  const findPollVoteMessageCandidateMock = vi.fn();
  const storageUpdateMessageMock = vi.fn();
  const applyBrokerAckMock = vi.fn();
  const upsertPollMetadataMock = vi.fn();
  const getPollMetadataMock = vi.fn();
  const enqueueInboundWebhookJobMock = vi.fn();
  const inboundQueueWaitForIdleMock = vi.fn();
  const inboundQueueResetMock = vi.fn();

  return {
    prisma,
    ingestInboundWhatsAppMessageMock,
    normalizeUpsertEventMock,
    recordPollChoiceVoteMock,
    recordEncryptedPollVoteMock,
    syncPollChoiceStateMock,
    triggerPollChoiceInboxNotificationMock,
    storageFindMessageByExternalIdMock,
    findPollVoteMessageCandidateMock,
    storageUpdateMessageMock,
    applyBrokerAckMock,
    upsertPollMetadataMock,
    getPollMetadataMock,
    enqueueInboundWebhookJobMock,
    inboundQueueWaitForIdleMock,
    inboundQueueResetMock,
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
vi.mock('../../services/inbound-queue', () => ({
  enqueueInboundWebhookJob: hoistedMocks.enqueueInboundWebhookJobMock,
  __testing: {
    waitForIdle: hoistedMocks.inboundQueueWaitForIdleMock,
    resetQueue: hoistedMocks.inboundQueueResetMock,
  },
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
  recordPollChoiceVoteMock,
  recordEncryptedPollVoteMock,
  syncPollChoiceStateMock,
  triggerPollChoiceInboxNotificationMock,
  storageFindMessageByExternalIdMock,
  storageUpdateMessageMock,
  findPollVoteMessageCandidateMock,
  getPollMetadataMock,
} = hoistedMocks;

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

describe('WhatsApp webhook poll question propagation', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'false';
    process.env.WHATSAPP_WEBHOOK_HMAC_SECRET = '';
    refreshWhatsAppEnv();

    prismaMock.whatsAppInstance.findFirst.mockReset();
    prismaMock.whatsAppInstance.update.mockReset();
    prismaMock.message.findFirst.mockReset();
    prismaMock.message.findFirst.mockResolvedValue(null);

    hoistedMocks.ingestInboundWhatsAppMessageMock.mockReset();
    hoistedMocks.normalizeUpsertEventMock.mockReset();
    hoistedMocks.normalizeUpsertEventMock.mockReturnValue({ normalized: [] });

    recordPollChoiceVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockReset();
    recordEncryptedPollVoteMock.mockResolvedValue(undefined);
    syncPollChoiceStateMock.mockReset();
    syncPollChoiceStateMock.mockResolvedValue(true);
    triggerPollChoiceInboxNotificationMock.mockReset();
    triggerPollChoiceInboxNotificationMock.mockResolvedValue({ status: 'ok', persisted: true });

    storageFindMessageByExternalIdMock.mockReset();
    findPollVoteMessageCandidateMock.mockReset();
    storageUpdateMessageMock.mockReset();
    getPollMetadataMock.mockReset();
    getPollMetadataMock.mockResolvedValue(null);
  });

  afterEach(() => {
    webhookRoutes.__testing.resetUpdatePollVoteMessageHandler();
    vi.clearAllMocks();
  });

  it('replaces poll placeholder content with selected option titles', async () => {
    const now = new Date().toISOString();
    const pollId = 'poll-placeholder';
    const voterJid = '5511999999999@s.whatsapp.net';

    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId,
        options: [{ id: 'opt-yes', title: 'Sim 👍', index: 0 }],
        votes: {
          [voterJid]: {
            optionIds: ['opt-yes'],
            selectedOptions: [{ id: 'opt-yes', title: 'Sim 👍' }],
            messageId: 'wamid-placeholder',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-yes': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-yes': 1 } },
        updatedAt: now,
        context: { tenantId: 'tenant-123' },
      },
      selectedOptions: [{ id: 'opt-yes', title: 'Sim 👍' }],
    });

    storageFindMessageByExternalIdMock.mockResolvedValueOnce({
      id: 'message-db-id',
      externalId: 'wamid-placeholder',
      content: '[Mensagem recebida via WhatsApp]',
      caption: '',
      type: 'POLL',
      metadata: {},
    } as never);

    storageUpdateMessageMock.mockResolvedValueOnce({ tenantId: 'tenant-123', ticketId: null });

    const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      tenantId: 'tenant-123',
      payload: {
        pollId,
        voterJid,
        messageId: 'wamid-placeholder',
        selectedOptionIds: ['opt-yes'],
        selectedOptions: [{ id: 'opt-yes', title: 'Sim 👍' }],
        options: [{ id: 'opt-yes', title: 'Sim 👍', selected: true }],
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-yes': 1 } },
        timestamp: now,
      },
    });

    expect(response.status).toBe(204);
    expect(storageUpdateMessageMock).toHaveBeenCalledTimes(1);

    const updatePayload = storageUpdateMessageMock.mock.calls[0]?.[2];
    expect(updatePayload?.content).toBe('Sim 👍');
    expect(updatePayload?.text).toBe('Sim 👍');
    expect(updatePayload?.caption).toBe('Sim 👍');
  });

  it('propagates poll question into rewrite metadata and handler parameters', async () => {
    const now = new Date().toISOString();
    const pollQuestion = 'Qual é a melhor opção?';

    syncPollChoiceStateMock.mockResolvedValueOnce(false);
    recordPollChoiceVoteMock.mockResolvedValueOnce({
      updated: true,
      state: {
        pollId: 'poll-question',
        options: [{ id: 'opt-1', title: 'Option 1', index: 0 }],
        votes: {
          '5511999999999@s.whatsapp.net': {
            optionIds: ['opt-1'],
            selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
            messageId: 'wamid-poll-question',
            timestamp: now,
          },
        },
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        brokerAggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        updatedAt: now,
        context: {
          tenantId: 'tenant-123',
          question: pollQuestion,
        },
      },
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    });

    storageFindMessageByExternalIdMock.mockResolvedValueOnce({
      id: 'message-db-id',
      externalId: 'wamid-original',
      content: '[Mensagem recebida via WhatsApp]',
      caption: null,
      type: 'POLL',
      metadata: {
        poll: {
          pollId: 'poll-question',
          options: [],
        },
        pollChoice: {
          pollId: 'poll-question',
        },
      },
    } as never);

    const originalUpdate = webhookRoutes.__testing.updatePollVoteMessage;
    const updatePollVoteMessageSpy = vi.fn(async (params) => {
      await originalUpdate(params);
    });
    webhookRoutes.__testing.setUpdatePollVoteMessageHandler(updatePollVoteMessageSpy);

    const response = await request(buildApp()).post('/api/webhooks/whatsapp').send({
      event: 'POLL_CHOICE',
      tenantId: 'tenant-123',
      payload: {
        pollId: 'poll-question',
        voterJid: '5511999999999@s.whatsapp.net',
        messageId: 'wamid-poll-question',
        selectedOptionIds: ['opt-1'],
        selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
        options: [{ id: 'opt-1', title: 'Option 1', selected: true }],
        aggregates: { totalVoters: 1, totalVotes: 1, optionTotals: { 'opt-1': 1 } },
        timestamp: now,
      },
    });

    expect(response.status).toBe(204);
    expect(updatePollVoteMessageSpy).toHaveBeenCalledTimes(1);
    expect(updatePollVoteMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        question: pollQuestion,
      })
    );

    expect(storageUpdateMessageMock).toHaveBeenCalledTimes(1);
    const updatePayload = storageUpdateMessageMock.mock.calls[0]?.[2];
    const metadata = (updatePayload?.metadata ?? {}) as Record<string, unknown>;
    const pollMetadata = metadata.poll as Record<string, unknown> | undefined;
    const pollChoiceMetadata = metadata.pollChoice as Record<string, unknown> | undefined;

    expect(pollMetadata?.question).toBe(pollQuestion);
    expect(pollChoiceMetadata?.question).toBe(pollQuestion);
  });
});
