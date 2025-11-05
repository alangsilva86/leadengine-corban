import { emitWhatsAppDebugPhase } from '../../../debug/services/whatsapp-debug-emitter';
import { pollChoiceEventBus } from '../../services/poll-choice-event-bus';
import { persistPollChoiceVote, rewritePollVoteMessage, schedulePollInboxFallback } from '../../services/poll-choice-pipeline';
import { syncPollChoiceState } from '../../services/poll-choice-sync-service';
import {
  PollChoiceInboxNotificationStatus,
  triggerPollChoiceInboxNotification,
} from '../../services/poll-choice-inbox-service';
import { getPollMetadata } from '../../services/poll-metadata-service';
import { PollChoiceEventSchema } from '../../schemas/poll-choice';
import { normalizeChatId } from '../../utils/poll-helpers';
import { buildIdempotencyKey, registerIdempotency } from '../../utils/webhook-idempotency';
import { asRecord, readNumber, readString } from '../../utils/webhook-parsers';
import { toRawPreview } from './helpers';
import {
  POLL_VOTE_RETRY_DELAY_MS,
  getUpdatePollVoteMessageHandler,
  schedulePollVoteRetryIfNeeded,
} from './poll-vote-message-rewriter';
import type { RawBaileysUpsertEvent } from '../../services/baileys-raw-normalizer';
import { logBaileysDebugEvent } from '../../utils/baileys-event-logger';

const cleanString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildFallbackOptionId = (candidates: Array<unknown>, index: number): string => {
  for (const candidate of candidates) {
    const asString = cleanString(candidate);
    if (asString) {
      return asString;
    }
  }
  return `option_${index}`;
};

const buildFallbackOptionTitle = (candidates: Array<unknown>, fallbackId: string): string | null => {
  for (const candidate of candidates) {
    const asString = cleanString(candidate);
    if (asString) {
      return asString;
    }
  }
  return cleanString(fallbackId);
};

const normalizePollChoiceEventPayload = (
  payload: Record<string, unknown>
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...payload };

  const pollId = cleanString(payload.pollId);
  const voterJid = cleanString(payload.voterJid);
  const messageId = cleanString(payload.messageId);
  const timestamp = cleanString(payload.timestamp);

  if (!cleanString(payload.id)) {
    const syntheticId =
      messageId ??
      (pollId && voterJid
        ? `${pollId}:${voterJid}${timestamp ? `:${timestamp}` : ''}`
        : null);
    if (syntheticId) {
      normalized.id = syntheticId;
    }
  }

  const rawSelectedOptions = Array.isArray(payload.selectedOptions)
    ? payload.selectedOptions
    : [];
  const normalizedSelectedOptions = rawSelectedOptions
    .map((entry, index) => {
      const optionRecord = asRecord(entry);
      const fallbackId = buildFallbackOptionId(
        [optionRecord?.id, optionRecord?.title, optionRecord?.text],
        index
      );
      const resolvedId = cleanString(optionRecord?.id) ?? fallbackId;
      const title = buildFallbackOptionTitle(
        [optionRecord?.title, optionRecord?.text, optionRecord?.id],
        resolvedId
      );
      return {
        ...optionRecord,
        id: resolvedId,
        title,
      };
    })
    .filter((entry) => cleanString(entry.id));

  if (normalizedSelectedOptions.length > 0) {
    normalized.selectedOptions = normalizedSelectedOptions;
  }

  const rawOptions = Array.isArray(payload.options) ? payload.options : [];
  const normalizedOptionsSource =
    rawOptions.length > 0 ? rawOptions : normalizedSelectedOptions;

  const normalizedOptions = normalizedOptionsSource.map((entry, index) => {
    const optionRecord = asRecord(entry);
    const fallbackId = buildFallbackOptionId(
      [optionRecord?.id, optionRecord?.title, optionRecord?.text],
      index
    );
    const resolvedId = cleanString(optionRecord?.id) ?? fallbackId;
    const title = buildFallbackOptionTitle(
      [optionRecord?.title, optionRecord?.text, optionRecord?.id],
      resolvedId
    );
    const normalizedIndex = readNumber(optionRecord?.index);
    const votesValue = readNumber(optionRecord?.votes);
    return {
      ...optionRecord,
      id: resolvedId,
      title,
      index: normalizedIndex !== null && normalizedIndex >= 0 ? normalizedIndex : index,
      votes: votesValue !== null && votesValue >= 0 ? votesValue : undefined,
    };
  });

  normalized.options = normalizedOptions;

  if (!Array.isArray(normalized.selectedOptionIds) && normalizedSelectedOptions.length > 0) {
    normalized.selectedOptionIds = normalizedSelectedOptions.map((entry) => entry.id);
  }

  const aggregatesRecord = asRecord(payload.aggregates);
  const optionTotalsRecord = asRecord(aggregatesRecord?.optionTotals);
  const optionTotals: Record<string, number> = {};

  if (optionTotalsRecord) {
    for (const [key, value] of Object.entries(optionTotalsRecord)) {
      const normalizedKey = cleanString(key);
      if (!normalizedKey) {
        continue;
      }
      const numericValue = readNumber(value);
      if (numericValue !== null && numericValue >= 0) {
        optionTotals[normalizedKey] = numericValue;
      }
    }
  }

  for (const option of normalizedSelectedOptions) {
    if (!optionTotals[option.id]) {
      optionTotals[option.id] = 1;
    }
  }

  const totalVotesCandidate = readNumber(aggregatesRecord?.totalVotes);
  const totalVotersCandidate = readNumber(aggregatesRecord?.totalVoters);

  normalized.aggregates = {
    totalVotes:
      totalVotesCandidate !== null && totalVotesCandidate >= 0
        ? totalVotesCandidate
        : normalizedSelectedOptions.length,
    totalVoters:
      totalVotersCandidate !== null && totalVotersCandidate >= 0
        ? totalVotersCandidate
        : normalizedSelectedOptions.length > 0
        ? 1
        : 0,
    optionTotals,
  };

  return normalized;
};

export const processPollChoiceEvent = async (
  eventRecord: RawBaileysUpsertEvent,
  envelopeRecord: Record<string, unknown>,
  context: {
    requestId: string;
    instanceId?: string | null;
    tenantOverride?: string | null;
  }
): Promise<{ persisted: number; ignored: number; failures: number }> => {
  const payloadRecord = asRecord((eventRecord as { payload?: unknown }).payload);
  const normalizedPayload = normalizePollChoiceEventPayload(payloadRecord);
  const validation = PollChoiceEventSchema.safeParse(normalizedPayload);
  const baseTenantId = context.tenantOverride ?? null;
  const baseInstanceId = context.instanceId ?? null;

  if (!validation.success) {
    pollChoiceEventBus.emit('pollChoiceInvalid', {
      requestId: context.requestId,
      reason: 'invalid_payload',
      issues: validation.error.issues,
      preview: toRawPreview(eventRecord),
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
    });
    pollChoiceEventBus.emit('pollChoiceCompleted', {
      requestId: context.requestId,
      pollId: null,
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
      outcome: 'ignored',
      reason: 'poll_choice_invalid',
    });
    return { persisted: 0, ignored: 1, failures: 0 };
  }

  const pollPayload = validation.data;

  const pollIdemKey = buildIdempotencyKey(
    baseTenantId,
    baseInstanceId,
    `${pollPayload.pollId}|${pollPayload.voterJid}`,
    0
  );
  if (!registerIdempotency(pollIdemKey)) {
    pollChoiceEventBus.emit('pollChoiceDuplicateEvent', {
      requestId: context.requestId,
      pollId: pollPayload.pollId,
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
    });
    pollChoiceEventBus.emit('pollChoiceCompleted', {
      requestId: context.requestId,
      pollId: pollPayload.pollId,
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
      outcome: 'ignored',
      reason: 'poll_choice_duplicate_event',
    });
    return { persisted: 0, ignored: 1, failures: 0 };
  }

  try {
    const persistence = await persistPollChoiceVote(pollPayload, {
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
    });

    if (persistence.status === 'duplicate') {
      pollChoiceEventBus.emit('pollChoiceDuplicateVote', {
        requestId: context.requestId,
        pollId: pollPayload.pollId,
        tenantId: baseTenantId,
        instanceId: baseInstanceId,
      });
      pollChoiceEventBus.emit('pollChoiceCompleted', {
        requestId: context.requestId,
        pollId: pollPayload.pollId,
        tenantId: baseTenantId,
        instanceId: baseInstanceId,
        outcome: 'ignored',
        reason: 'poll_choice_duplicate',
      });
      return { persisted: 0, ignored: 1, failures: 0 };
    }

    const messageIdentifiers =
      persistence.candidateMessageIds.length > 0 ? persistence.candidateMessageIds : [pollPayload.pollId];

    let rewriteResult = await rewritePollVoteMessage(
      {
        poll: persistence.poll,
        state: persistence.state,
        voterState: persistence.voterState,
        candidateMessageIds: messageIdentifiers,
        tenantContext: baseTenantId,
      },
      { updatePollVoteMessage: getUpdatePollVoteMessageHandler() }
    );

    if (rewriteResult.status === 'missingTenant') {
      let resolvedTenant: string | null = null;

      try {
        const metadata = readString(pollPayload.pollId) ? await getPollMetadata(pollPayload.pollId) : null;
        resolvedTenant = metadata?.tenantId ?? null;
      } catch (error) {
        pollChoiceEventBus.emit('pollChoiceTenantLookupFailed', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          error,
        });
      }

      if (resolvedTenant) {
        rewriteResult = await rewritePollVoteMessage(
          {
            poll: persistence.poll,
            state: persistence.state,
            voterState: persistence.voterState,
            candidateMessageIds: messageIdentifiers,
            tenantContext: resolvedTenant,
          },
          { updatePollVoteMessage: getUpdatePollVoteMessageHandler() }
        );
      } else {
        pollChoiceEventBus.emit('pollChoiceRewriteMissingTenant', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          voterJid: pollPayload.voterJid,
          candidates: messageIdentifiers,
          delayMs: POLL_VOTE_RETRY_DELAY_MS,
        });

        await schedulePollVoteRetryIfNeeded(
          pollPayload.pollId,
          pollPayload.voterJid,
          messageIdentifiers,
          async () => {
            const metadata = readString(pollPayload.pollId) ? await getPollMetadata(pollPayload.pollId) : null;
            return metadata?.tenantId ?? null;
          },
          async (tenantId) => {
            await rewritePollVoteMessage(
              {
                poll: persistence.poll,
                state: persistence.state,
                voterState: persistence.voterState,
                candidateMessageIds: messageIdentifiers,
                tenantContext: tenantId,
              },
              { updatePollVoteMessage: getUpdatePollVoteMessageHandler() }
            );
          }
        );

        pollChoiceEventBus.emit('pollChoiceRewriteRetryScheduled', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          voterJid: pollPayload.voterJid,
          delayMs: POLL_VOTE_RETRY_DELAY_MS,
        });
      }
    }

    emitWhatsAppDebugPhase({
      phase: 'webhook:poll_choice',
      correlationId: pollPayload.pollId,
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
      chatId: normalizeChatId(pollPayload.voterJid),
      tags: ['webhook', 'poll'],
      context: {
        requestId: context.requestId,
        source: 'webhook',
        pollId: pollPayload.pollId,
      },
      payload: {
        poll: persistence.poll,
        state: persistence.state,
      },
    });

    await logBaileysDebugEvent('whatsapp:poll_choice', {
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
      poll: persistence.poll,
      state: persistence.state,
      rawEvent: eventRecord,
      rawEnvelope: envelopeRecord,
    });

    let pollMetadataSynced = false;

    try {
      pollMetadataSynced = await syncPollChoiceState(pollPayload.pollId, {
        state: persistence.state,
      });
    } catch (error) {
      pollChoiceEventBus.emit('pollChoiceMetadataSyncFailed', {
        requestId: context.requestId,
        pollId: pollPayload.pollId,
        error,
      });
    }

    if (!pollMetadataSynced) {
      const decision = await schedulePollInboxFallback({
        tenantId: baseTenantId,
        poll: persistence.poll,
        identifiers: messageIdentifiers,
        selectedOptions: persistence.poll.selectedOptions,
      });

      pollChoiceEventBus.emit('pollChoiceInboxDecision', {
        requestId: context.requestId,
        decision,
      });

      if (decision.status === 'missingTenant') {
        pollChoiceEventBus.emit('pollChoiceInboxMissingTenant', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          voterJid: pollPayload.voterJid,
        });
        pollChoiceEventBus.emit('pollChoiceCompleted', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          tenantId: baseTenantId,
          instanceId: baseInstanceId,
          outcome: 'failed',
          reason: 'poll_choice_inbox_missing_tenant',
        });
        return { persisted: 0, ignored: 0, failures: 1 };
      }

      if (decision.status === 'skip') {
        pollChoiceEventBus.emit('pollChoiceCompleted', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          tenantId: baseTenantId,
          instanceId: baseInstanceId,
          outcome: 'accepted',
          reason: 'poll_choice',
        });
        return { persisted: 1, ignored: 0, failures: 0 };
      }

      try {
        const inboxResult = await triggerPollChoiceInboxNotification({
          poll: persistence.poll,
          state: persistence.state,
          selectedOptions: persistence.poll.selectedOptions,
          tenantId: decision.tenantId,
          instanceId: baseInstanceId,
          requestId: context.requestId,
        });

        if (inboxResult.status !== PollChoiceInboxNotificationStatus.Ok) {
          const inboxReason: Record<
            Exclude<PollChoiceInboxNotificationStatus, PollChoiceInboxNotificationStatus.Ok>,
            string
          > = {
            [PollChoiceInboxNotificationStatus.MissingTenant]: 'poll_choice_inbox_missing_tenant',
            [PollChoiceInboxNotificationStatus.InvalidChatId]: 'poll_choice_inbox_invalid_chat_id',
            [PollChoiceInboxNotificationStatus.IngestRejected]: 'poll_choice_inbox_ingest_rejected',
            [PollChoiceInboxNotificationStatus.IngestError]: 'poll_choice_inbox_ingest_error',
          };
          const reason = inboxReason[inboxResult.status];
          pollChoiceEventBus.emit('pollChoiceInboxFailed', {
            requestId: context.requestId,
            pollId: pollPayload.pollId,
            tenantId: decision.tenantId,
            reason,
          });
          pollChoiceEventBus.emit('pollChoiceCompleted', {
            requestId: context.requestId,
            pollId: pollPayload.pollId,
            tenantId: decision.tenantId,
            instanceId: baseInstanceId,
            outcome: 'failed',
            reason,
          });
          return { persisted: 0, ignored: 0, failures: 1 };
        }
      } catch (error) {
        pollChoiceEventBus.emit('pollChoiceInboxFailed', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          tenantId: decision.tenantId,
          reason: 'poll_choice_inbox_error',
          error,
        });
        pollChoiceEventBus.emit('pollChoiceCompleted', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          tenantId: decision.tenantId,
          instanceId: baseInstanceId,
          outcome: 'failed',
          reason: 'poll_choice_inbox_error',
        });
        return { persisted: 0, ignored: 0, failures: 1 };
      }
    }

    pollChoiceEventBus.emit('pollChoiceCompleted', {
      requestId: context.requestId,
      pollId: pollPayload.pollId,
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
      outcome: 'accepted',
      reason: 'poll_choice',
    });
    return { persisted: 1, ignored: 0, failures: 0 };
  } catch (error) {
    pollChoiceEventBus.emit('pollChoiceError', {
      requestId: context.requestId,
      pollId: pollPayload.pollId,
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
      error,
    });
    pollChoiceEventBus.emit('pollChoiceCompleted', {
      requestId: context.requestId,
      pollId: pollPayload.pollId,
      tenantId: baseTenantId,
      instanceId: baseInstanceId,
      outcome: 'failed',
      reason: 'poll_choice_error',
    });
    return { persisted: 0, ignored: 0, failures: 1 };
  }
};
