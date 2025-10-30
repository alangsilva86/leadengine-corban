import { logger } from '../../../config/logger';
import { sanitizeJsonPayload } from '../utils/baileys-event-logger';
import {
  asJsonRecord,
  buildPollVoteMessageContent,
  buildSelectedOptionSummaries,
  normalizeTimestamp,
  sanitizeOptionText,
  shouldUpdatePollMessageContent,
  POLL_PLACEHOLDER_MESSAGES,
} from '../utils/poll-helpers';
import { normalizeTextValue } from '@ticketz/shared';
import {
  findMessageByExternalId as storageFindMessageByExternalId,
  findPollVoteMessageCandidate,
  updateMessage as storageUpdateMessage,
} from '@ticketz/storage';
import { emitMessageUpdatedEvents } from '../../../services/ticket-service';
import type { PollChoiceSelectedOptionPayload } from '../schemas/poll-choice';

type StorageMessage = Awaited<ReturnType<typeof storageFindMessageByExternalId>>;
type CandidateMessage = Awaited<ReturnType<typeof findPollVoteMessageCandidate>>;

type MessageLike =
  | (StorageMessage extends Promise<infer Inner> ? Inner : StorageMessage)
  | (CandidateMessage extends Promise<infer Inner> ? Inner : CandidateMessage);

type PollVoteUpdateParams = {
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
};

type PollVoteUpdateDeps = {
  storageFindMessageByExternalId?: typeof storageFindMessageByExternalId;
  findPollVoteMessageCandidate?: typeof findPollVoteMessageCandidate;
  storageUpdateMessage?: typeof storageUpdateMessage;
  emitMessageUpdatedEvents?: typeof emitMessageUpdatedEvents;
};

export enum PollVoteUpdateState {
  MissingTenant = 'missingTenant',
  ResolvingCandidate = 'resolvingCandidate',
  CandidateResolved = 'candidateResolved',
  PreparingRewrite = 'preparingRewrite',
  ReadyToPersist = 'readyToPersist',
  Noop = 'noop',
  Persisting = 'persisting',
  Completed = 'completed',
  Failed = 'failed',
}

export type PollVoteUpdateResult =
  | { status: 'missingTenant'; state: PollVoteUpdateState; candidates: string[] }
  | { status: 'notFound'; state: PollVoteUpdateState; tenantId: string; candidates: string[] }
  | {
      status: 'noop';
      state: PollVoteUpdateState;
      tenantId: string;
      candidates: string[];
      storageMessageId: string;
    }
  | {
      status: 'updated';
      state: PollVoteUpdateState;
      tenantId: string;
      storageMessageId: string;
      messageId: string | null;
      candidates: string[];
      metadataChanged: boolean;
      contentUpdated: boolean;
      captionUpdated: boolean;
    }
  | {
      status: 'failed';
      state: PollVoteUpdateState;
      tenantId: string;
      candidates: string[];
      storageMessageId: string | null;
      error: unknown;
    };

const collectCandidateIdentifiers = (params: PollVoteUpdateParams): string[] => {
  const identifiers = new Set<string>();

  if (Array.isArray(params.messageIds)) {
    for (const entry of params.messageIds) {
      const normalized = normalizeTextValue(entry);
      if (normalized) {
        identifiers.add(normalized);
      }
    }
  }

  const primaryMessageId = normalizeTextValue(params.messageId);
  if (primaryMessageId) {
    identifiers.add(primaryMessageId);
  }

  const pollId = normalizeTextValue(params.pollId);
  if (pollId) {
    identifiers.add(pollId);
  }

  return Array.from(identifiers.values());
};

type CandidateResolution = {
  status: 'found';
  state: PollVoteUpdateState;
  tenantId: string;
  message: MessageLike;
  candidates: string[];
};

type CandidateResolutionMiss = {
  status: 'notFound';
  state: PollVoteUpdateState;
  tenantId: string;
  candidates: string[];
};

const resolveCandidateMessage = async (
  params: PollVoteUpdateParams,
  tenantId: string,
  candidates: string[],
  deps: Required<Pick<PollVoteUpdateDeps, 'storageFindMessageByExternalId' | 'findPollVoteMessageCandidate'>>
): Promise<CandidateResolution | CandidateResolutionMiss> => {
  let state: PollVoteUpdateState = PollVoteUpdateState.ResolvingCandidate;
  let existingMessage: MessageLike | null = null;

  for (const identifier of candidates) {
    try {
      existingMessage = await deps.storageFindMessageByExternalId(tenantId, identifier);
    } catch (error) {
      logger.warn('rewrite.poll_vote.lookup_external_id_failed', {
        tenantId,
        identifier,
        pollId: params.pollId,
        error,
      });
      continue;
    }

    if (existingMessage) {
      break;
    }
  }

  if (!existingMessage) {
    try {
      existingMessage = await deps.findPollVoteMessageCandidate({
        tenantId,
        chatId: normalizeTextValue(params.chatId),
        pollId: params.pollId,
        identifiers: candidates,
      });
    } catch (error) {
      logger.warn('rewrite.poll_vote.lookup_candidate_failed', {
        tenantId,
        chatId: normalizeTextValue(params.chatId) ?? null,
        pollId: params.pollId,
        identifiers: candidates,
        error,
      });
      return {
        status: 'notFound',
        state,
        tenantId,
        candidates,
      };
    }
  }

  if (!existingMessage) {
    logger.debug('rewrite.poll_vote.not_found', {
      tenantId,
      chatId: normalizeTextValue(params.chatId) ?? null,
      pollId: params.pollId,
      voterJid: params.voterJid,
      identifiersTried: candidates,
    });
    return {
      status: 'notFound',
      state,
      tenantId,
      candidates,
    };
  }

  logger.info('rewrite.poll_vote.matched', {
    tenantId,
    chatId: normalizeTextValue(params.chatId) ?? null,
    pollId: params.pollId,
    storageMessageId: (existingMessage as { id?: unknown })?.id ?? null,
    externalId: normalizeTextValue((existingMessage as { externalId?: unknown })?.externalId),
    identifiersTried: candidates,
  });

  state = PollVoteUpdateState.CandidateResolved;

  return {
    status: 'found',
    state,
    tenantId,
    message: existingMessage,
    candidates,
  };
};

type RewritePreparation =
  | {
      status: 'noop';
      state: PollVoteUpdateState;
      tenantId: string;
      message: MessageLike;
      candidates: string[];
    }
  | {
      status: 'ready';
      state: PollVoteUpdateState;
      tenantId: string;
      message: MessageLike;
      candidates: string[];
      payload: Parameters<typeof storageUpdateMessage>[2];
      metadataChanged: boolean;
      contentUpdated: boolean;
      captionUpdated: boolean;
    };

const preparePollVoteRewrite = (
  params: PollVoteUpdateParams,
  tenantId: string,
  resolution: CandidateResolution
): RewritePreparation => {
  const selectedSummaries = buildSelectedOptionSummaries(params.selectedOptions);
  const contentCandidate = buildPollVoteMessageContent(params.selectedOptions);

  if (!contentCandidate) {
    logger.debug('rewrite.poll_vote.skip_empty_content', {
      tenantId,
      storageMessageId: (resolution.message as { id?: unknown })?.id ?? null,
      pollId: params.pollId,
    });
    return {
      status: 'noop',
      state: PollVoteUpdateState.Noop,
      tenantId,
      message: resolution.message,
      candidates: resolution.candidates,
    };
  }

  const shouldUpdateContent = shouldUpdatePollMessageContent(
    (resolution.message as { content?: unknown })?.content
  );

  const existingCaption = sanitizeOptionText((resolution.message as { caption?: unknown })?.caption) ?? '';
  const shouldUpdateCaption =
    shouldUpdateContent && (existingCaption.length === 0 || POLL_PLACEHOLDER_MESSAGES.has(existingCaption));

  const metadataRecord = asJsonRecord((resolution.message as { metadata?: unknown })?.metadata);
  const voteTimestampIso = normalizeTimestamp(params.timestamp) ?? new Date().toISOString();
  const rewriteAppliedAt = new Date().toISOString();
  const pollVoteMetadata = {
    pollId: params.pollId,
    voterJid: params.voterJid,
    selectedOptions: selectedSummaries,
    updatedAt: voteTimestampIso,
    rewriteAppliedAt,
    aggregates: params.aggregates ?? undefined,
    options: params.options ?? undefined,
    vote: params.vote ?? undefined,
  };

  const existingPollVote = metadataRecord.pollVote as Record<string, unknown> | undefined;
  const metadataSnapshotBefore = sanitizeJsonPayload(metadataRecord);

  metadataRecord.pollVote = pollVoteMetadata;
  const existingPollMetadata = asJsonRecord(metadataRecord.poll);
  const existingPollQuestionValue =
    typeof existingPollMetadata?.question === 'string' && existingPollMetadata.question.trim().length > 0
      ? existingPollMetadata.question
      : null;
  const providedPollQuestion = sanitizeOptionText(params.question);
  const pollMetadataQuestion = existingPollQuestionValue ?? providedPollQuestion ?? undefined;
  metadataRecord.poll = {
    ...(existingPollMetadata ?? {}),
    id: existingPollMetadata?.id ?? params.pollId,
    pollId: params.pollId,
    ...(pollMetadataQuestion !== undefined ? { question: pollMetadataQuestion } : {}),
    selectedOptionIds: selectedSummaries.map((entry) => entry.id),
    selectedOptions: selectedSummaries,
    aggregates: params.aggregates ?? existingPollMetadata?.aggregates ?? undefined,
    updatedAt: pollVoteMetadata.updatedAt,
    rewriteAppliedAt,
  };

  const existingPollChoiceMetadata = asJsonRecord(metadataRecord.pollChoice);
  const existingPollChoiceQuestionValue =
    typeof existingPollChoiceMetadata?.question === 'string' && existingPollChoiceMetadata.question.trim().length > 0
      ? existingPollChoiceMetadata.question
      : null;
  const pollChoiceQuestion = existingPollChoiceQuestionValue ?? pollMetadataQuestion ?? undefined;

  metadataRecord.pollChoice = {
    ...(existingPollChoiceMetadata ?? {}),
    pollId: params.pollId,
    voterJid: params.voterJid,
    ...(pollChoiceQuestion !== undefined ? { question: pollChoiceQuestion } : {}),
    options: params.options ?? undefined,
    vote:
      params.vote ??
      ({
        optionIds: params.selectedOptions.map((entry) => entry.id),
        selectedOptions: params.selectedOptions,
        timestamp: normalizeTimestamp(params.timestamp),
      } as Record<string, unknown>),
  };

  const passthroughMetadata = asJsonRecord(metadataRecord.passthrough);
  if (passthroughMetadata) {
    if (passthroughMetadata.placeholder === true || passthroughMetadata.placeholder === 'true') {
      passthroughMetadata.placeholder = false;
    }
    metadataRecord.passthrough = passthroughMetadata;
  }

  if (metadataRecord.placeholder === true || metadataRecord.placeholder === 'true') {
    metadataRecord.placeholder = false;
  }

  const rewriteMetadataRecord = asJsonRecord(metadataRecord.rewrite);
  metadataRecord.rewrite = {
    ...(rewriteMetadataRecord ?? {}),
    pollVote: {
      ...(asJsonRecord(rewriteMetadataRecord?.pollVote) ?? {}),
      appliedAt: rewriteAppliedAt,
      pollId: params.pollId,
      storageMessageId: (resolution.message as { id?: unknown })?.id ?? null,
    },
  };

  const metadataSnapshotAfter = sanitizeJsonPayload(metadataRecord);
  const metadataForUpdate =
    metadataSnapshotAfter && typeof metadataSnapshotAfter === 'object' && !Array.isArray(metadataSnapshotAfter)
      ? (metadataSnapshotAfter as Record<string, unknown>)
      : null;
  const metadataChanged =
    JSON.stringify(metadataSnapshotBefore) !== JSON.stringify(metadataSnapshotAfter) ||
    JSON.stringify(existingPollVote) !== JSON.stringify(metadataRecord.pollVote);

  if (!shouldUpdateContent && !metadataChanged && !shouldUpdateCaption) {
    logger.info('rewrite.poll_vote.noop', {
      tenantId,
      storageMessageId: (resolution.message as { id?: unknown })?.id ?? null,
      pollId: params.pollId,
      selectedOptions: selectedSummaries,
    });
    return {
      status: 'noop',
      state: PollVoteUpdateState.Noop,
      tenantId,
      message: resolution.message,
      candidates: resolution.candidates,
    };
  }

  const shouldUpdateType =
    typeof (resolution.message as { type?: unknown })?.type === 'string' &&
    ((resolution.message as { type?: unknown }).type as string).toUpperCase() !== 'TEXT';

  return {
    status: 'ready',
    state: PollVoteUpdateState.ReadyToPersist,
    tenantId,
    message: resolution.message,
    candidates: resolution.candidates,
    payload: {
      ...(shouldUpdateContent ? { content: contentCandidate, text: contentCandidate } : {}),
      ...(shouldUpdateCaption ? { caption: contentCandidate } : {}),
      ...(shouldUpdateType ? { type: 'TEXT' as const } : {}),
      ...(metadataChanged ? { metadata: metadataForUpdate } : {}),
    },
    metadataChanged,
    contentUpdated: shouldUpdateContent,
    captionUpdated: shouldUpdateCaption,
  };
};

type PersistenceDeps = Required<
  Pick<PollVoteUpdateDeps, 'storageUpdateMessage' | 'emitMessageUpdatedEvents'>
>;

type PersistenceResult = PollVoteUpdateResult;

const applyPollVoteUpdate = async (
  params: PollVoteUpdateParams,
  tenantId: string,
  preparation: Extract<RewritePreparation, { status: 'ready' }>,
  deps: PersistenceDeps
): Promise<PersistenceResult> => {
  const storageMessageId = (preparation.message as { id?: unknown })?.id;

  try {
    const updatedMessage = await deps.storageUpdateMessage(tenantId, storageMessageId, preparation.payload);

    if (
      updatedMessage &&
      typeof updatedMessage === 'object' &&
      'tenantId' in updatedMessage &&
      'ticketId' in updatedMessage
    ) {
      logger.info('rewrite.poll_vote.updated', {
        tenantId,
        chatId: normalizeTextValue(params.chatId) ?? null,
        messageId:
          normalizeTextValue((updatedMessage as { externalId?: unknown })?.externalId) ??
          storageMessageId,
        storageMessageId,
        pollId: params.pollId,
        selectedOptions: preparation.payload.metadata?.pollVote?.selectedOptions ?? null,
        captionTouched: preparation.captionUpdated,
        typeAdjusted: (preparation.payload as { type?: unknown })?.type === 'TEXT',
        updatedAt: (updatedMessage as { updatedAt?: unknown }).updatedAt ?? null,
      });
      const updatedRecord = updatedMessage as { tenantId: string; ticketId: string | null };
      if (updatedRecord.ticketId) {
        await deps.emitMessageUpdatedEvents(tenantId, updatedRecord.ticketId, updatedMessage, null);
        logger.info('rewrite.poll_vote.emit', {
          tenantId,
          ticketId: updatedRecord.ticketId,
          messageId:
            normalizeTextValue((updatedMessage as { externalId?: unknown })?.externalId) ??
            storageMessageId,
          storageMessageId,
          pollId: params.pollId,
          voteOptionCount: Array.isArray(params.selectedOptions) ? params.selectedOptions.length : 0,
        });
      }
    }

    return {
      status: 'updated',
      state: PollVoteUpdateState.Completed,
      tenantId,
      storageMessageId,
      messageId:
        normalizeTextValue((preparation.message as { externalId?: unknown })?.externalId) ??
        storageMessageId ??
        null,
      candidates: preparation.candidates,
      metadataChanged: preparation.metadataChanged,
      contentUpdated: preparation.contentUpdated,
      captionUpdated: preparation.captionUpdated,
    };
  } catch (error) {
    logger.warn('rewrite.poll_vote.persist_failed', {
      tenantId,
      storageMessageId,
      chatId: normalizeTextValue(params.chatId) ?? null,
      pollId: params.pollId,
      error,
    });

    return {
      status: 'failed',
      state: PollVoteUpdateState.Failed,
      tenantId,
      candidates: preparation.candidates,
      storageMessageId: storageMessageId ?? null,
      error,
    };
  }
};

export const updatePollVoteMessage = async (
  params: PollVoteUpdateParams,
  deps: PollVoteUpdateDeps = {}
): Promise<PollVoteUpdateResult> => {
  const tenantId = normalizeTextValue(params.tenantId);
  const candidates = collectCandidateIdentifiers(params);

  if (!tenantId) {
    logger.debug('rewrite.poll_vote.skip_missing_context', {
      pollId: params.pollId,
      voterJid: params.voterJid,
    });
    return { status: 'missingTenant', state: PollVoteUpdateState.MissingTenant, candidates };
  }

  const resolution = await resolveCandidateMessage(params, tenantId, candidates, {
    storageFindMessageByExternalId: deps.storageFindMessageByExternalId ?? storageFindMessageByExternalId,
    findPollVoteMessageCandidate: deps.findPollVoteMessageCandidate ?? findPollVoteMessageCandidate,
  });

  if (resolution.status === 'notFound') {
    return { ...resolution };
  }

  const preparation = preparePollVoteRewrite(params, tenantId, resolution);
  if (preparation.status === 'noop') {
    return {
      status: 'noop',
      state: preparation.state,
      tenantId,
      candidates: preparation.candidates,
      storageMessageId: (preparation.message as { id?: string })?.id ?? null,
    };
  }

  return applyPollVoteUpdate(params, tenantId, preparation, {
    storageUpdateMessage: deps.storageUpdateMessage ?? storageUpdateMessage,
    emitMessageUpdatedEvents: deps.emitMessageUpdatedEvents ?? emitMessageUpdatedEvents,
  });
};

export const __testing = {
  collectCandidateIdentifiers,
  resolveCandidateMessage,
  preparePollVoteRewrite,
  applyPollVoteUpdate,
  buildPollVoteMessageContent,
  buildSelectedOptionSummaries,
  PollVoteUpdateState,
};
