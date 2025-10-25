import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { sanitizeJsonPayload } from '../utils/baileys-event-logger';

const POLL_METADATA_SOURCE = 'whatsapp.poll_meta';

const buildMetadataId = (pollId: string): string => `poll-meta:${pollId}`;

export interface PollMetadataOption {
  id: string;
  title: string | null;
  index: number | null;
  optionName?: string | null;
  description?: string | null;
}

export interface PollMetadataPayload {
  pollId: string;
  question?: string | null;
  selectableOptionsCount?: number | null;
  allowMultipleAnswers?: boolean;
  options?: PollMetadataOption[];
  creationMessageId?: string | null;
  creationMessageKey?: {
    remoteJid?: string | null;
    participant?: string | null;
    fromMe?: boolean;
  } | null;
  messageSecret?: string | null;
  messageSecretVersion?: number | null;
  tenantId?: string | null;
  instanceId?: string | null;
  updatedAt?: string;
}

export const getPollMetadata = async (pollId: string): Promise<PollMetadataPayload | null> => {
  const trimmed = pollId.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const record = await prisma.processedIntegrationEvent.findUnique({
      where: { id: buildMetadataId(trimmed) },
    });

    if (!record) {
      return null;
    }

    const payload = record.payload as PollMetadataPayload | null;
    return payload ?? null;
  } catch (error) {
    logger.warn('Failed to load WhatsApp poll metadata', {
      pollId: trimmed,
      error,
    });
    return null;
  }
};

const mergeOptions = (
  existing: PollMetadataOption[] | undefined,
  incoming: PollMetadataOption[] | undefined
): PollMetadataOption[] | undefined => {
  if ((!existing || existing.length === 0) && (!incoming || incoming.length === 0)) {
    return existing ?? incoming;
  }

  const map = new Map<string, PollMetadataOption>();

  for (const option of existing ?? []) {
    map.set(option.id, option);
  }

  for (const option of incoming ?? []) {
    map.set(option.id, {
      ...map.get(option.id),
      ...option,
    });
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    const aIndex = a.index ?? Number.MAX_SAFE_INTEGER;
    const bIndex = b.index ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.id.localeCompare(b.id);
  });

  return merged;
};

export const upsertPollMetadata = async (payload: PollMetadataPayload): Promise<void> => {
  const pollId = payload.pollId.trim();
  if (!pollId) {
    return;
  }

  try {
    const recordId = buildMetadataId(pollId);
    const existing = await prisma.processedIntegrationEvent.findUnique({
      where: { id: recordId },
    });

    let merged: PollMetadataPayload = {
      pollId,
      options: payload.options ?? [],
      selectableOptionsCount: payload.selectableOptionsCount ?? null,
      allowMultipleAnswers: payload.allowMultipleAnswers ?? false,
      question: payload.question ?? null,
      creationMessageId: payload.creationMessageId ?? null,
      creationMessageKey: payload.creationMessageKey ?? null,
      messageSecret: payload.messageSecret ?? null,
      messageSecretVersion: payload.messageSecretVersion ?? null,
      tenantId: payload.tenantId ?? null,
      instanceId: payload.instanceId ?? null,
    };

    if (existing?.payload) {
      const existingPayload = existing.payload as PollMetadataPayload;
      merged = {
        pollId,
        question: payload.question ?? existingPayload.question ?? null,
        selectableOptionsCount:
          payload.selectableOptionsCount ?? existingPayload.selectableOptionsCount ?? null,
        allowMultipleAnswers:
          payload.allowMultipleAnswers ?? existingPayload.allowMultipleAnswers ?? false,
        options: mergeOptions(existingPayload.options, payload.options),
        creationMessageId: payload.creationMessageId ?? existingPayload.creationMessageId ?? null,
        creationMessageKey: {
          remoteJid:
            payload.creationMessageKey?.remoteJid ??
            existingPayload.creationMessageKey?.remoteJid ??
            null,
          participant:
            payload.creationMessageKey?.participant ??
            existingPayload.creationMessageKey?.participant ??
            null,
          fromMe:
            payload.creationMessageKey?.fromMe ??
            existingPayload.creationMessageKey?.fromMe ??
            false,
        },
        messageSecret: payload.messageSecret ?? existingPayload.messageSecret ?? null,
        messageSecretVersion:
          payload.messageSecretVersion ?? existingPayload.messageSecretVersion ?? null,
        tenantId: payload.tenantId ?? existingPayload.tenantId ?? null,
        instanceId: payload.instanceId ?? existingPayload.instanceId ?? null,
      };
    }

    merged.updatedAt = new Date().toISOString();

    await prisma.processedIntegrationEvent.upsert({
      where: { id: recordId },
      create: {
        id: recordId,
        source: POLL_METADATA_SOURCE,
        cursor: pollId,
        payload: sanitizeJsonPayload(merged),
      },
      update: {
        cursor: pollId,
        payload: sanitizeJsonPayload(merged),
      },
    });
  } catch (error) {
    logger.warn('Failed to persist WhatsApp poll metadata', {
      pollId: payload.pollId,
      error,
    });
  }
};
