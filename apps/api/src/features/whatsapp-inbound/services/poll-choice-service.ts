import { decryptPollVote } from '@whiskeysockets/baileys';

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
import { getPollMetadata, type PollMetadataOption } from './poll-metadata-service';

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

type OptionLabelSource = {
  title?: string | null | undefined;
  text?: string | null | undefined;
  description?: string | null | undefined;
};

const normalizeOptionTitle = (option: OptionLabelSource): string | null => {
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
  incoming: PollChoiceEventPayload['options'],
  metadataOptions: PollMetadataOption[] | null | undefined
): PollChoiceState['options'] => {
  type NormalizedOption = { id: string; title: string | null; index: number | null };
  const map = new Map<string, NormalizedOption>();

  for (const option of existing) {
    map.set(option.id, {
      id: option.id,
      title: option.title ?? null,
      index: option.index ?? null,
    });
  }

  for (const option of metadataOptions ?? []) {
    if (!option.id) {
      continue;
    }

    const current =
      map.get(option.id) ?? { id: option.id, title: null, index: null };
    map.set(option.id, {
      id: option.id,
      title: option.title ?? current.title ?? null,
      index:
        typeof option.index === 'number' ? option.index : current.index ?? null,
    });
  }

  for (const option of incoming) {
    const current =
      map.get(option.id) ?? { id: option.id, title: null, index: null };
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

const base64UrlEncode = (input: Uint8Array): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');

const decodeBase64Variant = (value: string | null | undefined): Buffer | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[0-9a-fA-F]+$/u.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  if (!/^[A-Za-z0-9+/=_-]+$/u.test(trimmed)) {
    return null;
  }

  let normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  if (normalized.length % 4 !== 0) {
    normalized = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)), '=');
  }

  try {
    const buffer = Buffer.from(normalized, 'base64');
    const reencoded = base64UrlEncode(buffer);
    const normalizedInput = trimmed.replace(/=+$/u, '');
    if (reencoded === normalizedInput) {
      return buffer;
    }
  } catch (error) {
    logger.debug('Failed to decode base64 payload for poll vote helper', {
      error,
    });
  }

  return null;
};

const buildOptionLookup = (
  metadataOptions: PollMetadataOption[] | null | undefined,
  stateOptions: PollChoiceState['options']
): Map<string, string> => {
  const map = new Map<string, string>();

  const register = (option: { id?: string | null | undefined } | null | undefined): void => {
    const optionId = option?.id?.trim();
    if (!optionId) {
      return;
    }

    const decoded = decodeBase64Variant(optionId) ?? Buffer.from(optionId);
    const key = base64UrlEncode(decoded);

    if (!map.has(key)) {
      map.set(key, optionId);
    }
  };

  for (const option of metadataOptions ?? []) {
    register(option);
  }

  for (const option of stateOptions) {
    register(option);
  }

  return map;
};

const decryptEncryptedVoteSelections = (params: {
  pollId: string;
  voterJid: string;
  encryptedVote: PollChoiceVoteEntry['encryptedVote'] | undefined;
  messageSecret: string | null;
  creationMessageId: string | null;
  creationMessageKey:
    | { remoteJid?: string | null; participant?: string | null; fromMe?: boolean | null }
    | null;
  metadataOptions: PollMetadataOption[] | null | undefined;
  stateOptions: PollChoiceState['options'];
}): string[] | null => {
  if (!params.encryptedVote?.encPayload || !params.encryptedVote.encIv) {
    return null;
  }

  if (!params.messageSecret || !params.creationMessageId || !params.creationMessageKey) {
    return null;
  }

  const payloadBytes = decodeBase64Variant(params.encryptedVote.encPayload);
  const ivBytes = decodeBase64Variant(params.encryptedVote.encIv);
  const secretBytes = decodeBase64Variant(params.messageSecret);

  if (!payloadBytes || !ivBytes || !secretBytes) {
    logger.warn('Invalid encrypted poll vote payload - unable to decode buffers', {
      pollId: params.pollId,
      voterJid: params.voterJid,
    });
    return null;
  }

  const creatorJid =
    params.creationMessageKey.participant?.trim() ??
    params.creationMessageKey.remoteJid?.trim() ??
    null;

  if (!creatorJid) {
    logger.warn('Missing poll creator JID for encrypted vote decryption', {
      pollId: params.pollId,
      voterJid: params.voterJid,
    });
    return null;
  }

  try {
    const voteMessage = decryptPollVote(
      { encPayload: payloadBytes, encIv: ivBytes },
      {
        pollCreatorJid: creatorJid,
        pollMsgId: params.creationMessageId,
        pollEncKey: secretBytes,
        voterJid: params.voterJid,
      }
    );

    const selected = Array.isArray(voteMessage?.selectedOptions)
      ? voteMessage.selectedOptions
      : [];

    if (!selected.length) {
      return [];
    }

    const optionMap = buildOptionLookup(params.metadataOptions, params.stateOptions);

    const normalized = selected
      .map((entry) => {
        const key = base64UrlEncode(entry);
        return optionMap.get(key) ?? key;
      })
      .filter((value): value is string => Boolean(value));

    return toArrayUnique(normalized);
  } catch (error) {
    logger.warn('Failed to decrypt WhatsApp poll vote using stored metadata', {
      pollId: params.pollId,
      voterJid: params.voterJid,
      error,
    });
    return null;
  }
};

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
    context: undefined,
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

  const stateId = buildStateId(pollId);

  const [existingRecord, pollMetadata] = await Promise.all([
    prisma.processedIntegrationEvent.findUnique({
      where: { id: stateId },
    }),
    getPollMetadata(pollId),
  ]);

  const existingState = ensureState(existingRecord?.payload, pollId);
  const previousVote = existingState.votes[voterJid];

  const resolvedMessageSecret =
    pollMetadata?.messageSecret ?? existingState.context?.messageSecret ?? null;
  const resolvedCreationMessageIdForDecrypt =
    parsed.pollCreationMessageId?.trim() ??
    pollMetadata?.creationMessageId?.trim() ??
    existingState.context?.creationMessageId?.trim() ??
    pollId;
  const resolvedCreationKey =
    parsed.pollCreationMessageKey ??
    pollMetadata?.creationMessageKey ??
    existingState.context?.creationMessageKey ??
    null;

  let selectedOptionIds = resolveSelectedOptionIds(parsed);

  if (selectedOptionIds.length === 0 && previousVote?.encryptedVote) {
    try {
      const decryptedOptionIds = decryptEncryptedVoteSelections({
        pollId,
        voterJid,
        encryptedVote: previousVote.encryptedVote,
        messageSecret: resolvedMessageSecret,
        creationMessageId: resolvedCreationMessageIdForDecrypt,
        creationMessageKey: resolvedCreationKey,
        metadataOptions: pollMetadata?.options,
        stateOptions: existingState.options,
      });
      if (Array.isArray(decryptedOptionIds) && decryptedOptionIds.length > 0) {
        selectedOptionIds = decryptedOptionIds;
      }
    } catch (error) {
      logger.warn('Failed to resolve encrypted poll selections from helper', {
        pollId,
        voterJid,
        error,
      });
    }
  }

  const options = mergeOptions(existingState.options, parsed.options, pollMetadata?.options);
  const selectedOptions = deriveSelectedOptions(
    selectedOptionIds,
    options,
    parsed.options,
    parsed.selectedOptions
  );

  const resolvedQuestion =
    pollMetadata?.question ?? existingState.context?.question ?? null;
  const resolvedSelectableCount =
    pollMetadata?.selectableOptionsCount ??
    existingState.context?.selectableOptionsCount ??
    (parsed.options.length > 0 ? parsed.options.length : null);

  let resolvedAllowMultiple =
    pollMetadata?.allowMultipleAnswers ??
    existingState.context?.allowMultipleAnswers ??
    undefined;

  if (resolvedAllowMultiple === undefined && typeof resolvedSelectableCount === 'number') {
    resolvedAllowMultiple = resolvedSelectableCount > 1;
  }

  const resolvedContext = {
    question: resolvedQuestion,
    selectableOptionsCount: resolvedSelectableCount,
    allowMultipleAnswers: resolvedAllowMultiple ?? undefined,
    creationMessageId:
      pollMetadata?.creationMessageId ?? existingState.context?.creationMessageId ?? null,
    creationMessageKey: resolvedCreationKey ?? undefined,
    messageSecret: pollMetadata?.messageSecret ?? existingState.context?.messageSecret ?? null,
    messageSecretVersion:
      pollMetadata?.messageSecretVersion ?? existingState.context?.messageSecretVersion ?? null,
    tenantId: context.tenantId ?? pollMetadata?.tenantId ?? existingState.context?.tenantId ?? null,
    instanceId:
      context.instanceId ?? pollMetadata?.instanceId ?? existingState.context?.instanceId ?? null,
  };

  const normalizedContextEntries = Object.entries(resolvedContext).filter(([, value]) => value !== undefined);
  const normalizedContext =
    normalizedContextEntries.length > 0
      ? (Object.fromEntries(normalizedContextEntries) as NonNullable<PollChoiceState['context']>)
      : undefined;

  const contextChanged =
    JSON.stringify(normalizedContext ?? null) !== JSON.stringify(existingState.context ?? null);

  const sameSelection = selectionsMatch(previousVote?.optionIds, selectedOptionIds);
  const sameMessage = previousVote?.messageId === (parsed.messageId ?? null);
  const sameTimestamp = previousVote?.timestamp === (parsed.timestamp ?? null);

  const previousSelectedOptions = Array.isArray(previousVote?.selectedOptions)
    ? (previousVote.selectedOptions as PollChoiceSelectedOptionPayload[])
    : [];
  const shouldPersistSelectionDetails =
    selectedOptions.length > 0 && previousSelectedOptions.length === 0;

  if (
    existingRecord &&
    sameSelection &&
    sameMessage &&
    sameTimestamp &&
    !contextChanged &&
    !shouldPersistSelectionDetails
  ) {
    const previousSelected = previousSelectedOptions;
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
      encryptedVote: previousVote?.encryptedVote,
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
    ...(normalizedContext ? { context: normalizedContext } : {}),
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

export const recordEncryptedPollVote = async (params: {
  pollId?: string | null;
  voterJid?: string | null;
  messageId?: string | null;
  encryptedVote?: { encPayload?: string | null; encIv?: string | null; ciphertext?: string | null } | null;
  timestamp?: string | null;
}): Promise<void> => {
  const pollId = params.pollId?.trim();
  const voterJid = params.voterJid?.trim();

  if (!pollId || !voterJid) {
    return;
  }

  const stateId = buildStateId(pollId);

  const existingRecord = await prisma.processedIntegrationEvent.findUnique({
    where: { id: stateId },
  });

  const state = ensureState(existingRecord?.payload, pollId);
  const voteEntry: PollChoiceVoteEntry = state.votes[voterJid] ?? {
    optionIds: [],
    selectedOptions: [],
    messageId: params.messageId ?? null,
    timestamp: params.timestamp ?? null,
  };

  voteEntry.encryptedVote = {
    encPayload: params.encryptedVote?.encPayload ?? voteEntry.encryptedVote?.encPayload ?? null,
    encIv: params.encryptedVote?.encIv ?? voteEntry.encryptedVote?.encIv ?? null,
    ciphertext: params.encryptedVote?.ciphertext ?? voteEntry.encryptedVote?.ciphertext ?? null,
  };

  if (params.messageId) {
    voteEntry.messageId = params.messageId;
  }

  if (params.timestamp) {
    voteEntry.timestamp = params.timestamp;
  }

  state.votes[voterJid] = voteEntry;
  state.aggregates = computeAggregates(state.votes);
  state.updatedAt = new Date().toISOString();

  try {
    await prisma.processedIntegrationEvent.upsert({
      where: { id: stateId },
      create: {
        id: stateId,
        source: POLL_STATE_SOURCE,
        cursor: pollId,
        payload: sanitizeJsonPayload(state),
      },
      update: {
        cursor: pollId,
        payload: sanitizeJsonPayload(state),
      },
    });
  } catch (error) {
    logger.warn('Failed to persist encrypted poll vote metadata', {
      pollId,
      voterJid,
      error,
    });
  }
};

export const __testing = {
  resolveSelectedOptionIds,
  computeAggregates,
  mergeOptions,
  selectionsMatch,
  ensureState,
  buildStateId,
  decryptEncryptedVoteSelections,
};
