import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoistedMocks = vi.hoisted(() => {
  const findUniqueMock = vi.fn();
  const upsertMock = vi.fn();

  return {
    findUniqueMock,
    upsertMock,
    prisma: {
      processedIntegrationEvent: {
        findUnique: findUniqueMock,
        upsert: upsertMock,
      },
    },
  };
});

vi.mock('../../../../lib/prisma', () => ({ prisma: hoistedMocks.prisma }));

vi.mock('../../../../config/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { recordPollChoiceVote } from '../poll-choice-service';

const buildStatePayload = () => ({
  pollId: 'poll-1',
  options: [
    { id: 'opt-1', title: 'Option 1', index: 0 },
    { id: 'opt-2', title: 'Option 2', index: 1 },
  ],
  votes: {
    'user@s.whatsapp.net': {
      optionIds: ['opt-1'],
      messageId: 'wamid-1',
      timestamp: '2024-01-01T00:00:00.000Z',
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
  updatedAt: '2024-01-01T00:00:00.000Z',
});

describe('recordPollChoiceVote', () => {
  const { findUniqueMock, upsertMock } = hoistedMocks;

  beforeEach(() => {
    findUniqueMock.mockReset();
    upsertMock.mockReset();
  });

  it('persists new votes and computes aggregates', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    upsertMock.mockResolvedValueOnce({} as never);

    const result = await recordPollChoiceVote({
      pollId: 'poll-1',
      voterJid: 'user@s.whatsapp.net',
      messageId: 'wamid-1',
      selectedOptionIds: ['opt-1'],
      options: [
        { id: 'opt-1', title: 'Option 1', selected: true },
        { id: 'opt-2', title: 'Option 2' },
      ],
      aggregates: {
        totalVoters: 1,
        totalVotes: 1,
        optionTotals: { 'opt-1': 1 },
      },
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(result.updated).toBe(true);
    expect(result.state.pollId).toBe('poll-1');
    expect(result.state.aggregates).toMatchObject({
      totalVoters: 1,
      totalVotes: 1,
      optionTotals: { 'opt-1': 1 },
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [upsertArgs] = upsertMock.mock.calls[0] ?? [];
    const payload = upsertArgs?.update?.payload ?? upsertArgs?.create?.payload;
    expect(payload).toMatchObject({
      pollId: 'poll-1',
      aggregates: { totalVoters: 1, totalVotes: 1 },
    });
  });

  it('does not double count when selection is unchanged', async () => {
    findUniqueMock.mockResolvedValueOnce({
      payload: buildStatePayload(),
    });

    const result = await recordPollChoiceVote({
      pollId: 'poll-1',
      voterJid: 'user@s.whatsapp.net',
      messageId: 'wamid-1',
      selectedOptionIds: ['opt-1'],
      options: [
        { id: 'opt-1', title: 'Option 1', selected: true },
        { id: 'opt-2', title: 'Option 2' },
      ],
      aggregates: {
        totalVoters: 1,
        totalVotes: 1,
        optionTotals: { 'opt-1': 1 },
      },
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(result.updated).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('updates aggregates when vote selection changes', async () => {
    findUniqueMock.mockResolvedValueOnce({
      payload: buildStatePayload(),
    });
    upsertMock.mockResolvedValueOnce({} as never);

    const result = await recordPollChoiceVote({
      pollId: 'poll-1',
      voterJid: 'user@s.whatsapp.net',
      messageId: 'wamid-2',
      selectedOptionIds: ['opt-2'],
      options: [
        { id: 'opt-1', title: 'Option 1' },
        { id: 'opt-2', title: 'Option 2', selected: true },
      ],
      aggregates: {
        totalVoters: 1,
        totalVotes: 1,
        optionTotals: { 'opt-2': 1 },
      },
      timestamp: '2024-01-02T00:00:00.000Z',
    });

    expect(result.updated).toBe(true);
    expect(result.state.aggregates.totalVoters).toBe(1);
    expect(result.state.aggregates.totalVotes).toBe(1);
    expect(result.state.aggregates.optionTotals).toMatchObject({ 'opt-2': 1 });
    expect(result.state.aggregates.optionTotals['opt-1']).toBeUndefined();
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
