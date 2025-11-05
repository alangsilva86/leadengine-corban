import { randomUUID } from 'node:crypto';

import { logger } from '../../../config/logger';
import { ingestInboundWhatsAppMessage } from './inbound-lead-service';
import { sanitizePhone } from './identifiers';
import { normalizeChatId } from '../utils/poll-helpers';
import type {
  PollChoiceEventPayload,
  PollChoiceSelectedOptionPayload,
  PollChoiceState,
} from '../schemas/poll-choice';
import type { InboundWhatsAppEnvelopeMessage } from './types';
import { pollRuntimeService } from './poll-runtime-service';

export enum PollChoiceInboxNotificationStatus {
  Ok = 'ok',
  MissingTenant = 'missing_tenant',
  InvalidChatId = 'invalid_chat_id',
  IngestRejected = 'ingest_rejected',
  IngestError = 'ingest_error',
}

export type PollChoiceInboxNotificationResult =
  | { status: PollChoiceInboxNotificationStatus.Ok; persisted: true }
  | {
      status:
        | PollChoiceInboxNotificationStatus.MissingTenant
        | PollChoiceInboxNotificationStatus.InvalidChatId
        | PollChoiceInboxNotificationStatus.IngestRejected
        | PollChoiceInboxNotificationStatus.IngestError;
      persisted: false;
    };

const extractPhoneFromChatId = (chatId: string | null): string | undefined => {
  if (!chatId) {
    return undefined;
  }

  const [localPart] = chatId.split('@');
  if (!localPart) {
    return undefined;
  }

  return sanitizePhone(localPart) ?? sanitizePhone(chatId);
};

const toTrimmedTitle = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type OptionLike = {
  id: string;
  title?: string | null;
  optionName?: string | null;
  description?: string | null;
  index?: number | null;
};

const buildOptionIndex = (
  state: PollChoiceState,
  runtimeOptions: OptionLike[] = []
): Map<string, { index: number; title: string | null }> => {
  const map = new Map<string, { index: number; title: string | null }>();

  const allOptions: OptionLike[] = [
    ...state.options,
    ...runtimeOptions.filter((option) => !state.options.some((stateOption) => stateOption.id === option.id)),
  ];

  allOptions.forEach((option, position) => {
    if (!option || typeof option.id !== 'string') {
      return;
    }

    const title = toTrimmedTitle(option.title ?? option.optionName ?? option.description);
    const normalizedIndex =
      typeof option.index === 'number' ? option.index : position;
    map.set(option.id, {
      index: normalizedIndex,
      title: title ?? null,
    });
  });

  return map;
};

const normalizeSelections = (
  poll: PollChoiceEventPayload,
  selectedOptions: PollChoiceSelectedOptionPayload[],
  state: PollChoiceState,
  runtimeVote: { optionIds: string[]; selectedOptions: Array<{ id: string; title: string | null }> } | null,
  runtimeOptions: OptionLike[] = []
): Array<{ id: string; title: string }> => {
  const voteEntry = runtimeVote ?? state.votes?.[poll.voterJid] ?? null;
  const optionIds = Array.isArray(voteEntry?.optionIds)
    ? voteEntry?.optionIds
    : Array.isArray(poll.selectedOptionIds)
    ? poll.selectedOptionIds
    : [];

  const selectedMap = new Map<string, string>();
  const optionIndex = buildOptionIndex(state, runtimeOptions);

  const pushSelection = (id: string, providedTitle?: string | null) => {
    if (!id || selectedMap.has(id)) {
      return;
    }

    const trimmedProvided = toTrimmedTitle(providedTitle);
    if (trimmedProvided) {
      selectedMap.set(id, trimmedProvided);
      return;
    }

    const optionDetails = optionIndex.get(id);
    if (optionDetails?.title) {
      selectedMap.set(id, optionDetails.title);
      return;
    }

    if (optionDetails) {
      selectedMap.set(id, `Opção ${optionDetails.index + 1}`);
      return;
    }

    selectedMap.set(id, id);
  };

  optionIds.forEach((optionId) => pushSelection(optionId));
  selectedOptions.forEach((option) => pushSelection(option.id, option.title));
  runtimeVote?.selectedOptions?.forEach((option) => pushSelection(option.id, option.title));

  return Array.from(selectedMap.entries()).map(([id, title]) => ({ id, title }));
};

type TriggerParams = {
  poll: PollChoiceEventPayload;
  state: PollChoiceState;
  selectedOptions: PollChoiceSelectedOptionPayload[];
  tenantId: string;
  instanceId?: string | null;
  requestId?: string | null;
};

export const triggerPollChoiceInboxNotification = async ({
  poll,
  state,
  selectedOptions,
  tenantId,
  instanceId,
  requestId,
}: TriggerParams): Promise<PollChoiceInboxNotificationResult> => {
  const normalizedTenantId = typeof tenantId === 'string' ? tenantId.trim() : '';
  if (!normalizedTenantId) {
    logger.warn('Poll choice inbox notification skipped due to missing tenant', {
      pollId: poll.pollId,
      voterJid: poll.voterJid,
      requestId: requestId ?? null,
    });
    return { status: PollChoiceInboxNotificationStatus.MissingTenant, persisted: false };
  }

  const chatId = normalizeChatId(poll.voterJid);
  if (!chatId) {
    logger.warn('Poll choice inbox notification skipped due to missing chat id', {
      pollId: poll.pollId,
      voterJid: poll.voterJid,
      tenantId: normalizedTenantId,
      requestId: requestId ?? null,
    });
    return { status: PollChoiceInboxNotificationStatus.InvalidChatId, persisted: false };
  }

  const phone = extractPhoneFromChatId(chatId);
  const now = new Date();
  const [runtimeMetadata, runtimeVote] = await Promise.all([
    pollRuntimeService.getPollMetadata(poll.pollId),
    pollRuntimeService.getVoteSelection(poll.pollId, poll.voterJid),
  ]);

  const voteSelections = normalizeSelections(
    poll,
    selectedOptions,
    state,
    runtimeVote,
    runtimeMetadata?.options ?? []
  );
  const selectionsText =
    voteSelections.length > 0
      ? voteSelections.map((selection) => `• ${selection.title}`).join('\n')
      : '• Resposta não identificada';

  const pollQuestion = (() => {
    const rawQuestion = runtimeMetadata?.question ?? state.context?.question;
    if (typeof rawQuestion !== 'string') {
      return null;
    }

    const trimmed = rawQuestion.trim();
    return trimmed.length > 0 ? trimmed : null;
  })();
  const pollLabel = pollQuestion ?? poll.pollId;

  const messageText = [
    'Resposta de enquete recebida.',
    `Enquete: ${pollLabel}`,
    'Opções escolhidas:',
    selectionsText,
  ].join('\n');

  const timestampMs = (() => {
    if (poll.timestamp) {
      const parsed = Date.parse(poll.timestamp);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    const voteTimestamp = state.votes?.[poll.voterJid]?.timestamp;
    if (voteTimestamp) {
      const parsed = Date.parse(voteTimestamp);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return now.getTime();
  })();

  const syntheticMessageId = randomUUID();
  const isoTimestamp = new Date(timestampMs).toISOString();

  const envelope: InboundWhatsAppEnvelopeMessage = {
    origin: 'poll_choice',
    instanceId: typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : 'unknown',
    chatId,
    tenantId: normalizedTenantId,
    message: {
      kind: 'message',
      id: syntheticMessageId,
      externalId: `poll-choice:${poll.pollId}:${syntheticMessageId}`,
      brokerMessageId: poll.messageId ?? null,
      timestamp: isoTimestamp,
      direction: 'INBOUND',
      contact: {
        phone: phone ?? null,
        name: phone ?? poll.voterJid ?? 'Contato WhatsApp',
      },
      payload: {
        id: syntheticMessageId,
        type: 'TEXT',
        text: messageText,
        conversation: messageText,
        messageTimestamp: Math.floor(timestampMs / 1000),
        key: {
          id: syntheticMessageId,
          remoteJid: chatId,
        },
      },
      metadata: {
        origin: 'poll_choice',
        tenantId: normalizedTenantId,
        requestId: requestId ?? null,
        poll: {
          id: poll.pollId,
          label: pollLabel,
          question: pollQuestion,
          selectedOptionIds: voteSelections.map((selection) => selection.id),
          selectedOptions: voteSelections,
          aggregates: state.aggregates,
          updatedAt: state.updatedAt,
        },
        pollChoice: {
          pollId: poll.pollId,
          voterJid: poll.voterJid,
          options: state.options,
          vote: state.votes?.[poll.voterJid] ?? null,
          label: pollLabel,
          question: pollQuestion,
        },
        contact: {
          phone: phone ?? null,
          remoteJid: chatId,
          voterJid: poll.voterJid,
        },
        broker: {
          direction: 'INBOUND',
          instanceId: instanceId ?? null,
          source: 'poll_choice',
          messageId: poll.messageId ?? null,
        },
      },
    },
  };

  try {
    const persisted = await ingestInboundWhatsAppMessage(envelope);
    if (!persisted) {
      logger.debug('Poll choice inbox notification ingestion returned false', {
        pollId: poll.pollId,
        voterJid: poll.voterJid,
        tenantId: normalizedTenantId,
        requestId: requestId ?? null,
      });
    } else {
      logger.info('Poll choice inbox notification ingested as synthetic message', {
        pollId: poll.pollId,
        voterJid: poll.voterJid,
        tenantId: normalizedTenantId,
        requestId: requestId ?? null,
        messageId: syntheticMessageId,
      });
    }
    return persisted
      ? { status: PollChoiceInboxNotificationStatus.Ok, persisted: true }
      : { status: PollChoiceInboxNotificationStatus.IngestRejected, persisted: false };
  } catch (error) {
    logger.error('Failed to ingest poll choice inbox notification', {
      pollId: poll.pollId,
      voterJid: poll.voterJid,
      tenantId: normalizedTenantId,
      requestId: requestId ?? null,
      error,
    });
    return { status: PollChoiceInboxNotificationStatus.IngestError, persisted: false };
  }
};
