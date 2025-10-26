import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const storageMocks = vi.hoisted(() => ({
  updateMessage: vi.fn(),
  findPollVoteMessageCandidate: vi.fn(),
}));

vi.mock('@ticketz/storage', () => storageMocks);

const mockStorageUpdateMessage = storageMocks.updateMessage;
const mockFindPollVoteMessageCandidate = storageMocks.findPollVoteMessageCandidate;

const ticketServiceMocks = vi.hoisted(() => ({
  emitMessageUpdatedEvents: vi.fn(),
}));

vi.mock('../../../../services/ticket-service', () => ticketServiceMocks);

const mockEmitMessageUpdatedEvents = ticketServiceMocks.emitMessageUpdatedEvents;

const prismaMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    processedIntegrationEvent: {
      findUnique: prismaMocks.findUnique,
      upsert: prismaMocks.upsert,
    },
  },
}));

const metadataMocks = vi.hoisted(() => ({
  getPollMetadata: vi.fn(),
}));

vi.mock('../poll-metadata-service', () => metadataMocks);

import type { PollChoiceState } from '../../schemas/poll-choice';
import { __testing, syncPollChoiceState } from '../poll-choice-sync-service';
import { logger } from '../../../../config/logger';

const mockFindUnique = prismaMocks.findUnique;
const mockUpsert = prismaMocks.upsert;
const mockGetPollMetadata = metadataMocks.getPollMetadata;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockReset();
  mockUpsert.mockReset();
  mockGetPollMetadata.mockReset();
});

describe('poll-choice-sync-service', () => {
  describe('buildPollMetadata', () => {
    it('merges aggregates into poll metadata and preserves question/flags', () => {
      const state = {
        pollId: 'poll-1',
        options: [
          { id: 'opt-1', title: 'Opção A', index: 0 },
          { id: 'opt-2', title: 'Opção B', index: 1 },
        ],
        votes: {},
        aggregates: {
          totalVoters: 2,
          totalVotes: 3,
          optionTotals: {
            'opt-1': 2,
            'opt-2': 1,
          },
        },
        brokerAggregates: undefined,
        updatedAt: '2024-05-01T12:00:00.000Z',
      } satisfies Parameters<typeof __testing.buildPollMetadata>[1];

      const existing = {
        question: 'Qual é a melhor opção?',
        options: ['Opção A', 'Opção B'],
        allowMultipleAnswers: true,
      };

      const metadata = __testing.buildPollMetadata(existing, state);

      expect(metadata.pollId).toBe('poll-1');
      expect(metadata.question).toBe('Qual é a melhor opção?');
      expect(metadata.allowMultipleAnswers).toBe(true);
      expect(metadata.totalVotes).toBe(3);
      expect(metadata.totalVoters).toBe(2);
      expect(metadata.optionTotals).toEqual({
        'opt-1': 2,
        'opt-2': 1,
      });

      const options = Array.isArray(metadata.options) ? metadata.options : [];
      expect(options).toHaveLength(2);
      const [first, second] = options as Array<Record<string, unknown>>;
      expect(first?.id).toBe('opt-1');
      expect(first?.title).toBe('Opção A');
      expect(first?.votes).toBe(2);
      expect(second?.id).toBe('opt-2');
      expect(second?.votes).toBe(1);
    });

    it('uses poll state context question when metadata does not include one', () => {
      const state = {
        pollId: 'poll-with-context',
        options: [
          { id: 'opt-1', title: 'Opção A', index: 0 },
          { id: 'opt-2', title: 'Opção B', index: 1 },
        ],
        votes: {},
        aggregates: {
          totalVoters: 0,
          totalVotes: 0,
          optionTotals: {},
        },
        brokerAggregates: undefined,
        updatedAt: '2024-05-01T12:00:00.000Z',
        context: {
          question: 'Qual é sua escolha?',
        },
      } satisfies Parameters<typeof __testing.buildPollMetadata>[1];

      const metadata = __testing.buildPollMetadata({}, state);

      expect(metadata.question).toBe('Qual é sua escolha?');
      expect(metadata.title).toBe('Qual é sua escolha?');
      expect(metadata.name).toBe('Qual é sua escolha?');
    });
  });

  describe('syncPollChoiceState', () => {
    it('updates poll metadata when message is found via candidate lookup', async () => {
      mockGetPollMetadata.mockResolvedValue(null);

      const state: PollChoiceState = {
        pollId: 'poll-123',
        options: [
          { id: 'opt-1', title: 'Option 1', index: 0 },
          { id: 'opt-2', title: 'Option 2', index: 1 },
        ],
        votes: {
          'contact-1': {
            optionIds: ['opt-1'],
            selectedOptions: [],
            messageId: 'vote-message-1',
            timestamp: null,
            encryptedVote: undefined,
          },
        },
        aggregates: {
          totalVoters: 2,
          totalVotes: 3,
          optionTotals: {
            'opt-1': 2,
            'opt-2': 1,
          },
        },
        brokerAggregates: undefined,
        updatedAt: '2024-05-01T12:00:00.000Z',
        context: {
          tenantId: 'tenant-1',
          creationMessageId: 'creation-message-1',
          creationMessageKey: {
            remoteJid: '12345@s.whatsapp.net',
            participant: null,
            fromMe: false,
          },
          question: 'Qual é a melhor opção?',
        },
      };

      const existingMessage = {
        id: 'message-1',
        tenantId: 'tenant-1',
        ticketId: 'ticket-1',
        externalId: 'some-other-message',
        metadata: {
          poll: {
            pollId: 'poll-123',
            options: [],
            totalVotes: 0,
            totalVoters: 0,
          },
        },
      };

      mockFindPollVoteMessageCandidate.mockResolvedValue(existingMessage);
      mockStorageUpdateMessage.mockImplementation(async (_tenantId, _messageId, payload) => ({
        ...existingMessage,
        metadata: {
          ...existingMessage.metadata,
          ...payload.metadata,
        },
      }));

      const result = await syncPollChoiceState('poll-123', { state, emit: false });

      expect(result).toBe(true);

      expect(mockFindPollVoteMessageCandidate).toHaveBeenCalledTimes(1);
      const lookupArgs = mockFindPollVoteMessageCandidate.mock.calls[0]?.[0];
      expect(lookupArgs).toMatchObject({
        tenantId: 'tenant-1',
        pollId: 'poll-123',
        chatId: '12345@s.whatsapp.net',
      });
      expect(lookupArgs?.identifiers).toEqual(
        expect.arrayContaining(['poll-123', 'creation-message-1', 'vote-message-1'])
      );

      expect(mockStorageUpdateMessage).toHaveBeenCalledWith(
        'tenant-1',
        'message-1',
        expect.objectContaining({
          metadata: expect.anything(),
        })
      );

      const updatePayload = mockStorageUpdateMessage.mock.calls[0]?.[2];
      const pollMetadata = (updatePayload?.metadata as Record<string, unknown>)?.poll as
        | Record<string, unknown>
        | undefined;
      const pollChoiceMetadata = (updatePayload?.metadata as Record<string, unknown>)?.pollChoice as
        | Record<string, unknown>
        | undefined;

      expect(pollMetadata?.question).toBe('Qual é a melhor opção?');
      expect(pollChoiceMetadata?.question).toBe('Qual é a melhor opção?');

      expect(mockEmitMessageUpdatedEvents).not.toHaveBeenCalled();
    });

    it('hydrates tenant context from poll metadata when missing', async () => {
      const state: PollChoiceState = {
        pollId: 'poll-123',
        options: [
          { id: 'opt-1', title: 'Option 1', index: 0 },
          { id: 'opt-2', title: 'Option 2', index: 1 },
        ],
        votes: {},
        aggregates: {
          totalVoters: 0,
          totalVotes: 0,
          optionTotals: {},
        },
        brokerAggregates: undefined,
        updatedAt: '2024-05-01T12:00:00.000Z',
        context: {
          creationMessageId: null,
          creationMessageKey: null,
        },
      };

      mockGetPollMetadata.mockResolvedValue({
        pollId: 'poll-123',
        tenantId: 'tenant-1',
        creationMessageId: 'creation-message-1',
        creationMessageKey: {
          remoteJid: '12345@s.whatsapp.net',
          participant: '67890@s.whatsapp.net',
          fromMe: false,
        },
      });

      const existingMessage = {
        id: 'message-1',
        tenantId: 'tenant-1',
        ticketId: 'ticket-1',
        externalId: 'some-other-message',
        metadata: {},
      };

      mockFindPollVoteMessageCandidate.mockResolvedValue(existingMessage);
      mockStorageUpdateMessage.mockImplementation(async (_tenantId, _messageId, payload) => ({
        ...existingMessage,
        metadata: {
          ...existingMessage.metadata,
          ...payload.metadata,
        },
      }));
      mockUpsert.mockResolvedValue(undefined);

      const result = await syncPollChoiceState('poll-123', { state, emit: false });

      expect(result).toBe(true);
      expect(mockGetPollMetadata).toHaveBeenCalledWith('poll-123');
      expect(mockUpsert).toHaveBeenCalledWith({
        where: { id: 'poll-state:poll-123' },
        create: expect.objectContaining({
          id: 'poll-state:poll-123',
          cursor: 'poll-123',
        }),
        update: expect.objectContaining({
          cursor: 'poll-123',
        }),
      });

      const persistedPayload = mockUpsert.mock.calls[0]?.[0]?.update?.payload as PollChoiceState | undefined;
      expect(persistedPayload?.context?.tenantId).toBe('tenant-1');
      expect(persistedPayload?.context?.creationMessageId).toBe('creation-message-1');
      expect(persistedPayload?.context?.creationMessageKey).toEqual({
        remoteJid: '12345@s.whatsapp.net',
        participant: '67890@s.whatsapp.net',
        fromMe: false,
      });

      const lookupArgs = mockFindPollVoteMessageCandidate.mock.calls[0]?.[0];
      expect(lookupArgs).toMatchObject({
        tenantId: 'tenant-1',
        pollId: 'poll-123',
        chatId: '12345@s.whatsapp.net',
      });
      expect(lookupArgs?.identifiers).toEqual(['poll-123', 'creation-message-1']);

      expect(logger.info).toHaveBeenCalledWith('poll_state.recovered_context', {
        pollId: 'poll-123',
        tenantId: 'tenant-1',
        hasCreationMessageKey: true,
        creationMessageId: 'creation-message-1',
      });
    });

    it('throws when tenant context cannot be recovered from metadata', async () => {
      const state: PollChoiceState = {
        pollId: 'poll-123',
        options: [
          { id: 'opt-1', title: 'Option 1', index: 0 },
          { id: 'opt-2', title: 'Option 2', index: 1 },
        ],
        votes: {},
        aggregates: {
          totalVoters: 0,
          totalVotes: 0,
          optionTotals: {},
        },
        brokerAggregates: undefined,
        updatedAt: '2024-05-01T12:00:00.000Z',
        context: {},
      };

      mockGetPollMetadata.mockResolvedValue(null);

      await expect(syncPollChoiceState('poll-123', { state, emit: false })).rejects.toThrow(
        'Poll choice state context unavailable'
      );

      expect(mockFindPollVoteMessageCandidate).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });
});
