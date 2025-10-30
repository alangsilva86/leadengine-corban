import { readString } from './identifiers';
import type { InboundWhatsAppEnvelope } from './types';

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const asRecord = toRecord;

type PollVote = {
  pollId: string | null;
  question: string | null;
  choiceText: string | null;
  choiceId: string | null;
};

export type PollPayloadSegments = {
  payload: Record<string, unknown>;
  message: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export const buildPollVoteText = (q: string | null, c: string | null): string => {
  if (q && c) return `Obrigado! Você votou em "${c}" para "${q}".`;
  if (c) return `Obrigado! Seu voto: "${c}".`;
  if (q) return `Obrigado! Seu voto foi registrado para a enquete: "${q}".`;
  return 'Obrigado! Seu voto foi registrado.';
};

const pickOptionLabel = (option: unknown): string | null => {
  if (typeof option === 'string') {
    const trimmed = option.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!option || typeof option !== 'object') return null;
  const optionRecord = option as Record<string, unknown>;
  const labelFields = [
    'title',
    'text',
    'name',
    'optionName',
    'label',
    'description',
    'displayName',
    'value',
  ] as const;
  for (const field of labelFields) {
    const candidate = readString(optionRecord[field]);
    if (candidate) return candidate;
  }
  return null;
};

const buildOptionCollections = (segments: PollPayloadSegments): unknown[] => {
  const { payload, message, metadata } = segments;
  return [
    (metadata as any)?.poll?.options,
    (metadata as any)?.pollChoice?.options,
    (metadata as any)?.interactive?.options,
    (payload as any)?.options,
    (payload as any)?.poll?.options,
    (payload as any)?.pollChoice?.options,
    (message as any)?.options,
  ];
};

const findOptionById = (segments: PollPayloadSegments, id: string | null): unknown => {
  if (!id) return null;
  const optionCollections = buildOptionCollections(segments);
  for (const collection of optionCollections) {
    if (!collection) continue;
    if (!Array.isArray(collection)) continue;
    for (const option of collection) {
      if (typeof option === 'string' && option.trim() === id) {
        return option;
      }
      if (!option || typeof option !== 'object') continue;
      const optionRecord = option as Record<string, unknown>;
      const identifiers = [optionRecord.id, optionRecord.optionId, optionRecord.key, optionRecord.value];
      if (identifiers.some((identifier) => readString(identifier) === id)) {
        return option;
      }
    }
  }
  return null;
};

export const extractPollVote = (segments: PollPayloadSegments): PollVote => {
  const { payload, message, metadata } = segments;
  const pick = (v: unknown) => readString(v);

  const selectedOptionFromVote = Array.isArray((metadata as any)?.pollChoice?.vote?.selectedOptions)
    ? (metadata as any)?.pollChoice?.vote?.selectedOptions?.[0]
    : null;
  const selectedOptionFromPoll = Array.isArray((metadata as any)?.poll?.selectedOptions)
    ? (metadata as any)?.poll?.selectedOptions?.[0]
    : null;

  const choiceText =
    pick((message as any).text) ??
    pickOptionLabel(selectedOptionFromVote) ??
    pickOptionLabel(selectedOptionFromPoll) ??
    pick((payload as any)?.text) ??
    null;

  const choiceId =
    pick((selectedOptionFromVote as any)?.id) ??
    pick((selectedOptionFromPoll as any)?.id) ??
    pick((metadata as any)?.pollChoice?.vote?.optionIds?.[0]) ??
    pick((metadata as any)?.poll?.selectedOptionIds?.[0]) ??
    pick((selectedOptionFromVote as any)?.optionId) ??
    pick((selectedOptionFromPoll as any)?.optionId) ??
    pick((selectedOptionFromVote as any)?.key) ??
    pick((selectedOptionFromPoll as any)?.key) ??
    pick((selectedOptionFromVote as any)?.value) ??
    pick((selectedOptionFromPoll as any)?.value) ??
    pick((payload as any)?.selectedOptionId) ??
    null;

  const enrichedChoiceText =
    choiceText ??
    pickOptionLabel(findOptionById(segments, choiceId)) ??
    pickOptionLabel(selectedOptionFromVote) ??
    pickOptionLabel(selectedOptionFromPoll);

  const question =
    pick((metadata as any)?.poll?.question) ??
    pick((metadata as any)?.pollChoice?.question) ??
    pick((metadata as any)?.poll?.title) ??
    pick((metadata as any)?.poll?.name) ??
    pick((metadata as any)?.pollChoice?.title) ??
    pick((metadata as any)?.pollChoice?.name) ??
    pick((payload as any)?.poll?.question) ??
    pick((payload as any)?.poll?.title) ??
    pick((payload as any)?.poll?.name) ??
    pick((payload as any)?.pollChoice?.question) ??
    pick((payload as any)?.pollChoice?.label) ??
    pick((payload as any)?.pollChoice?.text) ??
    pick((payload as any)?.question) ??
    pick((payload as any)?.title) ??
    pick((payload as any)?.name) ??
    null;

  const pollId =
    pick((metadata as any)?.poll?.id) ??
    pick((metadata as any)?.poll?.pollId) ??
    pick((metadata as any)?.pollChoice?.pollId) ??
    pick((payload as any)?.pollId) ??
    pick((payload as any)?.id) ??
    pick((message as any)?.id) ??
    null;

  return { pollId, question, choiceText: enrichedChoiceText, choiceId };
};

export const resolveMessageType = (segments: PollPayloadSegments): string | null => {
  const { payload, message, metadata } = segments;
  const baseType = readString((message as any).type) ?? readString((metadata as any).messageType);

  const pollUpdateSource =
    (message as any)?.pollUpdateMessage ?? (payload as any)?.pollUpdateMessage ?? null;
  const hasPollUpdatePayload =
    pollUpdateSource && typeof pollUpdateSource === 'object' && !Array.isArray(pollUpdateSource);

  const brokerMetadata = asRecord((metadata as any)?.broker);
  const interactiveMetadata = asRecord((metadata as any)?.interactive);

  const brokerContentType = readString((brokerMetadata as any)?.messageContentType);
  const interactiveType = readString((interactiveMetadata as any)?.type);

  const pollHints = [baseType, brokerContentType, interactiveType]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : null))
    .filter((value): value is string => Boolean(value));

  if (
    hasPollUpdatePayload ||
    pollHints.some((hint) => hint === 'poll_update' || hint === 'poll_choice')
  ) {
    return 'poll_update';
  }

  return baseType ?? null;
};

export type PollUpdateNormalizationInput = {
  envelope: InboundWhatsAppEnvelope;
  segments: PollPayloadSegments;
  baseMetadata: Record<string, unknown>;
  chatId: string | null;
  externalId: string;
  messageType?: string | null;
};

export type PollUpdateNormalizationResult =
  | { isPollUpdate: false }
  | {
      isPollUpdate: true;
      placeholder: false;
      message: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }
  | {
      isPollUpdate: true;
      placeholder: true;
      metadata: Record<string, unknown>;
    };

export const normalizePollUpdate = (
  input: PollUpdateNormalizationInput
): PollUpdateNormalizationResult => {
  const { envelope, segments, baseMetadata, chatId, externalId } = input;
  const messageType = input.messageType ?? resolveMessageType(segments);

  if (messageType !== 'poll_update') {
    return { isPollUpdate: false };
  }

  const { payload } = segments;
  const { pollId, question, choiceText, choiceId } = extractPollVote(segments);

  const resolvedOptionId = choiceId ?? choiceText ?? undefined;
  const selectedOption = choiceText || resolvedOptionId
    ? {
        ...(resolvedOptionId ? { id: resolvedOptionId } : {}),
        ...(choiceText ? { title: choiceText } : {}),
      }
    : undefined;

  if (choiceText || question) {
    const finalText = choiceText ?? buildPollVoteText(question, choiceText);

    const normalizedMessage = {
      type: 'TEXT',
      text: finalText,
      id: (envelope as any)?.message?.id ?? externalId,
    } as Record<string, unknown>;

    const normalizedMetadata = {
      ...baseMetadata,
      placeholder: false,
      direction: 'INBOUND',
      chatId: chatId ?? undefined,
      source: { channel: 'whatsapp', transport: 'baileys', event: 'poll_update' },
      poll: {
        id: pollId ?? undefined,
        question: question ?? undefined,
        ...(selectedOption ? { selectedOptions: [selectedOption] } : {}),
        ...(resolvedOptionId ? { selectedOptionIds: [resolvedOptionId] } : {}),
        updatedAt: new Date().toISOString(),
      },
      pollChoice: {
        pollId: pollId ?? undefined,
        question: question ?? undefined,
        vote: {
          ...(selectedOption ? { selectedOptions: [selectedOption] } : {}),
          ...(resolvedOptionId ? { optionIds: [resolvedOptionId] } : {}),
          timestamp: readString((payload as any).timestamp) ?? new Date().toISOString(),
        },
      },
    } as Record<string, unknown>;

    return {
      isPollUpdate: true,
      placeholder: false,
      message: normalizedMessage,
      metadata: normalizedMetadata,
    };
  }

  const metadataPoll = asRecord((baseMetadata as any).poll);
  const normalizedMetadata = {
    ...baseMetadata,
    placeholder: true,
    direction: 'INBOUND',
    source: { channel: 'whatsapp', transport: 'baileys', event: 'poll_update' },
    poll: {
      ...metadataPoll,
      id: metadataPoll.id ?? pollId ?? undefined,
      updatedAt: new Date().toISOString(),
    },
  } as Record<string, unknown>;

  return {
    isPollUpdate: true,
    placeholder: true,
    metadata: normalizedMetadata,
  };
};

export const __testing = {
  pickOptionLabel,
  findOptionById,
};
