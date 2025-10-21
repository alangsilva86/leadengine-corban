import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import {
  PollChoiceAggregatesSchema,
  PollChoiceEventSchema,
  PollChoiceStateSchema,
  type PollChoiceAggregatesPayload,
  type PollChoiceEventPayload,
  type PollChoiceSelectedOptionPayload,
  type PollChoiceState,
  type PollChoiceVoteEntry,
} from '../schemas/poll-choice';
import { sanitizeJsonPayload } from '../utils/baileys-event-logger';

interface PollChoiceContext {
  tenantId?: string | null;
  instanceId?: string | null;
}

const POLL_STATE_SOURCE = 'whatsapp.poll_state';

const toArrayUnique = (values: string[]): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }
  return Array.from(unique.values());
};

const resolveSelectedOptionIds = (payload: PollChoiceEventPayload): string[] => {
  const fromArray = Array.isArray(payload.selectedOptionIds) ? payload.selectedOptionIds : [];
  const fromOptions = payload.options
    .filter((option) => option.selected)
    .map((option) => option.id);

  return toArrayUnique([...fromArray, ...fromOptions]);
};

const computeAggregates = (votes: Record<string, PollChoiceVoteEntry>): PollChoiceAggregatesPayload => {
  const optionTotals: Record<string, number> = {};
  let totalVoters = 0;
  let totalVotes = 0;

  for (const vote of Object.values(votes)) {
    if (!vote || !Array.isArray(vote.optionIds)) {
      continue;
    }

    const selected = toArrayUnique(vote.optionIds);
    if (selected.length === 0) {
      continue;
    }

    totalVoters += 1;
    totalVotes += selected.length;

    for (const optionId of selected) {
      optionTotals[optionId] = (optionTotals[optionId] ?? 0) + 1;
    }
  }

  return {
    totalVoters,
    totalVotes,
    optionTotals,
  };
};

const normalizeOptionTitle = (option: { title?: string | null; text?: string | null; description?: string | null }): string | null => {
  if (typeof option.title === 'string' && option.title.trim().length > 0) {
    return option.title.trim();
  }
  if (typeof option.text === 'string' && option.text.trim().length > 0) {
    return option.text.trim();
  }
  if (typeof option.description === 'string' && option.description.trim().length > 0) {
    return option.description.trim();
  }
  return null;
};

const mergeOptions = (
  existing: PollChoiceState['options'],
  incoming: PollChoiceEventPayload['options']
): PollChoiceState['options'] => {
  const map = new Map<string, { id: string; title?: string | null; index?: number | null }>();

  for (const option of existing) {
    map.set(option.id, {
      id: option.id,
      title: option.title ?? null,
      index: option.index ?? null,
    });
  }

  for (const option of incoming) {
    const current = map.get(option.id) ?? { id: option.id };
    const title = normalizeOptionTitle(option) ?? current.title ?? null;
    const index = option.index ?? current.index ?? null;

    map.set(option.id, {
      id: option.id,
      title,
      index,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const aIndex = typeof a.index === 'number' ? a.index : Number.MAX_SAFE_INTEGER;
    const bIndex = typeof b.index === 'number' ? b.index : Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.id.localeCompare(b.id);
  });
};

const selectionsMatch = (left: string[] | undefined, right: string[] | undefined): boolean => {
  const normalizedLeft = toArrayUnique(left ?? []);
  const normalizedRight = toArrayUnique(right ?? []);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  const leftSet = new Set(normalizedLeft);
  return normalizedRight.every((value) => leftSet.has(value));
};

const buildStateId = (pollId: string): string => `poll-state:${pollId}`;

const normalizeSelectedOptionTitle = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const deriveSelectedOptions = (
  selectedOptionIds: string[],
  mergedOptions: PollChoiceState['options'],
  incomingOptions: PollChoiceEventPayload['options'],
  payloadSelectedOptions?: PollChoiceEventPayload['selectedOptions']
): PollChoiceSelectedOptionPayload[] => {
  const ids = toArrayUnique(selectedOptionIds);
  if (ids.length === 0) {
    return [];
  }

  const payloadMap = new Map<string, PollChoiceSelectedOptionPayload>();
  if (Array.isArray(payloadSelectedOptions)) {
    for (const entry of payloadSelectedOptions) {
      const trimmedId = entry.id.trim();
      if (!trimmedId) {
        continue;
      }

      payloadMap.set(trimmedId, {
        ...entry,
        id: trimmedId,
        title: normalizeSelectedOptionTitle(entry.title),
      });
    }
  }

  const incomingMap = new Map(incomingOptions.map((option) => [option.id, option] as const));
  const mergedMap = new Map(mergedOptions.map((option) => [option.id, option] as const));

  return ids.map((id) => {
    const payloadOption = payloadMap.get(id);
    if (payloadOption) {
      return payloadOption;
    }

    const incomingOption = incomingMap.get(id);
    if (incomingOption) {
      return { id, title: normalizeOptionTitle(incomingOption) };
    }

    const mergedOption = mergedMap.get(id);
    if (mergedOption) {
      const title = normalizeSelectedOptionTitle(mergedOption.title ?? null);
      return { id, title };
    }

    return { id, title: null };
  });
};

const ensureState = (payload: unknown, pollId: string): PollChoiceState => {
  const parsed = PollChoiceStateSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    pollId,
    options: [],
    votes: {},
    aggregates: PollChoiceAggregatesSchema.parse({}),
    brokerAggregates: undefined,
    updatedAt: new Date(0).toISOString(),
  };
};

export interface RecordPollChoiceVoteResult {
  updated: boolean;
  state: PollChoiceState;
  selectedOptions: PollChoiceSelectedOptionPayload[];
}

export const recordPollChoiceVote = async (
  payload: PollChoiceEventPayload,
  context: PollChoiceContext = {}
): Promise<RecordPollChoiceVoteResult> => {
  const parsed = PollChoiceEventSchema.parse(payload);
  const pollId = parsed.pollId.trim();
  const voterJid = parsed.voterJid.trim();

  if (!pollId || !voterJid) {
    throw new Error('Invalid poll choice payload');
  }

  const selectedOptionIds = resolveSelectedOptionIds(parsed);
  const stateId = buildStateId(pollId);

  const existingRecord = await prisma.processedIntegrationEvent.findUnique({
    where: { id: stateId },
  });

  const existingState = ensureState(existingRecord?.payload, pollId);
  const options = mergeOptions(existingState.options, parsed.options);
  const selectedOptions = deriveSelectedOptions(
    selectedOptionIds,
    options,
    parsed.options,
    parsed.selectedOptions
  );
  const previousVote = existingState.votes[voterJid];

  const sameSelection = selectionsMatch(previousVote?.optionIds, selectedOptionIds);
  const sameMessage = previousVote?.messageId === (parsed.messageId ?? null);
  const sameTimestamp = previousVote?.timestamp === (parsed.timestamp ?? null);

  if (existingRecord && sameSelection && sameMessage && sameTimestamp) {
    const previousSelected = Array.isArray(previousVote?.selectedOptions)
      ? (previousVote?.selectedOptions as PollChoiceSelectedOptionPayload[])
      : [];
    return {
      updated: false,
      state: existingState,
      selectedOptions: previousSelected.length > 0 ? previousSelected : selectedOptions,
    };
  }

  const updatedVotes: Record<string, PollChoiceVoteEntry> = {
    ...existingState.votes,
    [voterJid]: {
      optionIds: selectedOptionIds,
      selectedOptions,
      messageId: parsed.messageId ?? null,
      timestamp: parsed.timestamp ?? null,
    },
  };

  const aggregates = computeAggregates(updatedVotes);
  const updatedState: PollChoiceState = {
    pollId,
    options,
    votes: updatedVotes,
    aggregates,
    brokerAggregates: parsed.aggregates,
    updatedAt: new Date().toISOString(),
  };

  try {
    await prisma.processedIntegrationEvent.upsert({
      where: { id: stateId },
      create: {
        id: stateId,
        source: POLL_STATE_SOURCE,
        cursor: pollId,
        payload: sanitizeJsonPayload(updatedState),
      },
      update: {
        cursor: pollId,
        payload: sanitizeJsonPayload(updatedState),
      },
    });
  } catch (error) {
    logger.error('Failed to persist WhatsApp poll choice state', {
      pollId,
      tenantId: context.tenantId ?? null,
      instanceId: context.instanceId ?? null,
      error,
    });
    throw error;
  }

  return { updated: true, state: updatedState, selectedOptions };
};

export const __testing = {
  resolveSelectedOptionIds,
  computeAggregates,
  mergeOptions,
  selectionsMatch,
  ensureState,
  buildStateId,
};
