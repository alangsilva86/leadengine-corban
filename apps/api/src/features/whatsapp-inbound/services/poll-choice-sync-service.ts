import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import {
  PollChoiceStateSchema,
  type PollChoiceState,
} from '../schemas/poll-choice';
import { sanitizeJsonPayload } from '../utils/baileys-event-logger';
import {
  findPollVoteMessageCandidate,
  updateMessage as storageUpdateMessage,
} from '@ticketz/storage';
import { getPollMetadata } from './poll-metadata-service';
import { emitMessageUpdatedEvents } from '../../../services/ticket-service';
import { normalizeTextValue } from '@ticketz/shared';

const POLL_STATE_PREFIX = 'poll-state:';
const POLL_STATE_SOURCE = 'whatsapp.poll_state';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
};

const asArray = <T = unknown>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

const compactRecord = (input: UnknownRecord): UnknownRecord => {
  const result: UnknownRecord = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
};

const normalizeJson = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as T;
  } catch {
    return (null as unknown) as T;
  }
};

const resolveExistingOptionsIndex = (existingOptions: unknown[]): Map<number, UnknownRecord> => {
  const map = new Map<number, UnknownRecord>();
  existingOptions.forEach((entry, index) => {
    const record = asRecord(entry);
    if (record) {
      map.set(index, record);
      return;
    }

    if (typeof entry === 'string') {
      map.set(index, {
        title: entry,
        text: entry,
        name: entry,
      });
    }
  });
  return map;
};

const resolveExistingOptionsById = (existingOptions: unknown[]): Map<string, UnknownRecord> => {
  const map = new Map<string, UnknownRecord>();
  existingOptions.forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return;
    }

    const identifiers = [
      normalizeTextValue(record.id),
      normalizeTextValue(record.optionId),
      normalizeTextValue(record.key),
      normalizeTextValue(record.value),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const id of identifiers) {
      if (!map.has(id)) {
        map.set(id, { ...record, index });
      }
    }
  });
  return map;
};

const buildPollOptionMetadata = (
  option: PollChoiceState['options'][number],
  aggregates: PollChoiceState['aggregates'],
  index: number,
  existingById: Map<string, UnknownRecord>,
  existingByIndex: Map<number, UnknownRecord>
): UnknownRecord => {
  const aggregateVotes = aggregates.optionTotals?.[option.id] ?? 0;
  const existingCandidate =
    existingById.get(option.id) ??
    (typeof option.index === 'number' ? existingByIndex.get(option.index) : null) ??
    existingByIndex.get(index) ??
    null;

  const existingLabel =
    normalizeTextValue(existingCandidate?.title) ??
    normalizeTextValue(existingCandidate?.name) ??
    normalizeTextValue(existingCandidate?.text) ??
    null;

  const label =
    normalizeTextValue(option.title) ??
    existingLabel ??
    `Opção ${typeof option.index === 'number' ? option.index + 1 : index + 1}`;

  return compactRecord({
    id: option.id,
    index: typeof option.index === 'number' ? option.index : existingCandidate?.index ?? index,
    title: label,
    name: existingCandidate?.name ?? label,
    text: existingCandidate?.text ?? label,
    votes: aggregateVotes,
    count: aggregateVotes,
  });
};

export const buildPollMetadata = (existing: unknown, state: PollChoiceState): UnknownRecord => {
  const existingRecord = asRecord(existing) ?? {};
  const existingOptions = asArray(existingRecord.options);

  const existingByIndex = resolveExistingOptionsIndex(existingOptions);
  const existingById = resolveExistingOptionsById(existingOptions);

  const normalizedOptions = state.options.map((option, index) =>
    buildPollOptionMetadata(option, state.aggregates, index, existingById, existingByIndex)
  );

  const totalVotesFromOptions = normalizedOptions.reduce((acc, option) => {
    const votes = typeof option.votes === 'number' ? option.votes : 0;
    return acc + votes;
  }, 0);

  if (totalVotesFromOptions !== state.aggregates.totalVotes) {
    logger.warn('Poll choice state aggregates mismatch', {
      pollId: state.pollId,
      totalVotes: state.aggregates.totalVotes,
      aggregatedOptionVotes: totalVotesFromOptions,
    });
  }

  const question =
    normalizeTextValue(existingRecord.question) ??
    normalizeTextValue(existingRecord.title) ??
    normalizeTextValue(existingRecord.name) ??
    normalizeTextValue(state.context?.question) ??
    null;

  const base = {
    ...existingRecord,
    id: normalizeTextValue(existingRecord.id) ?? state.pollId,
    pollId: state.pollId,
    question: question ?? existingRecord.question,
    title: existingRecord.title ?? question ?? existingRecord.question,
    name: existingRecord.name ?? question ?? existingRecord.question,
    options: normalizedOptions,
    totalVotes: state.aggregates.totalVotes,
    totalVoters: state.aggregates.totalVoters,
    optionTotals: state.aggregates.optionTotals,
    aggregates: state.aggregates,
    updatedAt: state.updatedAt,
    brokerAggregates: state.brokerAggregates ?? undefined,
  };

  const sanitized = sanitizeJsonPayload(base);
  return (sanitized && typeof sanitized === 'object' ? sanitized : {}) as UnknownRecord;
};

const fetchPollState = async (pollId: string): Promise<PollChoiceState | null> => {
  const record = await prisma.processedIntegrationEvent.findUnique({
    where: { id: `${POLL_STATE_PREFIX}${pollId}` },
  });

  if (!record) {
    return null;
  }

  const parsed = PollChoiceStateSchema.safeParse(record.payload);
  if (!parsed.success) {
    logger.warn('Failed to parse poll-state payload', {
      pollId,
      issues: parsed.error.issues,
    });
    return null;
  }

  return parsed.data;
};

type SyncOptions = {
  state?: PollChoiceState | null;
  emit?: boolean;
};

export const syncPollChoiceState = async (
  pollId: string,
  options: SyncOptions = {}
): Promise<boolean> => {
  const trimmedPollId = pollId.trim();
  if (!trimmedPollId) {
    return false;
  }

  let state = options.state ?? (await fetchPollState(trimmedPollId));
  if (!state) {
    logger.warn('Poll choice state not found', { pollId: trimmedPollId });
    return false;
  }

  const stateId = `${POLL_STATE_PREFIX}${trimmedPollId}`;

  let tenantId = normalizeTextValue(state.context?.tenantId);
  if (!tenantId) {
    const metadata = await getPollMetadata(trimmedPollId);
    const metadataTenantId = normalizeTextValue(metadata?.tenantId);
    const metadataCreationMessageId = normalizeTextValue(metadata?.creationMessageId);
    const metadataCreationMessageKey = metadata?.creationMessageKey ?? null;

    if (!metadata || !metadataTenantId) {
      logger.error('Poll choice state missing tenant context and metadata unavailable', {
        pollId: trimmedPollId,
      });
      throw new Error('Poll choice state context unavailable');
    }

    const recoveredContext = {
      ...(state.context ?? {}),
      tenantId: metadataTenantId,
      ...(metadataCreationMessageId ? { creationMessageId: metadataCreationMessageId } : {}),
      ...(metadataCreationMessageKey ? { creationMessageKey: metadataCreationMessageKey } : {}),
    };

    const nextState: PollChoiceState = {
      ...state,
      context: recoveredContext,
    };

    try {
      await prisma.processedIntegrationEvent.upsert({
        where: { id: stateId },
        create: {
          id: stateId,
          source: POLL_STATE_SOURCE,
          cursor: trimmedPollId,
          payload: sanitizeJsonPayload(nextState),
        },
        update: {
          cursor: trimmedPollId,
          payload: sanitizeJsonPayload(nextState),
        },
      });
    } catch (error) {
      logger.error('Failed to persist recovered poll choice state context', {
        pollId: trimmedPollId,
        error,
      });
      throw error;
    }

    logger.info('poll_state.recovered_context', {
      pollId: trimmedPollId,
      tenantId: metadataTenantId,
      hasCreationMessageKey: Boolean(metadataCreationMessageKey),
      creationMessageId: metadataCreationMessageId ?? null,
    });

    state = nextState;
    tenantId = metadataTenantId;
  }

  if (!tenantId) {
    logger.warn('Poll choice state missing tenant context', {
      pollId: trimmedPollId,
    });
    return false;
  }

  const identifiers = new Set<string>();
  identifiers.add(trimmedPollId);

  const creationMessageId = normalizeTextValue(state.context?.creationMessageId);
  if (creationMessageId) {
    identifiers.add(creationMessageId);
  }

  Object.values(state.votes ?? {}).forEach((vote) => {
    const messageId = normalizeTextValue(vote?.messageId);
    if (messageId) {
      identifiers.add(messageId);
    }
  });

  const chatId =
    normalizeTextValue(state.context?.creationMessageKey?.remoteJid) ??
    normalizeTextValue(state.context?.creationMessageKey?.participant) ??
    null;

  const identifierList = Array.from(identifiers.values());

  let messageRecord = null as Awaited<
    ReturnType<typeof findPollVoteMessageCandidate>
  > | null;
  try {
    messageRecord = await findPollVoteMessageCandidate({
      tenantId,
      pollId: trimmedPollId,
      chatId: chatId ?? null,
      identifiers: identifierList,
    });
  } catch (error) {
    logger.error('Failed to lookup poll vote message candidate', {
      pollId: trimmedPollId,
      tenantId,
      chatId: chatId ?? null,
      identifiers: identifierList,
      error,
    });
    return false;
  }

  if (!messageRecord) {
    logger.warn('No message found for poll choice state', {
      pollId: trimmedPollId,
    });
    return false;
  }

  const existingMetadata = asRecord(messageRecord.metadata) ?? {};
  const existingPoll = existingMetadata.poll;
  const existingPollChoice = asRecord(existingMetadata.pollChoice);
  const nextPollMetadata = buildPollMetadata(existingPoll, state);

  const normalizedExisting = normalizeJson(existingPoll);
  const normalizedNext = normalizeJson(nextPollMetadata);

  const pollQuestion = normalizeTextValue((nextPollMetadata as { question?: unknown })?.question);
  const existingPollChoiceQuestion = normalizeTextValue(existingPollChoice?.question);

  const pollMetadataChanged =
    JSON.stringify(normalizedExisting) !== JSON.stringify(normalizedNext);
  const shouldUpdatePollChoiceQuestion = Boolean(
    pollQuestion && pollQuestion !== existingPollChoiceQuestion
  );

  if (!pollMetadataChanged && !shouldUpdatePollChoiceQuestion) {
    return false;
  }

  const metadataPayload: UnknownRecord = {};

  if (pollMetadataChanged) {
    metadataPayload.poll = normalizedNext as UnknownRecord;
  }

  let pollChoiceUpdateApplied = false;
  if (shouldUpdatePollChoiceQuestion) {
    const sanitizedPollChoice = sanitizeJsonPayload({
      ...(existingPollChoice ?? {}),
      question: pollQuestion,
    });

    if (
      sanitizedPollChoice &&
      typeof sanitizedPollChoice === 'object' &&
      !Array.isArray(sanitizedPollChoice)
    ) {
      metadataPayload.pollChoice = sanitizedPollChoice as UnknownRecord;
      pollChoiceUpdateApplied = true;
    }
  }

  if (!metadataPayload.poll && !pollChoiceUpdateApplied) {
    return false;
  }

  const updated = await storageUpdateMessage(messageRecord.tenantId, messageRecord.id, {
    metadata: metadataPayload,
  }).catch((error: unknown) => {
    logger.error('Failed to persist poll metadata on message', {
      pollId: trimmedPollId,
      messageId: messageRecord.id,
      error,
    });
    return null;
  });

  if (!updated) {
    return false;
  }

  if (options.emit ?? true) {
    try {
      await emitMessageUpdatedEvents(messageRecord.tenantId, updated.ticketId, updated, null);
    } catch (error) {
      logger.error('Failed to emit poll metadata realtime update', {
        pollId: trimmedPollId,
        messageId: updated.id,
        error,
      });
    }
  }

  logger.info('Poll choice state synchronized with message metadata', {
    pollId: trimmedPollId,
    messageId: updated.id,
    ticketId: updated.ticketId,
    totalVotes: state.aggregates.totalVotes,
    totalVoters: state.aggregates.totalVoters,
  });

  return true;
};

export const __testing = {
  buildPollMetadata,
  resolveExistingOptionsById,
  resolveExistingOptionsIndex,
};
