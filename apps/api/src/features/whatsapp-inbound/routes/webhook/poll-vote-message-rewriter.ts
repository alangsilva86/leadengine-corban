import { logger } from '../../../../config/logger';
import {
  findMessageByExternalId as storageFindMessageByExternalId,
  findPollVoteMessageCandidate,
  updateMessage as storageUpdateMessage,
} from '@ticketz/storage';

import { emitMessageUpdatedEvents } from '../../../../services/ticket-service';
import { sanitizeJsonPayload } from '../../utils/baileys-event-logger';
import {
  asJsonRecord,
  buildPollVoteMessageContent,
  buildSelectedOptionSummaries,
  normalizeTimestamp,
  shouldUpdatePollMessageContent,
  POLL_PLACEHOLDER_MESSAGES,
} from '../../utils/poll-helpers';
import { readNumber, readString } from '../../utils/webhook-parsers';
import type { PollChoiceSelectedOptionPayload } from '../../schemas/poll-choice';
import {
  updatePollVoteMessage as pollVoteMessageUpdater,
  __testing as pollVoteUpdaterTesting,
} from '../../services/poll-vote-updater';

type UpdatePollVoteMessageHandler = typeof pollVoteMessageUpdater;

type PollVoteRewriteParams = {
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

export const POLL_VOTE_RETRY_DELAY_MS = 500;

let updatePollVoteMessageHandler: UpdatePollVoteMessageHandler = pollVoteMessageUpdater;

type SchedulePollVoteRetryHandler = (callback: () => void | Promise<void>, delayMs: number) => void;

const defaultPollVoteRetryScheduler: SchedulePollVoteRetryHandler = (callback, delayMs) => {
  const timer = setTimeout(() => {
    try {
      void callback();
    } catch (error) {
      logger.error('rewrite.poll_vote.retry_callback_failed', { error });
    }
  }, delayMs);

  if (typeof timer === 'object' && typeof (timer as NodeJS.Timeout).unref === 'function') {
    timer.unref();
  }
};

let schedulePollVoteRetry: SchedulePollVoteRetryHandler = defaultPollVoteRetryScheduler;

export const updatePollVoteMessage = async (params: PollVoteRewriteParams): Promise<void> => {
  const tenantId = readString(params.tenantId);
  if (!tenantId) {
    logger.debug('rewrite.poll_vote.skip_missing_context', {
      pollId: params.pollId,
      voterJid: params.voterJid,
    });
    return;
  }

  const chatId = readString(params.chatId);
  const candidateSet = new Set<string>();

  if (Array.isArray(params.messageIds)) {
    params.messageIds.forEach((candidate) => {
      const normalized = readString(candidate);
      if (normalized) {
        candidateSet.add(normalized);
      }
    });
  }

  const primaryMessageId = readString(params.messageId);
  if (primaryMessageId) {
    candidateSet.add(primaryMessageId);
  }

  const candidateIdentifiers = Array.from(candidateSet.values());
  if (candidateIdentifiers.length === 0) {
    candidateIdentifiers.push(params.pollId);
  }

  logger.info('rewrite.poll_vote.start', {
    tenantId,
    chatId: chatId ?? null,
    pollId: params.pollId,
    voterJid: params.voterJid,
    identifiers: candidateIdentifiers,
  });

  let existingMessage:
    | Awaited<ReturnType<typeof storageFindMessageByExternalId>>
    | Awaited<ReturnType<typeof findPollVoteMessageCandidate>>
    | null = null;

  for (const identifier of candidateIdentifiers) {
    try {
      existingMessage = await storageFindMessageByExternalId(tenantId, identifier);
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
      existingMessage = await findPollVoteMessageCandidate({
        tenantId,
        chatId,
        identifiers: candidateIdentifiers,
        pollId: params.pollId,
      });
    } catch (error) {
      logger.warn('rewrite.poll_vote.lookup_candidate_failed', {
        tenantId,
        chatId: chatId ?? null,
        pollId: params.pollId,
        identifiers: candidateIdentifiers,
        error,
      });
      return;
    }
  }

  if (!existingMessage) {
    logger.debug('rewrite.poll_vote.not_found', {
      tenantId,
      chatId: chatId ?? null,
      pollId: params.pollId,
      voterJid: params.voterJid,
      identifiersTried: candidateIdentifiers,
    });
    return;
  }

  logger.info('rewrite.poll_vote.matched', {
    tenantId,
    chatId: chatId ?? null,
    pollId: params.pollId,
    storageMessageId: existingMessage.id,
    externalId: readString(existingMessage.externalId),
    identifiersTried: candidateIdentifiers,
  });

  const contentCandidate = buildPollVoteMessageContent(params.selectedOptions);
  if (!contentCandidate) {
    logger.debug('rewrite.poll_vote.skip_empty_content', {
      tenantId,
      storageMessageId: existingMessage.id,
      pollId: params.pollId,
    });
    return;
  }

  const shouldUpdateContent = shouldUpdatePollMessageContent(existingMessage.content);
  const existingCaption = typeof existingMessage.caption === 'string' ? existingMessage.caption.trim() : '';
  const shouldUpdateCaption =
    shouldUpdateContent && (existingCaption.length === 0 || POLL_PLACEHOLDER_MESSAGES.has(existingCaption));

  const metadataRecord = asJsonRecord(existingMessage.metadata);
  const selectedSummaries = buildSelectedOptionSummaries(params.selectedOptions);
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
  const providedPollQuestion = readString(params.question);
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
    vote: params.vote ?? {
      optionIds: params.selectedOptions.map((entry) => entry.id),
      selectedOptions: params.selectedOptions,
      timestamp: normalizeTimestamp(params.timestamp),
    },
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
      storageMessageId: existingMessage.id,
    },
  };

  const metadataSnapshotAfter = sanitizeJsonPayload(metadataRecord);
  const metadataForUpdate =
    metadataSnapshotAfter && typeof metadataSnapshotAfter === 'object' && !Array.isArray(metadataSnapshotAfter)
      ? (metadataSnapshotAfter as Record<string, unknown>)
      : null;
  const metadataChanged = JSON.stringify(metadataSnapshotBefore) !== JSON.stringify(metadataSnapshotAfter);

  if (!shouldUpdateContent && !metadataChanged && !shouldUpdateCaption) {
    logger.info('rewrite.poll_vote.noop', {
      tenantId,
      storageMessageId: existingMessage.id,
      pollId: params.pollId,
      selectedOptions: selectedSummaries,
    });
    return;
  }

  const shouldUpdateType = typeof existingMessage.type === 'string' && existingMessage.type.toUpperCase() !== 'TEXT';

  try {
    const updatedMessage = await storageUpdateMessage(tenantId, existingMessage.id, {
      ...(shouldUpdateContent ? { content: contentCandidate, text: contentCandidate } : {}),
      ...(shouldUpdateCaption ? { caption: contentCandidate } : {}),
      ...(shouldUpdateType ? { type: 'TEXT' as const } : {}),
      ...(metadataChanged ? { metadata: metadataForUpdate } : {}),
    });

    if (updatedMessage && typeof updatedMessage === 'object' && 'tenantId' in updatedMessage && 'ticketId' in updatedMessage) {
      logger.info('rewrite.poll_vote.updated', {
        tenantId,
        chatId: chatId ?? null,
        messageId: readString(updatedMessage.externalId) ?? existingMessage.id,
        storageMessageId: existingMessage.id,
        pollId: params.pollId,
        selectedOptions: selectedSummaries,
        captionTouched: shouldUpdateCaption,
        typeAdjusted: shouldUpdateType,
        updatedAt: (updatedMessage as { updatedAt?: unknown }).updatedAt ?? null,
      });
      const updatedRecord = updatedMessage as { tenantId: string; ticketId: string | null };
      if (updatedRecord.ticketId) {
        await emitMessageUpdatedEvents(tenantId, updatedRecord.ticketId, updatedMessage, null);
        logger.info('rewrite.poll_vote.emit', {
          tenantId,
          ticketId: updatedRecord.ticketId,
          messageId: readString(updatedMessage.externalId) ?? existingMessage.id,
          storageMessageId: existingMessage.id,
          pollId: params.pollId,
          voteOptionCount: selectedSummaries.length,
        });
      }
    }
  } catch (error) {
    logger.warn('rewrite.poll_vote.persist_failed', {
      tenantId,
      storageMessageId: existingMessage.id,
      chatId: chatId ?? null,
      pollId: params.pollId,
      error,
    });
  }
};

export const setUpdatePollVoteMessageTestingHandler = (handler: UpdatePollVoteMessageHandler) => {
  updatePollVoteMessageHandler = handler;
};

export const resetUpdatePollVoteMessageTestingHandler = () => {
  updatePollVoteMessageHandler = pollVoteMessageUpdater;
};

export const setPollVoteRetryTestingScheduler = (handler: SchedulePollVoteRetryHandler) => {
  schedulePollVoteRetry = handler;
};

export const resetPollVoteRetryTestingScheduler = () => {
  schedulePollVoteRetry = defaultPollVoteRetryScheduler;
};

export const schedulePollVoteRetryIfNeeded = async (
  pollId: string,
  voterJid: string,
  candidateMessageIds: string[],
  resolveTenant: () => Promise<string | null>,
  rewrite: (tenantId: string) => Promise<void>
) => {
  schedulePollVoteRetry(async () => {
    try {
      const retryTenantId = await resolveTenant();
      if (!retryTenantId) {
        logger.warn('Skipping poll vote message retry due to missing tenant metadata', {
          pollId,
          voterJid,
          messageId: candidateMessageIds.at(0) ?? pollId ?? null,
        });
        return;
      }

      await rewrite(retryTenantId);
    } catch (error) {
      logger.error('Failed to retry poll vote message update after missing tenant', {
        pollId,
        voterJid,
        messageId: candidateMessageIds.at(0) ?? pollId ?? null,
        error,
      });
    }
  }, POLL_VOTE_RETRY_DELAY_MS);
};

export const pollVoteTesting = {
  pollVoteUpdaterTesting,
  buildPollVoteMessageContent: pollVoteUpdaterTesting.buildPollVoteMessageContent,
  updatePollVoteMessage: pollVoteMessageUpdater,
  setUpdatePollVoteMessageHandler: setUpdatePollVoteMessageTestingHandler,
  resetUpdatePollVoteMessageHandler: resetUpdatePollVoteMessageTestingHandler,
  setPollVoteRetryScheduler: setPollVoteRetryTestingScheduler,
  resetPollVoteRetryScheduler: resetPollVoteRetryTestingScheduler,
};

export type { SchedulePollVoteRetryHandler, UpdatePollVoteMessageHandler };
export const getUpdatePollVoteMessageHandler = (): UpdatePollVoteMessageHandler => updatePollVoteMessageHandler;

export const getPollVoteRetryScheduler = (): SchedulePollVoteRetryHandler => schedulePollVoteRetry;
