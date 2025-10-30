import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID, createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { ZodIssue } from 'zod';

import { asyncHandler } from '../../../middleware/error-handler';
import { logger } from '../../../config/logger';
import {
  getDefaultInstanceId,
  getDefaultTenantId,
  getWebhookApiKey,
  getWebhookSignatureSecret,
  getWebhookVerifyToken,
  isWebhookSignatureRequired,
} from '../../../config/whatsapp';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import {
  applyBrokerAck,
  findMessageByExternalId as storageFindMessageByExternalId,
  findPollVoteMessageCandidate,
  updateMessage as storageUpdateMessage,
} from '@ticketz/storage';
import {
  normalizeUpsertEvent,
  type NormalizedRawUpsertMessage,
  type RawBaileysUpsertEvent,
} from '../services/baileys-raw-normalizer';
import { enqueueInboundWebhookJob } from '../services/inbound-queue';
import { logBaileysDebugEvent, sanitizeJsonPayload } from '../utils/baileys-event-logger';
import { prisma } from '../../../lib/prisma';
import { emitWhatsAppDebugPhase } from '../../debug/services/whatsapp-debug-emitter';
import { emitMessageUpdatedEvents } from '../../../services/ticket-service';
import { normalizeBaileysMessageStatus } from '../services/baileys-status-normalizer';
import {
  BrokerInboundEventSchema,
  type BrokerInboundContact,
  type BrokerInboundEvent,
} from '../schemas/broker-contracts';
import { PollChoiceEventSchema, type PollChoiceSelectedOptionPayload } from '../schemas/poll-choice';
import {
  persistPollChoiceVote,
  rewritePollVoteMessage,
  schedulePollInboxFallback,
  validatePollChoicePayload,
  type PersistPollChoiceVoteResult,
  type SchedulePollInboxFallbackResult,
} from '../services/poll-choice-pipeline';
import { recordPollChoiceVote, recordEncryptedPollVote } from '../services/poll-choice-service';
import { syncPollChoiceState } from '../services/poll-choice-sync-service';
import {
  PollChoiceInboxNotificationStatus,
  triggerPollChoiceInboxNotification,
} from '../services/poll-choice-inbox-service';
import {
  getPollMetadata,
  upsertPollMetadata,
  type PollMetadataOption,
} from '../services/poll-metadata-service';

const webhookRouter: Router = Router();
const integrationWebhookRouter: Router = Router();

const MAX_RAW_PREVIEW_LENGTH = 2_000;
const DEFAULT_VERIFY_RESPONSE = 'LeadEngine WhatsApp webhook';
/**
 * Simple in-process TTL cache for idempotency of inbound messages.
 * Key: tenantId|instanceId|messageId|index
 */
const IDEMPOTENCY_TTL_MS = 60_000;
const recentIdempotencyKeys = new Map<string, number>();
const sweepIdempotency = () => {
  const now = Date.now();
  for (const [k, expiresAt] of recentIdempotencyKeys.entries()) {
    if (expiresAt <= now) recentIdempotencyKeys.delete(k);
  }
};
const registerIdempotency = (key: string): boolean => {
  sweepIdempotency();
  if (recentIdempotencyKeys.has(key)) return false;
  recentIdempotencyKeys.set(key, Date.now() + IDEMPOTENCY_TTL_MS);
  return true;
};
const buildIdempotencyKey = (
  tenantId: string | null | undefined,
  instanceId: string | null | undefined,
  messageId: string | null | undefined,
  index: number | null | undefined
) => {
  const raw = `${tenantId ?? 'unknown'}|${instanceId ?? 'unknown'}|${messageId ?? 'unknown'}|${index ?? 0}`;
  try {
    return createHash('sha256').update(raw).digest('hex');
  } catch {
    return raw;
  }
};

// Ack monotonicity helpers
const ACK_RANK: Record<string, number> = { SENT: 1, DELIVERED: 2, READ: 3 };
const ackRank = (status: string | null | undefined): number => {
  if (!status) return 0;
  const key = status.toString().toUpperCase();
  return ACK_RANK[key] ?? 0;
};
const asArray = (value: unknown): unknown[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.events)) {
      return record.events;
    }
    return [record];
  }
  return [];
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const unwrapWebhookEvent = (
  entry: unknown
): { event: RawBaileysUpsertEvent; envelope: Record<string, unknown> } | null => {
  const envelope = asRecord(entry);
  if (!envelope) {
    return null;
  }

  const bodyRecord = asRecord(envelope.body);
  if (!bodyRecord) {
    return { event: envelope as RawBaileysUpsertEvent, envelope };
  }

  const merged: Record<string, unknown> = { ...bodyRecord };

  for (const [key, value] of Object.entries(envelope)) {
    if (key === 'body') {
      continue;
    }
    if (!(key in merged)) {
      merged[key] = value;
    }
  }

  return { event: merged as RawBaileysUpsertEvent, envelope };
};

const readString = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

const readNumber = (...candidates: unknown[]): number | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) {
        continue;
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const normalizeApiKey = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const bearerMatch = /^bearer\s+(.+)$/i.exec(value);
  const normalized = (bearerMatch?.[1] ?? value).trim();

  return normalized.length > 0 ? normalized : null;
};

type WhatsAppWebhookContext = {
  requestId: string;
  remoteIp: string | null;
  userAgent: string | null;
  signatureRequired: boolean;
};

type WebhookResponseLocals = Record<string, unknown> & {
  whatsappWebhook?: WhatsAppWebhookContext;
};

const ensureWebhookContext = (req: Request, res: Response): WhatsAppWebhookContext => {
  const locals = res.locals as WebhookResponseLocals;
  if (locals.whatsappWebhook) {
    return locals.whatsappWebhook;
  }

  const requestId =
    readString(req.rid, req.header('x-request-id'), req.header('x-correlation-id')) ?? randomUUID();
  const remoteIp = readString(
    req.header('x-real-ip'),
    req.header('x-forwarded-for'),
    req.ip,
    req.socket.remoteAddress ?? null
  );
  const userAgent = readString(req.header('user-agent'), req.header('x-user-agent'));

  const context: WhatsAppWebhookContext = {
    requestId,
    remoteIp,
    userAgent,
    signatureRequired: isWebhookSignatureRequired(),
  };

  locals.whatsappWebhook = context;
  return context;
};

const logWebhookEvent = (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: WhatsAppWebhookContext,
  extra?: Record<string, unknown>
) => {
  logger[level](message, {
    requestId: context.requestId,
    remoteIp: context.remoteIp ?? 'unknown',
    userAgent: context.userAgent ?? 'unknown',
    ...extra,
  });
};

const trackWebhookRejection = (reason: 'invalid_api_key' | 'invalid_signature' | 'rate_limited') => {
  whatsappWebhookEventsCounter.inc({
    origin: 'webhook',
    tenantId: 'unknown',
    instanceId: 'unknown',
    result: 'rejected',
    reason,
  });
};

const POLL_PLACEHOLDER_MESSAGES = new Set(['[Mensagem recebida via WhatsApp]', '[Mensagem]']);
const POLL_VOTE_RETRY_DELAY_MS = 500;

type PollChoiceEventOutcome = 'accepted' | 'ignored' | 'failed';

type PollChoiceEventBusPayloads = {
  pollChoiceInvalid: {
    requestId: string;
    reason: 'missing_payload' | 'schema_error';
    issues?: ZodIssue[];
    preview: string | null;
    tenantId: string | null;
    instanceId: string | null;
  };
  pollChoiceDuplicateEvent: {
    requestId: string;
    pollId: string;
    tenantId: string | null;
    instanceId: string | null;
  };
  pollChoiceDuplicateVote: {
    requestId: string;
    pollId: string;
    tenantId: string | null;
    instanceId: string | null;
  };
  pollChoiceRewriteMissingTenant: {
    requestId: string;
    pollId: string;
    voterJid: string;
    candidates: string[];
    delayMs: number;
  };
  pollChoiceRewriteRetryScheduled: {
    requestId: string;
    pollId: string;
    voterJid: string;
    delayMs: number;
  };
  pollChoiceTenantLookupFailed: {
    requestId: string;
    pollId: string;
    error: unknown;
  };
  pollChoiceMetadataSyncFailed: {
    requestId: string;
    pollId: string;
    error: unknown;
  };
  pollChoiceInboxMissingTenant: {
    requestId: string;
    pollId: string;
    voterJid: string;
  };
  pollChoiceInboxDecision: {
    requestId: string;
    decision: SchedulePollInboxFallbackResult;
  };
  pollChoiceInboxFailed: {
    requestId: string;
    pollId: string;
    tenantId: string;
    reason: string;
    error?: unknown;
  };
  pollChoiceError: {
    requestId: string;
    pollId: string;
    tenantId: string | null;
    instanceId: string | null;
    error: unknown;
  };
  pollChoiceCompleted: {
    requestId: string;
    pollId: string | null;
    tenantId: string | null;
    instanceId: string | null;
    outcome: PollChoiceEventOutcome;
    reason: string;
    extra?: Record<string, unknown>;
  };
};

type PollChoiceEventName = keyof PollChoiceEventBusPayloads;

type PollChoiceEventBus = {
  emit: <E extends PollChoiceEventName>(event: E, payload: PollChoiceEventBusPayloads[E]) => void;
  on: <E extends PollChoiceEventName>(
    event: E,
    handler: (payload: PollChoiceEventBusPayloads[E]) => void
  ) => () => void;
};

const createPollChoiceEventBus = (): PollChoiceEventBus => {
  const registry = new Map<PollChoiceEventName, Set<(payload: PollChoiceEventBusPayloads[PollChoiceEventName]) => void>>();

  return {
    emit(event, payload) {
      const handlers = registry.get(event);
      if (!handlers) {
        return;
      }

      for (const handler of handlers) {
        try {
          handler(payload as never);
        } catch (error) {
          logger.error('pollChoiceEventHandlerFailed', { event, error });
        }
      }
    },
    on(event, handler) {
      const existing = registry.get(event) ?? new Set();
      existing.add(handler as never);
      registry.set(event, existing as never);

      return () => {
        const handlers = registry.get(event);
        if (!handlers) {
          return;
        }
        handlers.delete(handler as never);
        if (handlers.size === 0) {
          registry.delete(event);
        }
      };
    },
  };
};

const pollChoiceEventBus = createPollChoiceEventBus();

pollChoiceEventBus.on('pollChoiceInvalid', ({ reason, requestId, issues, preview }) => {
  const message =
    reason === 'missing_payload'
      ? 'Received poll choice event without payload'
      : 'Received invalid poll choice payload';

  logger.warn(message, {
    requestId,
    ...(reason === 'schema_error' ? { issues } : {}),
    rawPreview: preview,
  });
});

pollChoiceEventBus.on('pollChoiceDuplicateEvent', ({ pollId, requestId }) => {
  logger.debug('Duplicate poll choice event ignored', { requestId, pollId });
});

pollChoiceEventBus.on('pollChoiceDuplicateVote', ({ pollId, requestId }) => {
  logger.info('Ignoring poll choice vote because it is already up-to-date', {
    requestId,
    pollId,
  });
});

pollChoiceEventBus.on(
  'pollChoiceRewriteMissingTenant',
  ({ requestId, pollId, voterJid, candidates, delayMs }) => {
    logger.info('rewrite.poll_vote.retry_missing_tenant', {
      requestId,
      pollId,
      voterJid,
      messageId: candidates.at(0) ?? null,
      delayMs,
    });
  }
);

pollChoiceEventBus.on('pollChoiceRewriteRetryScheduled', ({ requestId, pollId, voterJid, delayMs }) => {
  logger.info('rewrite.poll_vote.retry_scheduled', {
    requestId,
    pollId,
    voterJid,
    delayMs,
  });
});

pollChoiceEventBus.on('pollChoiceTenantLookupFailed', ({ requestId, pollId, error }) => {
  logger.warn('Failed to load poll metadata while resolving tenant', {
    requestId,
    pollId,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceMetadataSyncFailed', ({ requestId, pollId, error }) => {
  logger.error('Failed to sync poll choice state with message metadata', {
    requestId,
    pollId,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceInboxMissingTenant', ({ requestId, pollId, voterJid }) => {
  logger.warn('Skipping poll choice inbox notification due to missing tenant context', {
    requestId,
    pollId,
    voterJid,
  });
});

pollChoiceEventBus.on('pollChoiceInboxDecision', ({ decision, requestId }) => {
  if (decision.status === 'skip') {
    logger.info('Skipping poll choice inbox notification because poll message already exists', {
      requestId,
      pollId: decision.pollId,
      tenantId: decision.tenantId ?? null,
      chatId: decision.chatId ?? null,
      messageId: decision.existingMessageId,
    });
    return;
  }

  if (decision.status === 'requireInbox') {
    if (decision.lookupError) {
      logger.error('Failed to check existing poll message before inbox notification', {
        requestId,
        pollId: decision.pollId,
        tenantId: decision.tenantId,
        chatId: decision.chatId ?? null,
        error: decision.lookupError,
      });
    }

    if (decision.existingMessageId) {
      logger.info(
        'Triggering poll choice inbox notification fallback due to outdated poll message metadata',
        {
          requestId,
          pollId: decision.pollId,
          tenantId: decision.tenantId,
          chatId: decision.chatId ?? null,
          messageId: decision.existingMessageId,
        }
      );
    }
  }
});

pollChoiceEventBus.on('pollChoiceInboxFailed', ({ requestId, pollId, tenantId, reason, error }) => {
  const logMethod = reason === 'poll_choice_inbox_error' ? 'error' : 'warn';
  logger[logMethod]('Poll choice inbox notification failed', {
    requestId,
    pollId,
    tenantId,
    reason,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceError', ({ requestId, pollId, tenantId, instanceId, error }) => {
  logger.error('Failed to process poll choice event', {
    requestId,
    pollId,
    tenantId,
    instanceId,
    error,
  });
});

pollChoiceEventBus.on('pollChoiceCompleted', ({ tenantId, instanceId, outcome, reason }) => {
  whatsappWebhookEventsCounter.inc({
    origin: 'webhook',
    tenantId: tenantId ?? 'unknown',
    instanceId: instanceId ?? 'unknown',
    result: outcome,
    reason,
  });
});

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

const buildPollVoteMessageContent = (
  selectedOptions: PollChoiceSelectedOptionPayload[]
): string | null => {
  const summaries = buildSelectedOptionSummaries(selectedOptions);
  if (summaries.length === 0) {
    return null;
  }

  const uniqueTitles: string[] = [];
  const seenTitles = new Set<string>();

  for (const { title } of summaries) {
    const normalized = sanitizeOptionText(title);
    if (!normalized) {
      continue;
    }

    if (seenTitles.has(normalized)) {
      continue;
    }

    seenTitles.add(normalized);
    uniqueTitles.push(normalized);
  }

  if (uniqueTitles.length === 0) {
    return null;
  }

  if (uniqueTitles.length === 1) {
    return uniqueTitles.at(0) ?? null;
  }

  return uniqueTitles.join(', ');
};

const asJsonRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const shouldUpdatePollMessageContent = (content: unknown): boolean => {
  if (typeof content !== 'string') {
    return true;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return true;
  }

  return POLL_PLACEHOLDER_MESSAGES.has(trimmed);
};

const normalizeTimestamp = (value: string | null | undefined): string | null => {
  const trimmed = sanitizeOptionText(value);
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return trimmed;
};

const updatePollVoteMessage = async (params: {
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
}): Promise<void> => {
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
    shouldUpdateContent &&
    (existingCaption.length === 0 || POLL_PLACEHOLDER_MESSAGES.has(existingCaption));

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
  const existingPollMetadata = asRecord(metadataRecord.poll);
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

  const existingPollChoiceMetadata = asRecord(metadataRecord.pollChoice);
  const existingPollChoiceQuestionValue =
    typeof existingPollChoiceMetadata?.question === 'string' &&
    existingPollChoiceMetadata.question.trim().length > 0
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

  const passthroughMetadata = asRecord(metadataRecord.passthrough);
  if (passthroughMetadata) {
    if (passthroughMetadata.placeholder === true || passthroughMetadata.placeholder === 'true') {
      passthroughMetadata.placeholder = false;
    }
    metadataRecord.passthrough = passthroughMetadata;
  }

  if (metadataRecord.placeholder === true || metadataRecord.placeholder === 'true') {
    metadataRecord.placeholder = false;
  }

  const rewriteMetadataRecord = asRecord(metadataRecord.rewrite);
  metadataRecord.rewrite = {
    ...(rewriteMetadataRecord ?? {}),
    pollVote: {
      ...(asRecord(rewriteMetadataRecord?.pollVote) ?? {}),
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
  const metadataChanged =
    JSON.stringify(metadataSnapshotBefore) !== JSON.stringify(metadataSnapshotAfter);

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

    if (
      updatedMessage &&
      typeof updatedMessage === 'object' &&
      'tenantId' in updatedMessage &&
      'ticketId' in updatedMessage
    ) {
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

type UpdatePollVoteMessageHandler = typeof updatePollVoteMessage;

let updatePollVoteMessageHandler: UpdatePollVoteMessageHandler = updatePollVoteMessage;

type SchedulePollVoteRetryHandler = (
  callback: () => void | Promise<void>,
  delayMs: number
) => void;

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

const normalizeChatId = (value: unknown): string | null => {
  const text = readString(value);
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

const toRawPreview = (value: unknown): string => {
  try {
    const json = JSON.stringify(value);
    if (!json) {
      return '';
    }
    return json.length > MAX_RAW_PREVIEW_LENGTH ? json.slice(0, MAX_RAW_PREVIEW_LENGTH) : json;
  } catch (error) {
    const fallback = String(value);
    logger.debug('Failed to serialize raw Baileys payload; using fallback string', { error });
    return fallback.length > MAX_RAW_PREVIEW_LENGTH
      ? fallback.slice(0, MAX_RAW_PREVIEW_LENGTH)
      : fallback;
  }
};

const sanitizeMetadataValue = (value: unknown): unknown => {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return (value as Buffer).toString('base64');
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadataValue(entry));
  }

  if (typeof value === 'object') {
    const record: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) {
        continue;
      }
      record[key] = sanitizeMetadataValue(nested);
    }
    return record;
  }

  return value;
};

const parseTimestampToDate = (value: unknown): Date | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000);
  }

  if (typeof value === 'bigint') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }

  return null;
};

interface NormalizeContractEventOptions {
  requestId: string;
  instanceOverride?: string | null;
  tenantOverride?: string | null;
  brokerOverride?: string | null;
}

const normalizeContractEvent = (
  eventRecord: Record<string, unknown>,
  options: NormalizeContractEventOptions
): NormalizedRawUpsertMessage | null => {
  const hasType = readString((eventRecord as { type?: unknown }).type);
  const fallbackEvent = readString((eventRecord as { event?: unknown }).event);
  const recordWithType =
    !hasType && fallbackEvent
      ? ({ ...eventRecord, type: fallbackEvent } as Record<string, unknown>)
      : eventRecord;

  const payloadRecord = asRecord((recordWithType as { payload?: unknown }).payload);
  const envelopeInstanceId =
    readString(options.instanceOverride, (eventRecord as { instanceId?: unknown }).instanceId) ?? null;

  if (payloadRecord) {
    if (!readString((payloadRecord as { instanceId?: unknown }).instanceId) && envelopeInstanceId) {
      payloadRecord.instanceId = envelopeInstanceId;
    }
    (recordWithType as Record<string, unknown>).payload = payloadRecord;
  } else if (envelopeInstanceId) {
    (recordWithType as Record<string, unknown>).payload = {
      instanceId: envelopeInstanceId,
    };
  }

  const parsed = BrokerInboundEventSchema.safeParse(recordWithType);
  if (!parsed.success) {
    logger.warn('Received invalid broker WhatsApp contract event', {
      requestId: options.requestId,
      issues: parsed.error.issues,
      preview: toRawPreview(eventRecord),
    });
    return null;
  }

  const event = parsed.data as BrokerInboundEvent;
  const contactRecord = asRecord(event.payload.contact) ?? {};
  const messageRecord = asRecord(event.payload.message) ?? {};
  const metadataInput = asRecord(event.payload.metadata) ?? {};

  const sanitizedMetadata = sanitizeMetadataValue({
    ...metadataInput,
  }) as Record<string, unknown>;

  if (!asRecord(sanitizedMetadata.contact) && Object.keys(contactRecord).length > 0) {
    sanitizedMetadata.contact = contactRecord;
  }

  const metadataContactRecord = asRecord(sanitizedMetadata.contact);
  const metadataBrokerInput = asRecord(metadataInput.broker);
  const messageUpsertType =
    readString(
      (metadataBrokerInput as { messageType?: unknown })?.messageType,
      (asRecord(sanitizedMetadata.broker) as { messageType?: unknown } | null)?.messageType
    ) ?? null;
  const resolvedInstanceId =
    readString(
      options.instanceOverride,
      event.payload.instanceId,
      event.instanceId
    ) ?? event.payload.instanceId;

  const messageId =
    readString(
      (messageRecord as { id?: unknown }).id,
      (messageRecord as { key?: { id?: unknown } }).key?.id,
      (sanitizedMetadata as { messageId?: unknown }).messageId,
      event.id
    ) ?? event.id;

  const messageType =
    readString(
      (sanitizedMetadata as { messageType?: unknown }).messageType,
      (messageRecord as { type?: unknown }).type
    ) ?? 'contract';

  const isGroup = Boolean(
    (metadataContactRecord as { isGroup?: unknown })?.isGroup ??
      (sanitizedMetadata as { isGroup?: unknown }).isGroup ??
      false
  );

  const rawDirection =
    readString(event.payload.direction, event.type) ??
    (event.type === 'MESSAGE_OUTBOUND' ? 'OUTBOUND' : 'INBOUND');
  const direction = rawDirection.toLowerCase().includes('outbound') ? 'outbound' : 'inbound';

  const tenantCandidate = options.tenantOverride ?? event.tenantId ?? null;
  const sessionCandidate = event.sessionId ?? null;
  const brokerCandidate = options.brokerOverride ?? event.instanceId ?? null;

  const normalized: NormalizedRawUpsertMessage = {
    data: {
      direction,
      instanceId: resolvedInstanceId,
      timestamp: event.payload.timestamp,
      message: messageRecord,
      metadata: sanitizedMetadata,
      from: contactRecord as BrokerInboundContact,
    },
    messageIndex: 0,
    ...(tenantCandidate ? { tenantId: tenantCandidate } : {}),
    ...(sessionCandidate ? { sessionId: sessionCandidate } : {}),
    ...(brokerCandidate !== undefined ? { brokerId: brokerCandidate } : {}),
    messageId,
    messageType,
    messageUpsertType,
    isGroup,
  };

  return normalized;
};

interface ProcessNormalizedMessageOptions {
  normalized: NormalizedRawUpsertMessage;
  eventRecord: Record<string, unknown>;
  envelopeRecord: Record<string, unknown>;
  rawPreview: string;
  requestId: string;
  tenantOverride?: string | null;
  instanceOverride?: string | null;
}

const processNormalizedMessage = async (
  options: ProcessNormalizedMessageOptions
): Promise<boolean> => {
  const { normalized, eventRecord, envelopeRecord, rawPreview, requestId } = options;

  const tenantId =
    options.tenantOverride ??
    normalized.tenantId ??
    readString((eventRecord as { tenantId?: unknown }).tenantId, envelopeRecord.tenantId) ??
    getDefaultTenantId();

  const instanceId =
    readString(
      options.instanceOverride,
      normalized.data.instanceId,
      (eventRecord as { instanceId?: unknown }).instanceId,
      envelopeRecord.instanceId
    ) ?? getDefaultInstanceId();

  const metadataContactRecord = asRecord(normalized.data.metadata?.contact);
  const messageRecord = (normalized.data.message ?? {}) as Record<string, unknown>;
  const messageKeyRecord = asRecord(messageRecord.key);
  const fromRecord = asRecord(normalized.data.from);

  const chatIdCandidate =
    normalizeChatId(
      readString(metadataContactRecord?.remoteJid) ??
        readString(metadataContactRecord?.jid) ??
        readString(messageKeyRecord?.remoteJid) ??
        readString(fromRecord?.phone) ??
        readString(messageKeyRecord?.id)
    ) ?? normalizeChatId(readString(fromRecord?.phone));

  const chatId = chatIdCandidate ?? `${tenantId}@baileys`;

  try {
    const data = normalized.data;
    const metadataBase =
      data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
        ? { ...(data.metadata as Record<string, unknown>) }
        : ({} as Record<string, unknown>);
    const metadataContact = asRecord(metadataBase.contact);
    const messageKey = messageKeyRecord ?? {};
    const contactRecord = asRecord(data.from) ?? {};

    const remoteJid =
      normalizeChatId(
        readString(messageKey.remoteJid) ??
          readString(metadataContact?.jid) ??
          readString(metadataContact?.remoteJid) ??
          readString(
            (eventRecord as {
              payload?: { messages?: Array<{ key?: { remoteJid?: string } }> };
            })?.payload?.messages?.[normalized.messageIndex ?? 0]?.key?.remoteJid
          )
      ) ?? chatId;

    const direction =
      (data.direction ?? 'inbound').toString().toUpperCase() === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
    const externalId = readString(messageRecord.id, messageKey.id, normalized.messageId);
    const timestamp = readString(data.timestamp) ?? null;

    const pollCreationRecord = asRecord(messageRecord.pollCreationMessage);
    if (pollCreationRecord) {
      const metadataOptions = Array.isArray(pollCreationRecord.options)
        ? (pollCreationRecord.options as Array<Record<string, unknown>>)
            .map((entry, index) => {
              const optionId =
                readString(
                  entry.id,
                  (entry as { optionName?: unknown }).optionName,
                  (entry as { title?: unknown }).title
                ) ?? `option_${index}`;
              const title =
                readString(
                  (entry as { title?: unknown }).title,
                  (entry as { optionName?: unknown }).optionName,
                  (entry as { name?: unknown }).name,
                  (entry as { description?: unknown }).description
                ) ?? null;
              const normalizedOption: PollMetadataOption = {
                id: optionId,
                title,
                index: readNumber((entry as { index?: unknown }).index) ?? index,
              };
              const optionName = readString((entry as { optionName?: unknown }).optionName);
              if (optionName && optionName !== title) {
                normalizedOption.optionName = optionName;
              }
              const description = readString((entry as { description?: unknown }).description);
              if (description && description !== title) {
                normalizedOption.description = description;
              }
              return normalizedOption;
            })
            .filter(Boolean) as PollMetadataOption[]
        : [];

      const pollContext = asRecord(messageRecord.pollContextInfo);
      const creationKey = {
        remoteJid:
          readString(messageKey.remoteJid, metadataContact?.remoteJid, metadataContact?.jid) ??
          remoteJid ??
          null,
        participant:
          readString(messageKey.participant, metadataContact?.participant) ??
          null,
        fromMe: messageKey.fromMe === true,
      };

      try {
        await upsertPollMetadata({
          pollId: normalized.messageId,
          question:
            readString(messageRecord.text, pollCreationRecord.name, pollCreationRecord.title) ?? null,
          selectableOptionsCount: readNumber(pollCreationRecord.selectableOptionsCount),
          allowMultipleAnswers: pollCreationRecord.allowMultipleAnswers === true,
          options: metadataOptions,
          creationMessageId: normalized.messageId,
          creationMessageKey: creationKey,
          messageSecret: readString(pollContext?.messageSecret),
          messageSecretVersion: readNumber(pollContext?.messageSecretVersion),
          tenantId: tenantId ?? null,
          instanceId: instanceId ?? null,
        });
      } catch (metadataError) {
        logger.warn('Failed to persist poll metadata from webhook message', {
          requestId,
          pollId: normalized.messageId,
          tenantId,
          instanceId,
          error: metadataError,
        });
      }
    }

    const brokerMetadata =
      metadataBase.broker && typeof metadataBase.broker === 'object' && !Array.isArray(metadataBase.broker)
        ? { ...(metadataBase.broker as Record<string, unknown>) }
        : ({} as Record<string, unknown>);
    const pollUpdateRecord = asRecord(messageRecord.pollUpdateMessage);
    if (pollUpdateRecord) {
      const pollUpdateVote = asRecord(pollUpdateRecord.vote);
      const pollCreationKeyRecord = asRecord(pollUpdateRecord.pollCreationMessageKey);
      const pollIdFromUpdate =
        readString(
          pollUpdateRecord.pollCreationMessageId,
          pollCreationKeyRecord?.id
        ) ?? null;

      try {
        await recordEncryptedPollVote({
          pollId: pollIdFromUpdate ?? normalized.messageId,
          voterJid: remoteJid,
          messageId: externalId,
          encryptedVote: pollUpdateVote
            ? {
                encPayload: readString(pollUpdateVote.encPayload),
                encIv: readString(pollUpdateVote.encIv),
                ciphertext: readString(pollUpdateVote.ciphertext),
              }
            : null,
          timestamp,
        });
      } catch (encryptedVoteError) {
        logger.warn('Failed to persist encrypted poll vote details', {
          requestId,
          pollId: pollIdFromUpdate ?? normalized.messageId,
          voterJid: remoteJid,
          error: encryptedVoteError,
        });
      }
    }

    const existingBrokerMessageType = brokerMetadata.messageType;
    const messageUpsertType = normalized.messageUpsertType;
    if (messageUpsertType !== null) {
      brokerMetadata.messageType = messageUpsertType;
    } else if (brokerMetadata.messageType === undefined) {
      brokerMetadata.messageType = null;
    }

    if (normalized.messageType) {
      brokerMetadata.messageContentType =
        brokerMetadata.messageContentType ??
        (typeof existingBrokerMessageType === 'string' ? existingBrokerMessageType : undefined) ??
        normalized.messageType;
    }

    brokerMetadata.instanceId = brokerMetadata.instanceId ?? instanceId ?? null;
    brokerMetadata.sessionId = brokerMetadata.sessionId ?? normalized.sessionId ?? null;
    brokerMetadata.brokerId = brokerMetadata.brokerId ?? normalized.brokerId ?? null;
    brokerMetadata.origin = brokerMetadata.origin ?? 'webhook';

    const metadata: Record<string, unknown> = {
      ...metadataBase,
      source: metadataBase.source ?? 'baileys:webhook',
      direction,
      remoteJid: metadataBase.remoteJid ?? remoteJid,
      chatId: metadataBase.chatId ?? chatId,
      tenantId: metadataBase.tenantId ?? tenantId,
      instanceId: metadataBase.instanceId ?? instanceId ?? null,
      sessionId: metadataBase.sessionId ?? normalized.sessionId ?? null,
      normalizedIndex: normalized.messageIndex,
      raw: metadataBase.raw ?? rawPreview,
      broker: brokerMetadata,
    };

    emitWhatsAppDebugPhase({
      phase: 'webhook:normalized',
      correlationId: normalized.messageId ?? externalId ?? requestId ?? null,
      tenantId: tenantId ?? null,
      instanceId: instanceId ?? null,
      chatId,
      tags: ['webhook'],
      context: {
        requestId,
        normalizedIndex: normalized.messageIndex,
        direction,
        source: 'webhook',
      },
      payload: {
        contact: contactRecord,
        message: messageRecord,
        metadata,
      },
    });

    const metadataSource = readString(metadata.source);
    const debugSource =
      metadataSource && metadataSource.toLowerCase().includes('baileys')
        ? metadataSource
        : 'baileys:webhook';

    if (debugSource) {
      await logBaileysDebugEvent(debugSource, {
        tenantId: tenantId ?? null,
        instanceId: instanceId ?? null,
        chatId,
        messageId: normalized.messageId ?? externalId ?? null,
        direction,
        timestamp,
        metadata,
        contact: contactRecord,
        message: messageRecord,
        rawPayload: toRawPreview(eventRecord),
        rawEnvelope: toRawPreview(envelopeRecord),
        normalizedIndex: normalized.messageIndex,
      });
    }

    enqueueInboundWebhookJob({
      requestId,
      tenantId,
      instanceId,
      chatId,
      normalizedIndex: normalized.messageIndex ?? null,
      envelope: {
        origin: 'webhook',
        instanceId: instanceId ?? 'unknown-instance',
        chatId,
        tenantId,
        message: {
          kind: 'message',
          id: normalized.messageId ?? null,
          externalId,
          brokerMessageId: normalized.messageId,
          timestamp,
          direction,
          contact: contactRecord,
          payload: messageRecord,
          metadata,
        },
        raw: {
          event: eventRecord,
          normalizedIndex: normalized.messageIndex,
        },
      },
    });

    return true;
  } catch (error) {
    logger.error('Failed to persist inbound WhatsApp message', {
      requestId,
      tenantId,
      chatId,
      error,
    });
    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: tenantId ?? 'unknown',
      instanceId: instanceId ?? 'unknown',
      result: 'failed',
      reason: 'persist_error',
    });
    return false;
  }
};

type MessageLookupResult = {
  tenantId: string;
  messageId: string;
  ticketId: string;
  metadata: Record<string, unknown>;
  instanceId: string | null;
  externalId: string | null;
};

const findMessageForStatusUpdate = async ({
  tenantId,
  messageId,
  ticketId,
}: {
  tenantId?: string | null;
  messageId: string;
  ticketId?: string | null;
}): Promise<MessageLookupResult | null> => {
  const trimmedId = messageId.trim();
  if (!trimmedId) {
    return null;
  }

  if (tenantId) {
    const message = await storageFindMessageByExternalId(tenantId, trimmedId);
    if (message) {
      const metadataRecord =
        message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
          ? { ...(message.metadata as Record<string, unknown>) }
          : ({} as Record<string, unknown>);

      return {
        tenantId: message.tenantId,
        messageId: message.id,
        ticketId: message.ticketId,
        metadata: metadataRecord,
        instanceId: message.instanceId ?? null,
        externalId: message.externalId ?? null,
      };
    }
  }

  const where: Prisma.MessageWhereInput = {
    OR: [
      { externalId: trimmedId },
      { metadata: { path: ['broker', 'messageId'], equals: trimmedId } },
    ],
  };

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (ticketId) {
    where.ticketId = ticketId;
  }

  const fallback = await prisma.message.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      ticketId: true,
      metadata: true,
      instanceId: true,
      externalId: true,
    },
  });

  if (!fallback) {
    return null;
  }

  const metadataRecord =
    fallback.metadata && typeof fallback.metadata === 'object' && !Array.isArray(fallback.metadata)
      ? { ...(fallback.metadata as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  return {
    tenantId: fallback.tenantId,
    messageId: fallback.id,
    ticketId: fallback.ticketId,
    metadata: metadataRecord,
    instanceId: fallback.instanceId ?? null,
    externalId: fallback.externalId ?? null,
  };
};

const processMessagesUpdate = async (
  eventRecord: RawBaileysUpsertEvent,
  envelopeRecord: Record<string, unknown>,
  context: {
    requestId: string;
    instanceId?: string | null;
    tenantOverride?: string | null;
  }
): Promise<{ persisted: number; failures: number }> => {
  const payloadRecord = asRecord((eventRecord as { payload?: unknown }).payload);
  const rawRecord = asRecord(payloadRecord?.raw);
  const updates = Array.isArray(rawRecord?.updates) ? rawRecord.updates : [];

  if (!updates.length) {
    return { persisted: 0, failures: 0 };
  }

  const tenantCandidate =
    context.tenantOverride ??
    readString(
      (eventRecord as { tenantId?: unknown }).tenantId,
      payloadRecord?.tenantId,
      rawRecord?.tenantId,
      envelopeRecord.tenantId
    );

  const ticketCandidate = readString(
    payloadRecord?.ticketId,
    rawRecord?.ticketId,
    (payloadRecord?.ticket as { id?: unknown })?.id
  );

  let persisted = 0;
  let failures = 0;

  for (const entry of updates) {
    const updateRecord = asRecord(entry);
    if (!updateRecord) {
      continue;
    }

    const keyRecord = asRecord(updateRecord.key);
    const updateDetails = asRecord(updateRecord.update);
    const messageId = readString(
      updateDetails?.id,
      updateRecord.id,
      keyRecord?.id,
      (updateDetails as { key?: { id?: unknown } })?.key?.id
    );

    if (!messageId) {
      continue;
    }

    const fromMe = Boolean(keyRecord?.fromMe ?? updateRecord.fromMe);
    if (!fromMe) {
      continue;
    }

    // Idempotência para ACK por tenant|instance|messageId
    const ackIdemKey = buildIdempotencyKey(
      tenantCandidate ?? 'unknown',
      context.instanceId ?? null,
      messageId,
      0
    );
    if (!registerIdempotency(ackIdemKey)) {
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: tenantCandidate ?? 'unknown',
        instanceId: context.instanceId ?? 'unknown',
        result: 'ignored',
        reason: 'ack_duplicate',
      });
      continue;
    }

    const statusValue =
      updateDetails?.status ?? updateRecord.status ?? (updateDetails as { ack?: unknown })?.ack;
    const normalizedStatus = normalizeBaileysMessageStatus(statusValue);
    const numericStatus =
      typeof statusValue === 'number'
        ? statusValue
        : typeof statusValue === 'string'
        ? Number(statusValue)
        : undefined;

    const timestampCandidate =
      updateDetails?.messageTimestamp ?? updateDetails?.timestamp ?? updateRecord.timestamp;
    const ackTimestamp = parseTimestampToDate(timestampCandidate) ?? new Date();
    const participant = readString(updateDetails?.participant, updateRecord.participant);
    const remoteJid =
      normalizeChatId(
        keyRecord?.remoteJid ?? updateRecord.remoteJid ?? participant ?? updateDetails?.jid
      ) ?? null;

    let lookup: MessageLookupResult | null = null;

    try {
      lookup = await findMessageForStatusUpdate({
        tenantId: tenantCandidate,
        messageId,
        ticketId: readString(updateRecord.ticketId, ticketCandidate),
      });

      if (!lookup) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantCandidate ?? 'unknown',
          instanceId: context.instanceId ?? 'unknown',
          result: 'ignored',
          reason: 'ack_message_not_found',
        });
        logger.debug('WhatsApp status update ignored; message not found', {
          requestId: context.requestId,
          messageId,
          tenantId: tenantCandidate ?? 'unknown',
      });
      continue;
    }

    // Nunca regredir status e ignore ACKs muito atrasados
    try {
      const prevBroker = (lookup.metadata?.broker && typeof lookup.metadata.broker === 'object')
        ? (lookup.metadata.broker as Record<string, unknown>)
        : undefined;

      const prevStatusRaw =
        prevBroker && typeof prevBroker.lastAck === 'object'
          ? (prevBroker.lastAck as Record<string, unknown>).status
          : undefined;

      const prevStatus = normalizeBaileysMessageStatus(prevStatusRaw);
      const prevRank = ackRank(prevStatus);
      const newRank = ackRank(normalizedStatus);

      if (prevRank > 0 && newRank > 0 && newRank < prevRank) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: lookup.tenantId ?? 'unknown',
          instanceId: context.instanceId ?? lookup.instanceId ?? 'unknown',
          result: 'ignored',
          reason: 'ack_regression',
        });
        logger.debug('ACK regression ignored', {
          requestId: context.requestId,
          messageId,
          prevStatus,
          nextStatus: normalizedStatus,
        });
        continue;
      }

      const prevReceivedAtIso =
        prevBroker && typeof prevBroker.lastAck === 'object'
          ? (prevBroker.lastAck as Record<string, unknown>).receivedAt
          : undefined;

      if (typeof prevReceivedAtIso === 'string') {
        const prevTs = Date.parse(prevReceivedAtIso);
        const newTs = ackTimestamp.getTime();
        if (Number.isFinite(prevTs) && prevTs - newTs > 10 * 60 * 1000) {
          whatsappWebhookEventsCounter.inc({
            origin: 'webhook',
            tenantId: lookup.tenantId ?? 'unknown',
            instanceId: context.instanceId ?? lookup.instanceId ?? 'unknown',
            result: 'ignored',
            reason: 'ack_late',
          });
          logger.debug('ACK late arrival ignored', {
            requestId: context.requestId,
            messageId,
            prevReceivedAtIso,
            newAckAt: ackTimestamp.toISOString(),
          });
          continue;
        }
      }
    } catch {
      // Segurança: não travar fluxo caso a checagem falhe
    }

    const metadataRecord = lookup.metadata ?? {};
    const existingBroker =
      metadataRecord.broker && typeof metadataRecord.broker === 'object' && !Array.isArray(metadataRecord.broker)
        ? { ...(metadataRecord.broker as Record<string, unknown>) }
        : ({} as Record<string, unknown>);

    const brokerMetadata: Record<string, unknown> = {
      ...existingBroker,
      provider: 'whatsapp',
      status: normalizedStatus,
      messageId: existingBroker.messageId ?? lookup.externalId ?? messageId,
    };

    if (context.instanceId ?? lookup.instanceId ?? existingBroker.instanceId) {
      brokerMetadata.instanceId = context.instanceId ?? lookup.instanceId ?? existingBroker.instanceId;
    }

    if (remoteJid) {
      brokerMetadata.remoteJid = remoteJid;
    }

    const lastAck: Record<string, unknown> = {
      status: normalizedStatus,
      receivedAt: ackTimestamp.toISOString(),
      raw: sanitizeMetadataValue(updateRecord),
    };

    if (participant) {
      lastAck.participant = participant;
    }

    if (Number.isFinite(numericStatus)) {
      lastAck.numericStatus = Number(numericStatus);
    }

    brokerMetadata.lastAck = lastAck;

    const metadataUpdate: Record<string, unknown> = {
      broker: brokerMetadata,
    };

    const ackInput: Parameters<typeof applyBrokerAck>[2] = {
      status: normalizedStatus,
      metadata: metadataUpdate,
    };

    if (normalizedStatus === 'DELIVERED' || normalizedStatus === 'READ') {
      ackInput.deliveredAt = ackTimestamp;
    }

    if (normalizedStatus === 'READ') {
      ackInput.readAt = ackTimestamp;
    }

      const ackInstanceId = context.instanceId ?? lookup.instanceId;
      const metricsInstanceId = ackInstanceId ?? 'unknown';
      if (ackInstanceId !== undefined && ackInstanceId !== null) {
        ackInput.instanceId = ackInstanceId;
      }

      const updated = await applyBrokerAck(lookup.tenantId, lookup.messageId, ackInput);

      if (updated) {
        persisted += 1;
        await emitMessageUpdatedEvents(lookup.tenantId, updated.ticketId, updated, null);
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: lookup.tenantId ?? 'unknown',
          instanceId: metricsInstanceId,
          result: 'accepted',
          reason: 'ack_applied',
        });
      } else {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: lookup.tenantId ?? 'unknown',
          instanceId: metricsInstanceId,
          result: 'ignored',
          reason: 'ack_noop',
        });
      }
    } catch (error) {
      failures += 1;
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: lookup?.tenantId ?? tenantCandidate ?? 'unknown',
        instanceId: context.instanceId ?? lookup?.instanceId ?? 'unknown',
        result: 'failed',
        reason: 'ack_error',
      });
      logger.error('Failed to apply WhatsApp status update', {
        requestId: context.requestId,
        messageId,
        tenantId: lookup?.tenantId ?? tenantCandidate ?? 'unknown',
        error,
      });
    }
  }

  return { persisted, failures };
};

const processPollChoiceEvent = async (
  eventRecord: RawBaileysUpsertEvent,
  envelopeRecord: Record<string, unknown>,
  context: {
    requestId: string;
    instanceId?: string | null;
    tenantOverride?: string | null;
  }
): Promise<{ persisted: number; ignored: number; failures: number }> => {
  const payloadRecord = asRecord((eventRecord as { payload?: unknown }).payload);
  const validation = validatePollChoicePayload(payloadRecord);
  const baseTenantId = context.tenantOverride ?? null;
  const baseInstanceId = context.instanceId ?? null;

  if (validation.status !== 'valid') {
    pollChoiceEventBus.emit('pollChoiceInvalid', {
      requestId: context.requestId,
      reason: validation.reason,
      issues: validation.issues,
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

  const pollPayload = validation.payload;

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

    const messageIdentifiers = (
      persistence.candidateMessageIds.length > 0
        ? persistence.candidateMessageIds
        : [pollPayload.pollId]
    );

    let rewriteResult = await rewritePollVoteMessage(
      {
        poll: persistence.poll,
        state: persistence.state,
        voterState: persistence.voterState,
        candidateMessageIds: messageIdentifiers,
        tenantContext: baseTenantId,
      },
      { updatePollVoteMessage: updatePollVoteMessageHandler }
    );

    if (rewriteResult.status === 'missingTenant') {
      let resolvedTenant: string | null = null;

      try {
        const metadata = readString(pollPayload.pollId)
          ? await getPollMetadata(pollPayload.pollId)
          : null;
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
          { updatePollVoteMessage: updatePollVoteMessageHandler }
        );
      } else {
        pollChoiceEventBus.emit('pollChoiceRewriteMissingTenant', {
          requestId: context.requestId,
          pollId: pollPayload.pollId,
          voterJid: pollPayload.voterJid,
          candidates: messageIdentifiers,
          delayMs: POLL_VOTE_RETRY_DELAY_MS,
        });

        schedulePollVoteRetry(async () => {
          try {
            const metadata = readString(pollPayload.pollId)
              ? await getPollMetadata(pollPayload.pollId)
              : null;
            const retryTenantId = metadata?.tenantId ?? null;

            if (!retryTenantId) {
              logger.warn('Skipping poll vote message retry due to missing tenant metadata', {
                pollId: pollPayload.pollId,
                voterJid: pollPayload.voterJid,
                messageId: messageIdentifiers.at(0) ?? pollPayload.pollId ?? null,
              });
              return;
            }

            await rewritePollVoteMessage(
              {
                poll: persistence.poll,
                state: persistence.state,
                voterState: persistence.voterState,
                candidateMessageIds: messageIdentifiers,
                tenantContext: retryTenantId,
              },
              { updatePollVoteMessage: updatePollVoteMessageHandler }
            );
          } catch (error) {
            logger.error('Failed to retry poll vote message update after missing tenant', {
              pollId: pollPayload.pollId,
              voterJid: pollPayload.voterJid,
              messageId: messageIdentifiers.at(0) ?? pollPayload.pollId ?? null,
              error,
            });
          }
        }, POLL_VOTE_RETRY_DELAY_MS);

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

const WEBHOOK_RATE_LIMIT_WINDOW_MS = 10_000;
const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 60;

const resolveClientAddress = (req: Request): string => {
  return (
    readString(
      req.header('x-real-ip'),
      req.header('x-forwarded-for'),
      req.ip,
      req.socket.remoteAddress ?? null
    ) ?? req.ip ?? 'unknown'
  );
};

const webhookRateLimiter = rateLimit({
  windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS,
  max: WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const base = resolveClientAddress(req);
    const tenantHint = readString(req.header('x-tenant-id')) ?? 'no-tenant';
    const refreshHint = readString(req.header('x-refresh')) ?? 'no';
    return `${base}|${tenantHint}|${refreshHint}`;
  },
  handler: (req: Request, res: Response) => {
    const context = ensureWebhookContext(req, res);
    logWebhookEvent('warn', '🛑 WhatsApp webhook rate limit exceeded', context, {
      limit: WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
      windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS,
    });
    trackWebhookRejection('rate_limited');
    res.status(429).end();
  },
});

const verifyWhatsAppWebhookRequest = async (req: Request, res: Response, next: NextFunction) => {
  const context = ensureWebhookContext(req, res);
  const expectedApiKey = getWebhookApiKey();

  if (expectedApiKey) {
    const providedApiKey = normalizeApiKey(
      readString(
        req.header('x-webhook-token'),
        req.header('x-api-key'),
        req.header('authorization'),
        req.header('x-authorization')
      )
    );

    if (!providedApiKey) {
      logWebhookEvent('warn', '🛑 WhatsApp webhook rejected: authorization header missing', context);
      trackWebhookRejection('invalid_api_key');
      res.status(401).end();
      return;
    }

    if (providedApiKey !== expectedApiKey) {
      logWebhookEvent('warn', '🛑 WhatsApp webhook rejected: invalid authorization token', context);
      trackWebhookRejection('invalid_api_key');
      res.status(401).end();
      return;
    }
  }

  if (context.signatureRequired) {
    const secret = getWebhookSignatureSecret();
    const signature = readString(
      req.header('x-webhook-signature'),
      req.header('x-webhook-signature-sha256'),
      req.header('x-signature'),
      req.header('x-signature-sha256')
    );

    if (!signature || !secret) {
      logWebhookEvent('warn', '🛑 WhatsApp webhook rejected: signature missing', context);
      trackWebhookRejection('invalid_signature');
      res.status(401).end();
      return;
    }

    try {
      const crypto = await import('node:crypto');
      const expectedBuffer = crypto.createHmac('sha256', secret).update(req.rawBody ?? '').digest();
      const providedBuffer = Buffer.from(signature, 'hex');

      const matches =
        providedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(providedBuffer, expectedBuffer);

      if (!matches) {
        logWebhookEvent('warn', '🛑 WhatsApp webhook rejected: signature mismatch', context);
        trackWebhookRejection('invalid_signature');
        res.status(401).end();
        return;
      }
    } catch (error) {
      logWebhookEvent('warn', 'Failed to verify WhatsApp webhook signature', context, { error });
      trackWebhookRejection('invalid_signature');
      res.status(401).end();
      return;
    }
  }

  return next();
};

const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const context = ensureWebhookContext(req, res);
  const { requestId, signatureRequired } = context;
  const startedAt = Date.now();

  logWebhookEvent('info', '🕵️ Etapa1-UPSERT liberada: credenciais verificadas', context, {
    signatureEnforced: signatureRequired,
  });

  const rawBodyParseError = (req as Request & { rawBodyParseError?: SyntaxError | null }).rawBodyParseError;
  if (rawBodyParseError) {
    logWebhookEvent('warn', 'WhatsApp webhook received invalid JSON payload', context, {
      error: rawBodyParseError.message,
    });
    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: 'unknown',
      instanceId: 'unknown',
      result: 'rejected',
      reason: 'invalid_json',
    });
    res.status(400).json({
      ok: false,
      error: { code: 'INVALID_WEBHOOK_JSON', message: 'Invalid JSON payload' },
    });
    return;
  }

  const events = asArray(req.body);
  if (events.length === 0) {
    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: 'unknown',
      instanceId: 'unknown',
      result: 'accepted',
      reason: 'empty',
    });
    res.status(200).json({ ok: true, received: 0, persisted: 0 });
    return;
  }

  let enqueued = 0;
  let ackPersisted = 0;
  let ackFailures = 0;
  let prepFailures = 0;
  let pollPersisted = 0;
  let pollIgnored = 0;
  let pollFailures = 0;

  for (const entry of events) {
    const unwrapped = unwrapWebhookEvent(entry);
    if (!unwrapped) {
      continue;
    }

    const eventRecord = unwrapped.event;
    const envelopeRecord = unwrapped.envelope;
    const rawPreview = toRawPreview(entry);
    const eventType = readString(eventRecord.event, (eventRecord as { type?: unknown }).type);

    const defaultInstanceId = getDefaultInstanceId();
    const rawInstanceId =
      readString(
        (eventRecord as { instanceId?: unknown }).instanceId,
        envelopeRecord.instanceId
      ) ?? defaultInstanceId ?? undefined;
    let instanceOverride = rawInstanceId;
    let brokerOverride: string | undefined;
    let tenantOverride = readString(
      (eventRecord as { tenantId?: unknown }).tenantId,
      envelopeRecord.tenantId
    ) ?? undefined;

    const resolvedInstance = await (async () => {
      if (!rawInstanceId) {
        return null;
      }

      const directMatch = await prisma.whatsAppInstance.findFirst({
        where: {
          OR: [{ id: rawInstanceId }, { brokerId: rawInstanceId }],
        },
        select: {
          id: true,
          brokerId: true,
          tenantId: true,
        },
      });

      if (directMatch) {
        return directMatch;
      }

      if (!defaultInstanceId || defaultInstanceId === rawInstanceId) {
        return null;
      }

      return prisma.whatsAppInstance.findUnique({
        where: { id: defaultInstanceId },
        select: {
          id: true,
          brokerId: true,
          tenantId: true,
        },
      });
    })();

    if (resolvedInstance) {
      instanceOverride = resolvedInstance.id;

      const storedBrokerId =
        typeof resolvedInstance.brokerId === 'string' && resolvedInstance.brokerId.trim().length > 0
          ? resolvedInstance.brokerId.trim()
          : undefined;

      // Se o rawInstanceId veio do broker e difere do armazenado, persiste para manter o mapeamento
      if (rawInstanceId && storedBrokerId !== rawInstanceId) {
        await prisma.whatsAppInstance.update({
          where: { id: resolvedInstance.id },
          data: { brokerId: rawInstanceId },
        });
      }

      brokerOverride = rawInstanceId ?? storedBrokerId ?? undefined;

      // Herdar tenant da instância quando o envelope não trouxe
      if (!tenantOverride && resolvedInstance.tenantId) {
        tenantOverride = resolvedInstance.tenantId;
      }
    }

    if (eventType === 'WHATSAPP_MESSAGES_UPDATE') {
      const ackOutcome = await processMessagesUpdate(eventRecord, envelopeRecord, {
        requestId,
        instanceId: instanceOverride ?? brokerOverride ?? rawInstanceId ?? null,
        tenantOverride: tenantOverride ?? null,
      });

      ackPersisted += ackOutcome.persisted;
      ackFailures += ackOutcome.failures;
      continue;
    }

    if (eventType === 'POLL_CHOICE') {
      const pollOutcome = await processPollChoiceEvent(eventRecord, envelopeRecord, {
        requestId,
        instanceId: instanceOverride ?? brokerOverride ?? rawInstanceId ?? null,
        tenantOverride: tenantOverride ?? null,
      });

      pollPersisted += pollOutcome.persisted;
      pollIgnored += pollOutcome.ignored;
      pollFailures += pollOutcome.failures;
      continue;
    }

    const normalizedMessages: NormalizedRawUpsertMessage[] = [];

    if (eventType === 'MESSAGE_INBOUND' || eventType === 'MESSAGE_OUTBOUND') {
      const normalizedContract = normalizeContractEvent(eventRecord, {
        requestId,
        instanceOverride: instanceOverride ?? null,
        tenantOverride: tenantOverride ?? null,
        brokerOverride: brokerOverride ?? null,
      });

      if (!normalizedContract) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantOverride ?? 'unknown',
          instanceId: instanceOverride ?? 'unknown',
          result: 'ignored',
          reason: 'invalid_contract',
        });
        continue;
      }

      normalizedMessages.push(normalizedContract);
    } else {
      if (eventType && eventType !== 'WHATSAPP_MESSAGES_UPSERT') {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantOverride ?? 'unknown',
          instanceId: instanceOverride ?? 'unknown',
          result: 'ignored',
          reason: 'unsupported_event',
        });
        continue;
      }

      const normalization = normalizeUpsertEvent(eventRecord, {
        instanceId: instanceOverride ?? null,
        tenantId: tenantOverride ?? null,
        brokerId: brokerOverride ?? null,
      });

      if (normalization.normalized.length === 0) {
        continue;
      }

      normalizedMessages.push(...normalization.normalized);
    }

    for (const normalized of normalizedMessages) {
      // Idempotência por tenant|instance|messageId|index para evitar reprocesso
      const normalizedIdemKey = buildIdempotencyKey(
        tenantOverride ?? normalized.tenantId ?? 'unknown',
        instanceOverride ?? brokerOverride ?? rawInstanceId ?? null,
        normalized.messageId ?? null,
        normalized.messageIndex ?? 0
      );
      if (!registerIdempotency(normalizedIdemKey)) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantOverride ?? normalized.tenantId ?? 'unknown',
          instanceId: instanceOverride ?? brokerOverride ?? rawInstanceId ?? 'unknown',
          result: 'ignored',
          reason: 'message_duplicate',
        });
        continue;
      }

      const processed = await processNormalizedMessage({
        normalized,
        eventRecord,
        envelopeRecord,
        rawPreview,
        requestId,
        tenantOverride: tenantOverride ?? null,
        instanceOverride: instanceOverride ?? null,
      });

      if (processed) {
        enqueued += 1;
      } else {
        prepFailures += 1;
      }
    }
  }

  if (prepFailures > 0) {
    logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Webhook encontrou falhas ao preparar ingestão', {
      requestId,
      prepFailures,
    });
  }

  if (ackFailures > 0) {
    logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Atualização de status WhatsApp falhou em algumas mensagens', {
      requestId,
      ackFailures,
      ackPersisted,
    });
  }

  logger.debug('🎯 LeadEngine • WhatsApp :: ✅ Eventos enfileirados a partir do webhook', {
    requestId,
    received: events.length,
    enqueued,
    ackPersisted,
    ackFailures,
    pollPersisted,
    pollIgnored,
    pollFailures,
    durationMs: Date.now() - startedAt,
  });

  res.status(204).send();
};

const handleVerification = asyncHandler(async (req: Request, res: Response) => {
  const mode = readString(req.query['hub.mode']);
  const challenge = readString(req.query['hub.challenge']);
  const token = readString(req.query['hub.verify_token']);
  const verifyToken = getWebhookVerifyToken();

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    res.status(200).send(challenge ?? DEFAULT_VERIFY_RESPONSE);
    return;
  }

  res.status(200).send(DEFAULT_VERIFY_RESPONSE);
});

webhookRouter.post(
  '/whatsapp',
  webhookRateLimiter,
  asyncHandler(verifyWhatsAppWebhookRequest),
  asyncHandler(handleWhatsAppWebhook)
);
integrationWebhookRouter.post(
  '/whatsapp/webhook',
  webhookRateLimiter,
  asyncHandler(verifyWhatsAppWebhookRequest),
  asyncHandler(handleWhatsAppWebhook)
);
webhookRouter.get('/whatsapp', handleVerification);

export const __testing = {
  buildPollVoteMessageContent,
  updatePollVoteMessage,
  setUpdatePollVoteMessageHandler(handler: UpdatePollVoteMessageHandler) {
    updatePollVoteMessageHandler = handler;
  },
  resetUpdatePollVoteMessageHandler() {
    updatePollVoteMessageHandler = updatePollVoteMessage;
  },
  setPollVoteRetryScheduler(handler: SchedulePollVoteRetryHandler) {
    schedulePollVoteRetry = handler;
  },
  resetPollVoteRetryScheduler() {
    schedulePollVoteRetry = defaultPollVoteRetryScheduler;
  },
  subscribeToPollChoiceEvent<E extends PollChoiceEventName>(
    event: E,
    handler: (payload: PollChoiceEventBusPayloads[E]) => void
  ) {
    return pollChoiceEventBus.on(event, handler);
  },
};

export { integrationWebhookRouter as whatsappIntegrationWebhookRouter, webhookRouter as whatsappWebhookRouter };
