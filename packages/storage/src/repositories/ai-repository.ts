import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../prisma-client';

const prisma: PrismaClient = getPrismaClient();

export type AiAssistantMode = 'IA_AUTO' | 'COPILOTO' | 'HUMANO';

export type UpsertAiConfigInput = {
  tenantId: string;
  queueId?: string | null;
  scopeKey?: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number | null;
  systemPromptReply?: string | null;
  systemPromptSuggest?: string | null;
  structuredOutputSchema?: Prisma.JsonValue | null;
  tools?: Prisma.JsonValue | null;
  vectorStoreEnabled?: boolean;
  vectorStoreIds?: string[];
  streamingEnabled?: boolean;
  defaultMode?: AiAssistantMode;
  confidenceThreshold?: number | null;
  fallbackPolicy?: string | null;
};

export const getAiConfig = async (tenantId: string, queueId?: string | null) => {
  const scopeKey = queueId ?? '__global__';
  return prisma.aiConfig.findFirst({
    where: {
      tenantId,
      scopeKey,
    },
  });
};

export const upsertAiConfig = async (input: UpsertAiConfigInput) => {
  const {
    tenantId,
    queueId = null,
    scopeKey: providedScope,
    model,
    temperature,
    maxOutputTokens,
    systemPromptReply,
    systemPromptSuggest,
    structuredOutputSchema,
    tools,
    vectorStoreEnabled,
    vectorStoreIds,
    streamingEnabled,
    defaultMode,
    confidenceThreshold,
    fallbackPolicy,
  } = input;

  const scopeKey = providedScope ?? queueId ?? '__global__';

  return prisma.aiConfig.upsert({
    where: {
      tenantId_scopeKey: {
        tenantId,
        scopeKey,
      },
    },
    update: {
      queueId,
      scopeKey,
      model,
      temperature: temperature ?? undefined,
      maxOutputTokens,
      systemPromptReply,
      systemPromptSuggest,
      structuredOutputSchema,
      tools,
      vectorStoreEnabled,
      vectorStoreIds,
      streamingEnabled,
      defaultMode: defaultMode ?? undefined,
      confidenceThreshold,
      fallbackPolicy,
    },
    create: {
      tenantId,
      queueId,
      scopeKey,
      model,
      temperature: temperature ?? undefined,
      maxOutputTokens,
      systemPromptReply,
      systemPromptSuggest,
      structuredOutputSchema,
      tools,
      vectorStoreEnabled,
      vectorStoreIds,
      streamingEnabled,
      defaultMode: defaultMode ?? undefined,
      confidenceThreshold,
      fallbackPolicy,
    },
  });
};

export const recordAiSuggestion = async (params: {
  tenantId: string;
  conversationId: string;
  configId?: string | null;
  payload: Prisma.JsonValue;
  confidence?: number | null;
}) => {
  const { tenantId, conversationId, configId, payload, confidence } = params;

  return prisma.aiSuggestion.create({
    data: {
      tenantId,
      conversationId,
      configId: configId ?? undefined,
      payload,
      confidence,
    },
  });
};

export const upsertAiMemory = async (params: {
  tenantId: string;
  contactId: string;
  topic: string;
  content: string;
  metadata?: Prisma.JsonValue | null;
  expiresAt?: Date | null;
}) => {
  const { tenantId, contactId, topic, content, metadata, expiresAt } = params;

  return prisma.aiMemory.upsert({
    where: {
      tenantId_contactId_topic: {
        tenantId,
        contactId,
        topic,
      },
    },
    update: {
      content,
      metadata: metadata ?? undefined,
      expiresAt,
    },
    create: {
      tenantId,
      contactId,
      topic,
      content,
      metadata: metadata ?? undefined,
      expiresAt,
    },
  });
};

export const recordAiRun = async (params: {
  tenantId: string;
  conversationId: string;
  configId?: string | null;
  runType: string;
  adapter?: string | null;
  requestPayload: Prisma.JsonValue;
  responsePayload?: Prisma.JsonValue | null;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: Prisma.Decimal | number | null;
  status?: string;
}) => {
  const {
    tenantId,
    conversationId,
    configId,
    runType,
    adapter,
    requestPayload,
    responsePayload,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    status,
  } = params;

  return prisma.aiRun.create({
    data: {
      tenantId,
      conversationId,
      configId: configId ?? undefined,
      runType,
      adapter: adapter ?? undefined,
      requestPayload,
      responsePayload,
      latencyMs,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      status,
    },
  });
};
