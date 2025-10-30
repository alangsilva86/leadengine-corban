import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PollVoteUpdateState,
  updatePollVoteMessage,
} from '../poll-vote-updater';

const baseParams = {
  tenantId: 'tenant-123',
  chatId: '5511999999999@s.whatsapp.net',
  messageId: 'wamid-poll-1',
  messageIds: ['wamid-poll-1', 'wamid-poll-creation'],
  pollId: 'poll-1',
  voterJid: '5511999999999@s.whatsapp.net',
  selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
  timestamp: '2024-01-01T00:00:00.000Z',
  question: 'What is your choice?',
  aggregates: {
    totalVoters: 1,
    totalVotes: 1,
    optionTotals: { 'opt-1': 1 },
  },
  options: [{ id: 'opt-1', title: 'Option 1' }],
  vote: {
    optionIds: ['opt-1'],
    selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
    timestamp: '2024-01-01T00:00:00.000Z',
  },
} as const;

describe('poll-vote-updater', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('updatePollVoteMessage', () => {
    it('returns missing tenant state when tenant context is absent', async () => {
      const result = await updatePollVoteMessage({
        ...baseParams,
        tenantId: null,
      });

      expect(result).toEqual({
        status: 'missingTenant',
        state: PollVoteUpdateState.MissingTenant,
        candidates: expect.arrayContaining(['wamid-poll-1', 'wamid-poll-creation', 'poll-1']),
      });
    });

    it('skips persistence when metadata and content are unchanged', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      const existingMessage = {
        id: 'storage-message',
        externalId: 'wamid-poll-1',
        content: '[Mensagem recebida via WhatsApp]',
        caption: null,
        type: 'POLL',
        metadata: {},
      } as Record<string, unknown>;

      const storageFindMessageByExternalId = vi
        .fn()
        .mockResolvedValue(existingMessage);
      const findPollVoteMessageCandidate = vi.fn().mockResolvedValue(null);
      const emitMessageUpdatedEvents = vi.fn();
      const storageUpdateMessage = vi.fn().mockImplementation(async (_, __, payload) => {
        Object.assign(existingMessage, payload);
        if (payload?.metadata) {
          existingMessage.metadata = payload.metadata;
        }
        existingMessage.content = (payload?.content ?? existingMessage.content) as string | null;
        existingMessage.caption = (payload?.caption ?? existingMessage.caption) as string | null;
        existingMessage.type = (payload?.type ?? existingMessage.type) as string | null;

        return { tenantId: baseParams.tenantId, ticketId: null, externalId: existingMessage.externalId };
      });

      await updatePollVoteMessage(baseParams, {
        storageFindMessageByExternalId,
        findPollVoteMessageCandidate,
        storageUpdateMessage,
        emitMessageUpdatedEvents,
      });

      expect(storageUpdateMessage).toHaveBeenCalledTimes(1);
      expect(emitMessageUpdatedEvents).not.toHaveBeenCalled();

      const noopStorageUpdate = vi.fn();
      const noopResult = await updatePollVoteMessage(baseParams, {
        storageFindMessageByExternalId: vi.fn().mockResolvedValue(existingMessage),
        findPollVoteMessageCandidate,
        storageUpdateMessage: noopStorageUpdate,
        emitMessageUpdatedEvents,
      });

      expect(noopResult).toEqual({
        status: 'noop',
        state: PollVoteUpdateState.Noop,
        tenantId: baseParams.tenantId,
        candidates: expect.arrayContaining(['wamid-poll-1', 'wamid-poll-creation', 'poll-1']),
        storageMessageId: 'storage-message',
      });
      expect(noopStorageUpdate).not.toHaveBeenCalled();
    });

    it('applies storage update and emits message events', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      const storageFindMessageByExternalId = vi.fn().mockResolvedValue({
        id: 'storage-message',
        externalId: 'wamid-poll-1',
        content: '[Mensagem recebida via WhatsApp]',
        caption: null,
        type: 'POLL',
        metadata: {},
      });
      const findPollVoteMessageCandidate = vi.fn().mockResolvedValue(null);
      const emitMessageUpdatedEvents = vi.fn().mockResolvedValue(undefined);
      const storageUpdateMessage = vi.fn().mockResolvedValue({
        tenantId: baseParams.tenantId,
        ticketId: 'ticket-123',
        externalId: 'wamid-poll-1',
      });

      const result = await updatePollVoteMessage(baseParams, {
        storageFindMessageByExternalId,
        findPollVoteMessageCandidate,
        storageUpdateMessage,
        emitMessageUpdatedEvents,
      });

      expect(result.status).toBe('updated');
      expect(result.state).toBe(PollVoteUpdateState.Completed);
      expect(storageUpdateMessage).toHaveBeenCalledTimes(1);
      expect(emitMessageUpdatedEvents).toHaveBeenCalledWith(
        baseParams.tenantId,
        'ticket-123',
        expect.objectContaining({ externalId: 'wamid-poll-1' }),
        null
      );
    });
  });
});
