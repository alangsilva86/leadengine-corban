import { upsertMemoryRecord } from '../../data/ai-store';
import { AiMemory } from './types';

export type UpsertMemoryInput = {
  tenantId: string;
  contactId: string;
  topic: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  ttlSeconds?: number;
};

export const upsertConversationMemory = async (
  input: UpsertMemoryInput
): Promise<AiMemory> => {
  const expiresAt = typeof input.ttlSeconds === 'number' && input.ttlSeconds > 0
    ? new Date(Date.now() + input.ttlSeconds * 1000)
    : null;

  const record = upsertMemoryRecord(input.tenantId, {
    contactId: input.contactId,
    topic: input.topic,
    content: input.content,
    metadata: input.metadata ?? null,
    expiresAt,
  });

  return {
    id: record.id,
    tenantId: record.tenantId,
    contactId: record.contactId,
    topic: record.topic,
    content: record.content,
    metadata: record.metadata,
    updatedAt: record.updatedAt.toISOString(),
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
  };
};
