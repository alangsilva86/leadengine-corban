import { randomUUID } from 'node:crypto';
import { resolveDefaultAiMode } from '../config/ai';

export type AiMode = 'manual' | 'assist' | 'auto';

export type AiModeRecord = {
  tenantId: string;
  mode: AiMode;
  updatedAt: Date;
  updatedBy: string | null;
};

const mapAssistantModeToStore = (mode: ReturnType<typeof resolveDefaultAiMode>): AiMode => {
  if (mode === 'IA_AUTO') {
    return 'auto';
  }
  if (mode === 'HUMANO') {
    return 'manual';
  }
  return 'assist';
};

const DEFAULT_MODE: AiMode = mapAssistantModeToStore(resolveDefaultAiMode());

const modeStore = new Map<string, AiModeRecord>();

export const getAiModeRecord = (tenantId: string): AiModeRecord => {
  const existing = modeStore.get(tenantId);
  if (existing) {
    return existing;
  }

  const record: AiModeRecord = {
    tenantId,
    mode: DEFAULT_MODE,
    updatedAt: new Date(0),
    updatedBy: null,
  };

  modeStore.set(tenantId, record);
  return record;
};

export const setAiModeRecord = (tenantId: string, mode: AiMode, updatedBy?: string | null): AiModeRecord => {
  const record: AiModeRecord = {
    tenantId,
    mode,
    updatedAt: new Date(),
    updatedBy: updatedBy ?? null,
  };

  modeStore.set(tenantId, record);
  return record;
};

type AiMemoryUpsertInput = {
  contactId: string;
  topic: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
};

export type AiMemoryRecord = {
  id: string;
  tenantId: string;
  contactId: string;
  topic: string;
  content: string;
  metadata: Record<string, unknown> | null;
  updatedAt: Date;
  expiresAt: Date | null;
};

const memoryStore = new Map<string, AiMemoryRecord>();

const buildMemoryKey = (tenantId: string, contactId: string, topic: string) =>
  `${tenantId}:${contactId}:${topic.trim().toLowerCase()}`;

export const upsertMemoryRecord = (
  tenantId: string,
  input: AiMemoryUpsertInput
): AiMemoryRecord => {
  const key = buildMemoryKey(tenantId, input.contactId, input.topic);
  const existing = memoryStore.get(key);
  const now = new Date();
  const record: AiMemoryRecord = existing
    ? {
        ...existing,
        content: input.content,
        metadata: input.metadata ?? null,
        updatedAt: now,
        expiresAt: input.expiresAt ?? existing.expiresAt,
      }
    : {
        id: randomUUID(),
        tenantId,
        contactId: input.contactId,
        topic: input.topic,
        content: input.content,
        metadata: input.metadata ?? null,
        updatedAt: now,
        expiresAt: input.expiresAt ?? null,
      };

  memoryStore.set(key, record);
  return record;
};

export const listMemoryRecords = (tenantId: string, contactId: string): AiMemoryRecord[] => {
  const records: AiMemoryRecord[] = [];
  for (const record of memoryStore.values()) {
    if (record.tenantId === tenantId && record.contactId === contactId) {
      records.push(record);
    }
  }
  return records;
};

type AiReplyRecord = {
  id: string;
  tenantId: string;
  ticketId: string;
  content: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

const replyStore = new Map<string, AiReplyRecord[]>();

export const appendReplyRecord = (
  tenantId: string,
  ticketId: string,
  content: string,
  metadata: Record<string, unknown>
): AiReplyRecord => {
  const record: AiReplyRecord = {
    id: randomUUID(),
    tenantId,
    ticketId,
    content,
    createdAt: new Date(),
    metadata,
  };

  const key = `${tenantId}:${ticketId}`;
  const existing = replyStore.get(key) ?? [];
  existing.push(record);
  replyStore.set(key, existing);
  return record;
};

export const listReplyRecords = (tenantId: string, ticketId: string): AiReplyRecord[] => {
  const key = `${tenantId}:${ticketId}`;
  return [...(replyStore.get(key) ?? [])];
};

export const resetAiStores = (): void => {
  modeStore.clear();
  memoryStore.clear();
  replyStore.clear();
};
