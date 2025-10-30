import type { PollChoiceSelectedOptionPayload } from '../../../schemas/poll-choice';
import type { PersistPollChoiceVoteResult } from '../../../services/poll-choice-pipeline';

export type PollChoicePayloadInput = {
  pollId?: string;
  voterJid?: string;
  messageId?: string;
  selectedOptionIds?: string[];
  selectedOptions?: PollChoiceSelectedOptionPayload[];
  options?: PollChoiceSelectedOptionPayload[];
  aggregates?: {
    totalVoters?: number;
    totalVotes?: number;
    optionTotals?: Record<string, number>;
  };
  timestamp?: string;
  tenantId?: string;
};

export const createPollChoicePayload = (overrides: PollChoicePayloadInput = {}) => {
  const now = new Date().toISOString();

  return {
    pollId: overrides.pollId ?? 'poll-default',
    voterJid: overrides.voterJid ?? '5511999999999@s.whatsapp.net',
    messageId: overrides.messageId ?? 'wamid-default',
    selectedOptionIds: overrides.selectedOptionIds ?? [],
    selectedOptions: overrides.selectedOptions ?? [],
    options: overrides.options ?? [],
    aggregates: {
      totalVoters: overrides.aggregates?.totalVoters ?? 0,
      totalVotes: overrides.aggregates?.totalVotes ?? 0,
      optionTotals: overrides.aggregates?.optionTotals ?? {},
    },
    timestamp: overrides.timestamp ?? now,
    tenantId: overrides.tenantId ?? 'tenant-123',
  };
};

export const createPollChoiceVoteState = (
  overrides: Partial<PersistPollChoiceVoteResult['state']> = {}
): PersistPollChoiceVoteResult['state'] => {
  const now = new Date().toISOString();

  return {
    pollId: overrides.pollId ?? 'poll-default',
    options: overrides.options ?? [],
    votes: overrides.votes ?? {},
    aggregates:
      overrides.aggregates ?? ({ totalVoters: 0, totalVotes: 0, optionTotals: {} } as PersistPollChoiceVoteResult['state']['aggregates']),
    brokerAggregates:
      overrides.brokerAggregates ?? ({ totalVoters: 0, totalVotes: 0, optionTotals: {} } as PersistPollChoiceVoteResult['state']['brokerAggregates']),
    updatedAt: overrides.updatedAt ?? now,
    context: overrides.context ?? { tenantId: null },
  };
};

export const createPollChoiceEventEnvelope = (
  overrides: {
    event?: string;
    tenantId?: string | null;
    payload?: PollChoicePayloadInput;
  } = {}
) => ({
  event: overrides.event ?? 'POLL_CHOICE',
  tenantId: overrides.tenantId ?? 'tenant-123',
  payload: createPollChoicePayload(overrides.payload ?? {}),
});
