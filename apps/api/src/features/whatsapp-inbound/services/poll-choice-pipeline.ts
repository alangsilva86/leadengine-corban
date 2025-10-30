import type { ZodIssue } from 'zod';

import { findPollVoteMessageCandidate } from '@ticketz/storage';

import {
  PollChoiceEventSchema,
  type PollChoiceEventPayload,
  type PollChoiceSelectedOptionPayload,
  type PollChoiceState,
  type PollChoiceVoteEntry,
} from '../schemas/poll-choice';
import { recordPollChoiceVote } from './poll-choice-service';

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = value.toString().trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
};

const normalizeChatId = (value: unknown): string | null => {
  const text = toTrimmedString(value);
  if (!text) {
    return null;
  }

  if (text.includes('@')) {
    return text;
  }

  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) {
    return text;
  }

  return `${digits}@s.whatsapp.net`;
};

const sanitizeOptionText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractPollOptionLabel = (option: PollChoiceSelectedOptionPayload): string | null => {
  const label =
    sanitizeOptionText(option.title) ??
    sanitizeOptionText((option as { optionName?: unknown }).optionName) ??
    sanitizeOptionText((option as { name?: unknown }).name) ??
    sanitizeOptionText((option as { text?: unknown }).text) ??
    sanitizeOptionText((option as { description?: unknown }).description) ??
    sanitizeOptionText(option.id);

  return label;
};

const buildSelectedOptionSummaries = (
  selectedOptions: PollChoiceSelectedOptionPayload[]
): Array<{ id: string; title: string }> => {
  const normalized: Array<{ id: string; title: string }> = [];
  const seen = new Set<string>();

  for (const option of selectedOptions) {
    const id = sanitizeOptionText(option.id) ?? option.id;
    const title = extractPollOptionLabel(option);
    if (!title) {
      continue;
    }

    const dedupeKey = `${id}|${title}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push({ id, title });
  }

  return normalized;
};

const normalizeSelectionId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
};

const extractSelectionIdSet = (value: unknown): Set<string> | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = new Set<string>();

  for (const entry of value) {
    const normalizedEntry = normalizeSelectionId(entry);
    if (normalizedEntry) {
      normalized.add(normalizedEntry);
    }
  }

  return normalized.size > 0 ? normalized : null;
};

const collectSelectionIdSetsFromMetadata = (metadata: unknown): Set<string>[] => {
  const candidates: Set<string>[] = [];

  if (!metadata || typeof metadata !== 'object') {
    return candidates;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const pollVoteMetadata = metadataRecord.rewrite &&
    typeof metadataRecord.rewrite === 'object' &&
    metadataRecord.rewrite !== null
      ? (metadataRecord.rewrite as Record<string, unknown>).pollVote
      : null;

  if (!pollVoteMetadata || typeof pollVoteMetadata !== 'object') {
    return candidates;
  }

  const pollVoteRecord = pollVoteMetadata as Record<string, unknown>;
  const pollVoteSelected = extractSelectionIdSet(pollVoteRecord.selectedOptions);
  if (pollVoteSelected) {
    candidates.push(pollVoteSelected);
  }

  const pollVoteVote = pollVoteRecord.vote && typeof pollVoteRecord.vote === 'object'
    ? (pollVoteRecord.vote as Record<string, unknown>)
    : null;

  if (pollVoteVote) {
    const pollVoteVoteIds = extractSelectionIdSet(pollVoteVote.optionIds);
    if (pollVoteVoteIds) {
      candidates.push(pollVoteVoteIds);
    }

    const pollVoteVoteOptions = extractSelectionIdSet(pollVoteVote.selectedOptions);
    if (pollVoteVoteOptions) {
      candidates.push(pollVoteVoteOptions);
    }
  }

  return candidates;
};

const pollMessageMetadataMatchesSelections = (
  message: Awaited<ReturnType<typeof findPollVoteMessageCandidate>> | null,
  selectedOptions: PollChoiceSelectedOptionPayload[]
): boolean => {
  if (!message) {
    return false;
  }

  const expectedIds = new Set<string>();
  const summaries = buildSelectedOptionSummaries(selectedOptions);
  if (summaries.length > 0) {
    for (const summary of summaries) {
      const normalized = normalizeSelectionId(summary.id);
      if (normalized) {
        expectedIds.add(normalized);
      }
    }
  }

  if (expectedIds.size === 0) {
    for (const option of selectedOptions) {
      const normalized = normalizeSelectionId(option.id);
      if (normalized) {
        expectedIds.add(normalized);
      }
    }
  }

  if (expectedIds.size === 0) {
    return true;
  }

  const metadataCandidates = collectSelectionIdSetsFromMetadata(message.metadata);
  if (metadataCandidates.length === 0) {
    return false;
  }

  for (const candidate of metadataCandidates) {
    if (candidate.size !== expectedIds.size) {
      continue;
    }

    let matches = true;
    for (const id of expectedIds) {
      if (!candidate.has(id)) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
};

const dedupeStrings = (values: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();

  values.forEach((value) => {
    const normalized = toTrimmedString(value);
    if (normalized) {
      unique.add(normalized);
    }
  });

  return Array.from(unique.values());
};

export type PollChoiceValidationResult =
  | { status: 'invalid'; reason: 'missing_payload' | 'schema_error'; issues?: ZodIssue[] }
  | { status: 'valid'; payload: PollChoiceEventPayload };

export const validatePollChoicePayload = (
  payloadRecord: Record<string, unknown> | null
): PollChoiceValidationResult => {
  if (!payloadRecord) {
    return { status: 'invalid', reason: 'missing_payload' };
  }

  const parsed = PollChoiceEventSchema.safeParse(payloadRecord);
  if (!parsed.success) {
    return { status: 'invalid', reason: 'schema_error', issues: parsed.error.issues };
  }

  return { status: 'valid', payload: parsed.data };
};

export type PersistPollChoiceVoteDeps = {
  recordPollChoiceVote?: typeof recordPollChoiceVote;
};

export type PersistPollChoiceVoteResult = {
  status: 'persisted' | 'duplicate';
  poll: PollChoiceEventPayload & { selectedOptions: PollChoiceSelectedOptionPayload[] };
  state: PollChoiceState;
  voterState: PollChoiceVoteEntry | null;
  candidateMessageIds: string[];
};

export const persistPollChoiceVote = async (
  payload: PollChoiceEventPayload,
  context: { tenantId?: string | null; instanceId?: string | null },
  deps: PersistPollChoiceVoteDeps = {}
): Promise<PersistPollChoiceVoteResult> => {
  const recordVote = deps.recordPollChoiceVote ?? recordPollChoiceVote;
  const serviceResult = await recordVote(payload, context);

  const selectedOptions =
    serviceResult.selectedOptions.length > 0
      ? serviceResult.selectedOptions
      : payload.selectedOptions ?? [];

  const pollWithSelections = {
    ...payload,
    selectedOptions,
  };

  const candidateMessageIds = dedupeStrings([
    payload.messageId,
    payload.pollCreationMessageId,
    (payload.pollCreationMessageKey as { id?: string | null } | null | undefined)?.id,
    payload.pollId,
  ]);

  const voterState = serviceResult.state.votes?.[payload.voterJid] ?? null;

  return {
    status: serviceResult.updated ? 'persisted' : 'duplicate',
    poll: pollWithSelections,
    state: serviceResult.state,
    voterState: voterState ?? null,
    candidateMessageIds,
  };
};

export type RewritePollVoteMessageDeps = {
  updatePollVoteMessage: (params: {
    tenantId: string | null | undefined;
    chatId?: string | null | undefined;
    messageId?: string | null | undefined;
    messageIds?: Array<string | null | undefined> | null;
    pollId: string;
    voterJid: string;
    selectedOptions: PollChoiceSelectedOptionPayload[];
    timestamp?: string | null;
    question?: string | null;
    aggregates?: {
      totalVoters?: number | null;
      totalVotes?: number | null;
      optionTotals?: Record<string, number> | null;
    } | null;
    options?: PollChoiceSelectedOptionPayload[] | null;
    vote?: {
      optionIds?: string[] | null;
      selectedOptions?: PollChoiceSelectedOptionPayload[] | null;
      encryptedVote?: Record<string, unknown> | null;
      messageId?: string | null;
      timestamp?: string | null;
    } | null;
  }) => Promise<void>;
};

export type RewritePollVoteMessageResult =
  | { status: 'updated'; tenantId: string }
  | { status: 'missingTenant'; candidates: string[] };

export const rewritePollVoteMessage = async (
  params: {
    poll: PollChoiceEventPayload & { selectedOptions: PollChoiceSelectedOptionPayload[] };
    state: PollChoiceState;
    voterState: PollChoiceVoteEntry | null;
    candidateMessageIds: string[];
    tenantContext?: string | null;
  },
  deps: RewritePollVoteMessageDeps
): Promise<RewritePollVoteMessageResult> => {
  const tenantId =
    toTrimmedString(params.tenantContext) ??
    toTrimmedString(params.state.context?.tenantId) ??
    null;

  if (!tenantId) {
    return { status: 'missingTenant', candidates: params.candidateMessageIds };
  }

  const vote = params.voterState
    ? {
        optionIds: Array.isArray(params.voterState.optionIds) ? params.voterState.optionIds : null,
        selectedOptions: Array.isArray(params.voterState.selectedOptions)
          ? params.voterState.selectedOptions
          : null,
        encryptedVote: params.voterState.encryptedVote ?? null,
        messageId: params.voterState.messageId ?? null,
        timestamp: params.voterState.timestamp ?? null,
      }
    : {
        optionIds: params.poll.selectedOptions.map((entry) => entry.id),
        selectedOptions: params.poll.selectedOptions,
        timestamp: params.poll.timestamp ?? null,
      };

  await deps.updatePollVoteMessage({
    tenantId,
    chatId: normalizeChatId(params.poll.voterJid),
    messageId: params.candidateMessageIds.at(0) ?? null,
    messageIds: params.candidateMessageIds,
    pollId: params.poll.pollId,
    voterJid: params.poll.voterJid,
    selectedOptions: params.poll.selectedOptions,
    timestamp: params.poll.timestamp ?? null,
    question: params.state.context?.question ?? null,
    aggregates: params.state.aggregates ?? null,
    options: params.state.options ?? null,
    vote,
  });

  return { status: 'updated', tenantId };
};

export type SchedulePollInboxFallbackDeps = {
  findPollVoteMessageCandidate?: typeof findPollVoteMessageCandidate;
};

export type SchedulePollInboxFallbackResult =
  | { status: 'missingTenant'; pollId: string; tenantId: null; chatId: string | null }
  | {
      status: 'skip';
      reason: 'up_to_date';
      pollId: string;
      tenantId: string;
      chatId: string | null;
      existingMessageId: string | null;
    }
  | {
      status: 'requireInbox';
      tenantId: string;
      chatId: string | null;
      pollId: string;
      existingMessageId: string | null;
      lookupError?: unknown;
    };

export const schedulePollInboxFallback = async (
  params: {
    tenantId: string | null;
    poll: PollChoiceEventPayload & { selectedOptions: PollChoiceSelectedOptionPayload[] };
    identifiers: string[];
    selectedOptions: PollChoiceSelectedOptionPayload[];
  },
  deps: SchedulePollInboxFallbackDeps = {}
): Promise<SchedulePollInboxFallbackResult> => {
  const chatId = normalizeChatId(params.poll.voterJid);
  const tenantId = toTrimmedString(params.tenantId);
  if (!tenantId) {
    return { status: 'missingTenant', pollId: params.poll.pollId, tenantId: null, chatId };
  }
  const lookup = deps.findPollVoteMessageCandidate ?? findPollVoteMessageCandidate;

  let existingMessage: Awaited<ReturnType<typeof lookup>> | null = null;
  let lookupError: unknown;

  try {
    existingMessage = await lookup({
      tenantId,
      pollId: params.poll.pollId,
      chatId,
      identifiers: params.identifiers,
    });
  } catch (error) {
    lookupError = error;
  }

  const matches = pollMessageMetadataMatchesSelections(existingMessage, params.selectedOptions);

  if (existingMessage && matches) {
    return {
      status: 'skip',
      reason: 'up_to_date',
      pollId: params.poll.pollId,
      tenantId,
      chatId,
      existingMessageId: existingMessage.id ?? null,
    };
  }

  return {
    status: 'requireInbox',
    tenantId,
    chatId,
    pollId: params.poll.pollId,
    existingMessageId: existingMessage?.id ?? null,
    ...(lookupError ? { lookupError } : {}),
  };
};

export const __testing = {
  buildSelectedOptionSummaries,
  collectSelectionIdSetsFromMetadata,
  normalizeChatId,
  pollMessageMetadataMatchesSelections,
};
