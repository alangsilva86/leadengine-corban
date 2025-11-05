import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { sanitizeJsonPayload } from '../utils/baileys-event-logger';
import { pollRuntimeService } from './poll-runtime-service';

const POLL_METADATA_SOURCE = 'whatsapp.poll_meta';

const buildMetadataId = (pollId: string): string => `poll-meta:${pollId}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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

    const rawPayload = record.payload as unknown;
    if (!isPlainObject(rawPayload)) {
      return null;
    }

    const pollIdValue = rawPayload.pollId;
    if (typeof pollIdValue !== 'string' || !pollIdValue.trim()) {
      return null;
    }

    return rawPayload as unknown as PollMetadataPayload;
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
): PollMetadataOption[] => {
  if ((!existing || existing.length === 0) && (!incoming || incoming.length === 0)) {
    return [];
  }

  const map = new Map<string, PollMetadataOption>();

  for (const option of existing ?? []) {
    if (!option || !option.id) {
      continue;
    }
    map.set(option.id, option);
  }

  for (const option of incoming ?? []) {
    if (!option || !option.id) {
      continue;
    }
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
      const existingPayloadRaw = existing.payload as unknown;
      const existingPayload = isPlainObject(existingPayloadRaw)
        ? ((existingPayloadRaw as unknown) as PollMetadataPayload)
        : null;
      const mergedOptions = mergeOptions(existingPayload?.options, payload.options);
      merged = {
        pollId,
        question: payload.question ?? existingPayload?.question ?? null,
        selectableOptionsCount:
          payload.selectableOptionsCount ?? existingPayload?.selectableOptionsCount ?? null,
        allowMultipleAnswers:
          payload.allowMultipleAnswers ?? existingPayload?.allowMultipleAnswers ?? false,
        options: mergedOptions,
        creationMessageId: payload.creationMessageId ?? existingPayload?.creationMessageId ?? null,
        creationMessageKey: {
          remoteJid:
            payload.creationMessageKey?.remoteJid ??
            existingPayload?.creationMessageKey?.remoteJid ??
            null,
          participant:
            payload.creationMessageKey?.participant ??
            existingPayload?.creationMessageKey?.participant ??
            null,
          fromMe:
            payload.creationMessageKey?.fromMe ??
            existingPayload?.creationMessageKey?.fromMe ??
            false,
        },
        messageSecret: payload.messageSecret ?? existingPayload?.messageSecret ?? null,
        messageSecretVersion:
          payload.messageSecretVersion ?? existingPayload?.messageSecretVersion ?? null,
        tenantId: payload.tenantId ?? existingPayload?.tenantId ?? null,
        instanceId: payload.instanceId ?? existingPayload?.instanceId ?? null,
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

    try {
      await pollRuntimeService.mergeMetadata(merged);
    } catch (runtimeError) {
      logger.warn('Failed to sync poll metadata with runtime cache', {
        pollId,
        error: runtimeError instanceof Error ? runtimeError.message : String(runtimeError),
      });
    }
  } catch (error) {
    logger.warn('Failed to persist WhatsApp poll metadata', {
      pollId: payload.pollId,
      error,
    });
  }
};
