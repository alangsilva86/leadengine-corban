import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { __testing } from '../poll-choice-sync-service';

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
});
