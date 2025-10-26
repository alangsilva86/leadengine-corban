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

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    processedIntegrationEvent: {
      findUnique: vi.fn(),
    },
  },
}));

import type { PollChoiceState } from '../../schemas/poll-choice';
import { __testing, syncPollChoiceState } from '../poll-choice-sync-service';

beforeEach(() => {
  vi.clearAllMocks();
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
  });

  describe('syncPollChoiceState', () => {
    it('updates poll metadata when message is found via candidate lookup', async () => {
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
            question: 'Qual é a melhor opção?',
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
          metadata: {
            poll: expect.objectContaining({
              pollId: 'poll-123',
              totalVotes: 3,
              totalVoters: 2,
            }),
          },
        })
      );

      expect(mockEmitMessageUpdatedEvents).not.toHaveBeenCalled();
    });
  });
});
