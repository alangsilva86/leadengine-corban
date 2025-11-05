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
  optionIds: string[];
  selectedOptions: Array<{ id: string; title: string | null }>;
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

  const optionIdSet = new Set<string>();
  const selectionMap = new Map<string, { id: string; title: string | null }>();

  const registerOptionId = (value: unknown) => {
    const normalized = pick(value);
    if (normalized) {
      optionIdSet.add(normalized);
    }
  };

  const registerSelection = (entry: unknown) => {
    if (!entry) {
      return;
    }

    if (typeof entry === 'string') {
      const normalized = entry.trim();
      if (!normalized) {
        return;
      }
      optionIdSet.add(normalized);
      if (!selectionMap.has(normalized)) {
        selectionMap.set(normalized, { id: normalized, title: normalized });
      }
      return;
    }

    if (typeof entry !== 'object') {
      return;
    }

    const record = entry as Record<string, unknown>;
    const candidateId =
      pick(record.id) ??
      pick((record as { optionId?: unknown }).optionId) ??
      pick((record as { key?: unknown }).key) ??
      pick((record as { value?: unknown }).value) ??
      null;
    const label = pickOptionLabel(record);
    const normalizedId = candidateId ?? label ?? null;
    if (!normalizedId) {
      return;
    }
    optionIdSet.add(normalizedId);
    if (!selectionMap.has(normalizedId)) {
      selectionMap.set(normalizedId, {
        id: normalizedId,
        title: label ?? (candidateId ? null : normalizedId),
      });
    } else if (label && !selectionMap.get(normalizedId)?.title) {
      selectionMap.set(normalizedId, {
        id: normalizedId,
        title: label,
      });
    }
  };

  const selectedOptionsCandidates = (
    [] as unknown[]
  )
    .concat(
      Array.isArray((metadata as any)?.pollChoice?.selectedOptions)
        ? (metadata as any)?.pollChoice?.selectedOptions ?? []
        : [],
      Array.isArray((metadata as any)?.pollChoice?.vote?.selectedOptions)
        ? (metadata as any)?.pollChoice?.vote?.selectedOptions ?? []
        : [],
      Array.isArray((metadata as any)?.poll?.selectedOptions)
        ? (metadata as any)?.poll?.selectedOptions ?? []
        : [],
      Array.isArray((payload as any)?.selectedOptions)
        ? (payload as any)?.selectedOptions ?? []
        : []
    );

  selectedOptionsCandidates.forEach(registerSelection);

  const optionIdCandidates = (
    [] as unknown[]
  )
    .concat(
      (metadata as any)?.pollChoice?.optionIds ?? [],
      (metadata as any)?.pollChoice?.vote?.optionIds ?? [],
      (metadata as any)?.poll?.selectedOptionIds ?? [],
      (payload as any)?.optionIds ?? []
    );

  optionIdCandidates.forEach(registerOptionId);

  const selectedOptionFromVote = Array.isArray((metadata as any)?.pollChoice?.vote?.selectedOptions)
    ? (metadata as any)?.pollChoice?.vote?.selectedOptions?.[0]
    : null;
  const selectedOptionFromPoll = Array.isArray((metadata as any)?.poll?.selectedOptions)
    ? (metadata as any)?.poll?.selectedOptions?.[0]
    : null;

  const selectionSummary = Array.from(selectionMap.values())
    .map((entry) => entry.title ?? entry.id)
    .filter((value): value is string => Boolean(value));

  const choiceText =
    pick((message as any).text) ??
    (selectionSummary.length > 0 ? selectionSummary.join(', ') : null) ??
    pickOptionLabel(selectedOptionFromVote) ??
    pickOptionLabel(selectedOptionFromPoll) ??
    pick((payload as any)?.text) ??
    null;

  const choiceId =
    Array.from(optionIdSet.values())[0] ??
    pick((selectedOptionFromVote as any)?.id) ??
    pick((selectedOptionFromPoll as any)?.id) ??
    pick((selectedOptionFromVote as any)?.optionId) ??
    pick((selectedOptionFromPoll as any)?.optionId) ??
    pick((selectedOptionFromVote as any)?.key) ??
    pick((selectedOptionFromPoll as any)?.key) ??
    pick((selectedOptionFromVote as any)?.value) ??
    pick((selectedOptionFromPoll as any)?.value) ??
    pick((payload as any)?.selectedOptionId) ??
    null;

  if (choiceId) {
    optionIdSet.add(choiceId);
  }

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

  return {
    pollId,
    question,
    choiceText: enrichedChoiceText,
    choiceId,
    optionIds: Array.from(optionIdSet.values()),
    selectedOptions: Array.from(selectionMap.values()),
  };
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
  const { pollId, question, choiceText, choiceId, optionIds, selectedOptions } = extractPollVote(segments);

  const formattedSelectedOptions = selectedOptions.map((entry) => ({
    id: entry.id,
    title: entry.title ?? entry.id,
    text: entry.title ?? entry.id,
  }));

  const fallbackSelectionId = choiceId ?? (choiceText && choiceText.trim().length ? choiceText.trim() : null);
  const fallbackSelection =
    !formattedSelectedOptions.length && fallbackSelectionId
      ? {
          id: fallbackSelectionId,
          title: choiceText ?? fallbackSelectionId,
          text: choiceText ?? fallbackSelectionId,
        }
      : undefined;

  const allSelectedOptions = formattedSelectedOptions.length
    ? formattedSelectedOptions
    : fallbackSelection
      ? [fallbackSelection]
      : [];

  const normalizedOptionIds = optionIds.length > 0
    ? optionIds
    : allSelectedOptions.map((entry) => entry.id).filter((value): value is string => Boolean(value));

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
        ...(allSelectedOptions.length ? { selectedOptions: allSelectedOptions } : {}),
        ...(normalizedOptionIds.length ? { selectedOptionIds: normalizedOptionIds } : {}),
        updatedAt: new Date().toISOString(),
      },
      pollChoice: {
        pollId: pollId ?? undefined,
        question: question ?? undefined,
        ...(normalizedOptionIds.length ? { optionIds: normalizedOptionIds } : {}),
        ...(allSelectedOptions.length ? { selectedOptions: allSelectedOptions } : {}),
        vote: {
          ...(allSelectedOptions.length ? { selectedOptions: allSelectedOptions } : {}),
          ...(normalizedOptionIds.length ? { optionIds: normalizedOptionIds } : {}),
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
