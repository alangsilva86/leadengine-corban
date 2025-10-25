import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoistedMocks = vi.hoisted(() => {
  const findUniqueMock = vi.fn();
  const upsertMock = vi.fn();
  const getPollMetadataMock = vi.fn();

  return {
    findUniqueMock,
    upsertMock,
    getPollMetadataMock,
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
    warn: vi.fn(),
  },
}));

vi.mock('../poll-metadata-service', () => ({
  getPollMetadata: hoistedMocks.getPollMetadataMock,
}));

import { recordPollChoiceVote, recordEncryptedPollVote } from '../poll-choice-service';

const buildStatePayload = () => ({
  pollId: 'poll-1',
  options: [
    { id: 'opt-1', title: 'Option 1', index: 0 },
    { id: 'opt-2', title: 'Option 2', index: 1 },
  ],
  votes: {
    'user@s.whatsapp.net': {
      optionIds: ['opt-1'],
      selectedOptions: [{ id: 'opt-1', title: 'Option 1' }],
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
  const { findUniqueMock, upsertMock, getPollMetadataMock } = hoistedMocks;

  beforeEach(() => {
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    getPollMetadataMock.mockReset();
    getPollMetadataMock.mockResolvedValue(null);
  });

  it('merges poll metadata details into state context', async () => {
    getPollMetadataMock.mockResolvedValueOnce({
      pollId: 'poll-1',
      question: 'Você confirma?',
      selectableOptionsCount: 1,
      allowMultipleAnswers: false,
      options: [{ id: 'opt-1', title: 'Sim 👍', index: 0 }],
      creationMessageId: 'poll-1',
      creationMessageKey: { remoteJid: '5511999999999@s.whatsapp.net' },
      messageSecret: 'abc',
      messageSecretVersion: 1,
    });
    findUniqueMock.mockResolvedValueOnce(null);
    upsertMock.mockResolvedValueOnce({} as never);

    const result = await recordPollChoiceVote({
      pollId: 'poll-1',
      voterJid: 'user@s.whatsapp.net',
      messageId: 'wamid-1',
      selectedOptionIds: ['opt-1'],
      options: [{ id: 'opt-1', title: 'Sim 👍', selected: true }],
      aggregates: {
        totalVoters: 1,
        totalVotes: 1,
        optionTotals: { 'opt-1': 1 },
      },
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(result.updated).toBe(true);
    expect(result.state.context).toMatchObject({
      question: 'Você confirma?',
      selectableOptionsCount: 1,
      allowMultipleAnswers: false,
      creationMessageId: 'poll-1',
      messageSecret: 'abc',
      messageSecretVersion: 1,
    });
    expect(upsertMock).toHaveBeenCalledTimes(1);
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
    expect(result.selectedOptions).toEqual([{ id: 'opt-1', title: 'Option 1' }]);
    expect(result.state.aggregates).toMatchObject({
      totalVoters: 1,
      totalVotes: 1,
      optionTotals: { 'opt-1': 1 },
    });
    expect(result.state.votes['user@s.whatsapp.net']?.selectedOptions).toEqual([
      { id: 'opt-1', title: 'Option 1' },
    ]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [upsertArgs] = upsertMock.mock.calls[0] ?? [];
    const payload = upsertArgs?.update?.payload ?? upsertArgs?.create?.payload;
    expect(payload).toMatchObject({
      pollId: 'poll-1',
      aggregates: { totalVoters: 1, totalVotes: 1 },
      context: {
        selectableOptionsCount: 2,
        allowMultipleAnswers: true,
      },
    });
    expect(result.state.context).toMatchObject({
      selectableOptionsCount: 2,
      allowMultipleAnswers: true,
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
    expect(result.selectedOptions).toEqual([{ id: 'opt-1', title: 'Option 1' }]);
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
    expect(result.selectedOptions).toEqual([{ id: 'opt-2', title: 'Option 2' }]);
    expect(result.state.aggregates.totalVoters).toBe(1);
    expect(result.state.aggregates.totalVotes).toBe(1);
    expect(result.state.aggregates.optionTotals).toMatchObject({ 'opt-2': 1 });
    expect(result.state.aggregates.optionTotals['opt-1']).toBeUndefined();
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});

describe('recordEncryptedPollVote', () => {
  const { findUniqueMock, upsertMock, getPollMetadataMock } = hoistedMocks;

  beforeEach(() => {
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    getPollMetadataMock.mockReset();
  });

  it('stores encrypted vote details for new poll state', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    upsertMock.mockResolvedValueOnce({} as never);

    await recordEncryptedPollVote({
      pollId: 'poll-1',
      voterJid: 'user@s.whatsapp.net',
      messageId: 'wamid-vote',
      encryptedVote: {
        encPayload: 'payload',
        encIv: 'iv',
        ciphertext: 'cipher',
      },
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [upsertArgs] = upsertMock.mock.calls[0] ?? [];
    const payload = upsertArgs?.create?.payload ?? upsertArgs?.update?.payload;
    expect(payload.votes['user@s.whatsapp.net']).toMatchObject({
      encryptedVote: {
        encPayload: 'payload',
        encIv: 'iv',
        ciphertext: 'cipher',
      },
      messageId: 'wamid-vote',
      timestamp: '2024-01-01T00:00:00.000Z',
    });
  });
});
